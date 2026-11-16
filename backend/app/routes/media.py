"""File signatures, decoding and an allowlist for passive SVG artwork."""

import io
import re
import uuid
import warnings
from pathlib import Path
from xml.etree import ElementTree as ET

from defusedxml import ElementTree as SafeET
from defusedxml.common import DefusedXmlException
from flask import Blueprint, current_app, request, send_from_directory
from PIL import Image, ImageOps, UnidentifiedImageError
from werkzeug.exceptions import BadRequest, NotFound, RequestEntityTooLarge

from ..auth import admin_required, current_user
from ..core import db, now

media = Blueprint("media", __name__)
SVG_NS = "http://www.w3.org/2000/svg"
SVG_TAGS = set(
    "svg g defs path rect circle ellipse line polyline polygon linearGradient radialGradient stop clipPath mask title desc use symbol text tspan".split()
)
SVG_ATTRS = set(
    (
        "id class viewBox preserveAspectRatio version width height x y x1 y1 x2 y2 cx cy r rx ry d points "
        "fill fill-rule fill-opacity stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset "
        "stroke-opacity opacity transform gradientUnits gradientTransform spreadMethod offset stop-color stop-opacity "
        "clip-path clip-rule mask maskUnits maskContentUnits clipPathUnits xlink:href href fx fy font-size font-family "
        "font-weight text-anchor"
    ).split()
)
MIMES = {
    ".png": ("image/png", "PNG"),
    ".jpg": ("image/jpeg", "JPEG"),
    ".jpeg": ("image/jpeg", "JPEG"),
    ".webp": ("image/webp", "WEBP"),
    ".svg": ("image/svg+xml", "SVG"),
    ".pdf": ("application/pdf", "PDF"),
}


def safe_svg(data):
    if len(data) > 512_000:
        raise BadRequest("Keep SVG artwork under 500 KB.")
    try:
        root = SafeET.fromstring(data, forbid_dtd=True)
    except (ET.ParseError, DefusedXmlException, ValueError) as exc:
        raise BadRequest("Use a clean, self-contained SVG.") from exc
    if root.tag != "{" + SVG_NS + "}svg":
        raise BadRequest("Invalid SVG document.")
    for node in root.iter():
        if not node.tag.startswith("{" + SVG_NS + "}") or node.tag.split("}")[-1] not in SVG_TAGS:
            raise BadRequest(
                "Export the logo as a passive SVG with text converted to paths, or upload PNG."
            )
        for key, value in node.attrib.items():
            key = key.replace("{http://www.w3.org/1999/xlink}", "xlink:")
            if key not in SVG_ATTRS or re.search(r"[\\<>@]|/\*|[\x00-\x08]", value):
                raise BadRequest("Unsupported SVG attribute. Export as plain SVG or PNG.")
            if key.endswith("href") and not re.fullmatch(r"#[\w.-]+", value):
                raise BadRequest("SVG references must stay inside the artwork.")
            if re.search(r"url\s*\(", value, re.I) and not re.fullmatch(r"url\(#[\w.-]+\)", value):
                raise BadRequest("External paint or media references are unavailable.")
    ET.register_namespace("", SVG_NS)
    return ET.tostring(root, encoding="utf-8")


@media.post("/api/admin/media")
@admin_required
def upload():
    f = request.files.get("file")
    if not f or not f.filename:
        raise BadRequest("Choose a file.")
    ext = Path(f.filename).suffix.lower()
    if ext not in MIMES or f.mimetype != MIMES[ext][0]:
        raise BadRequest("Choose a supported file type with a matching extension.")
    data = f.read(8 * 1024 * 1024 + 1)
    if len(data) > 8 * 1024 * 1024:
        raise RequestEntityTooLarge("Upload files up to 8 MB.")
    width = height = None
    if ext == ".svg":
        data = safe_svg(data)
    elif ext == ".pdf":
        if (
            request.form.get("purpose") != "profile"
            or not data.startswith(b"%PDF-")
            or b"%%EOF" not in data[-2048:]
        ):
            raise BadRequest("Select a PDF corporate profile.")
    else:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(data)) as raw:
                    if (
                        raw.format != MIMES[ext][1]
                        or raw.width * raw.height > 24_000_000
                        or getattr(raw, "n_frames", 1) != 1
                    ):
                        raise BadRequest("Use a still image up to 24 megapixels.")
                    raw.load()
                    im = ImageOps.exif_transpose(raw)
                    im.thumbnail((3000, 3000))
                    width, height = im.size
                    out = io.BytesIO()
                    if request.form.get("purpose") == "logo":
                        im.convert("RGBA").save(out, "PNG", optimize=True)
                        ext = ".png"
                    else:
                        im.convert(
                            "RGBA" if "A" in im.getbands() or "transparency" in im.info else "RGB"
                        ).save(out, "WEBP", quality=86)
                        ext = ".webp"
                    data = out.getvalue()
        except (
            OSError,
            ValueError,
            UnidentifiedImageError,
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
        ) as exc:
            raise BadRequest("The image could not be decoded.") from exc
    name = uuid.uuid4().hex + ext
    directory = Path(current_app.config["MEDIA_DIR"])
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / name
    url = "/media/" + name
    path.write_bytes(data)
    try:
        db().media_assets.insert_one(
            {
                "url": url,
                "stored_name": name,
                "mime": MIMES[ext][0],
                "width": width,
                "height": height,
                "created_at": now(),
                "size": len(data),
            }
        )
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return {"url": url, "width": width, "height": height}, 201


def used(url, *, published_only=True):
    queries = [("site_settings", {"$or": [{"logo": url}, {"profile_file": url}]})]
    for kind, path in [("founder", "portrait"), ("approach", "stages.image")]:
        fields = ["published"] if published_only else ["draft", "published"]
        queries.append((kind, {"$or": [{f"{f}.{path}": url} for f in fields]}))
    for coll in ("articles", "case_studies", "products"):
        query = {"$or": [{"cover": url}, {"gallery.url": url}, {"inline_media": url}]}
        if published_only:
            query["status"] = "published"
        queries.append((coll, query))
    return any(db()[coll].find_one(query, {"_id": 1}) for coll, query in queries)


@media.get("/media/<name>")
def serve(name):
    if not re.fullmatch(r"[a-f0-9]{32}\.(png|webp|svg|jpg|pdf)", name):
        raise NotFound()
    url = "/media/" + name
    public = used(url)
    if not public and not current_user():
        raise NotFound()
    response = send_from_directory(
        current_app.config["MEDIA_DIR"],
        name,
        as_attachment=name.endswith(".pdf"),
        download_name="SRI-Corporate-Profile.pdf" if name.endswith(".pdf") else name,
    )
    response.headers["Cache-Control"] = (
        "public, max-age=0, must-revalidate" if public else "private, no-store"
    )
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    )
    return response
