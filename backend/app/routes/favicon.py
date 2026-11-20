"""Public dynamic favicon and admin-managed favicon assets.

Uploads are resized, validated, and stored in MongoDB. Original upload is
retained as a normalized PNG for later re-cropping. No user-supplied filenames
or filesystem paths are trusted.
"""
from __future__ import annotations

import base64
import binascii
import io
from datetime import datetime, timezone
from pathlib import Path

from flask import Blueprint, jsonify, request, Response, current_app
from werkzeug.exceptions import BadRequest
from PIL import Image, ImageOps, UnidentifiedImageError

from ..auth import admin_required
from ..core import db

favicon = Blueprint('favicon_management', __name__)
MAX_B64 = 5_000_000
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PNG = ROOT / 'assets' / 'sri-favicon-default.png'
CHOICES = {'circle', 'square', 'rounded'}


def decode_image(value: str, *, label: str, limit: int = 3_000_000):
    if not isinstance(value, str) or len(value) > MAX_B64:
        raise BadRequest(f'{label} is too large. Use an image under 3 MB.')
    if ',' in value:
        prefix, value = value.split(',', 1)
        if not prefix.startswith('data:image/') or ';base64' not in prefix:
            raise BadRequest(f'{label} is not an image.')
    try:
        raw = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise BadRequest(f'Invalid {label} encoding.') from exc
    if not raw or len(raw) > limit:
        raise BadRequest(f'{label} must be smaller than {limit // 1_000_000} MB.')
    try:
        with Image.open(io.BytesIO(raw)) as input_image:
            if input_image.format not in {'PNG', 'JPEG', 'WEBP'}:
                raise BadRequest('Only PNG, JPG and WebP images are supported.')
            if input_image.width * input_image.height > 20_000_000:
                raise BadRequest('Image dimensions are too large.')
            image = ImageOps.exif_transpose(input_image).convert('RGBA')
        return image
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise BadRequest(f'Cannot read {label}.') from exc


def png_data(image, max_size=900):
    image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    image.save(out, 'PNG', optimize=True)
    return out.getvalue()


def default_bytes():
    return DEFAULT_PNG.read_bytes()


def active_document():
    return db().website_favicon.find_one({'_id': 'active'})


def metadata(doc):
    if not doc:
        return {'custom': False, 'revision': 0, 'shape': 'square', 'updated_at': None}
    return {'custom': True, 'revision': doc.get('revision', 1),
            'shape': doc.get('shape', 'square'),
            'updated_at': doc.get('updated_at').isoformat() if doc.get('updated_at') else None}


@favicon.get('/api/public/favicon')
def public_meta():
    response = jsonify(metadata(active_document()))
    response.headers['Cache-Control'] = 'no-store'
    return response


@favicon.get('/api/public/favicon/<int:size>.png')
def public_png(size):
    if size not in (16, 32, 48, 64, 180, 192, 512):
        raise BadRequest('Unsupported favicon size.')
    doc = active_document()
    # Stored cropped PNG is already sanitised. Generating each resolution at
    # request time removes the need for persistent files or external storage.
    raw = doc.get('cropped_png') if doc else default_bytes()
    with Image.open(io.BytesIO(raw)) as im:
        im = im.convert('RGBA').resize((size, size), Image.Resampling.LANCZOS)
        body = png_data(im, max_size=size)
    return Response(body, mimetype='image/png', headers={'Cache-Control': 'no-cache, max-age=0', 'X-Content-Type-Options': 'nosniff'})


@favicon.get('/api/admin/favicon')
@admin_required
def admin_get():
    doc = active_document()
    result = metadata(doc)
    # Source image is returned to authenticated administrators only.
    # Not available through /api/public/ endpoints.
    result['source_data'] = ('data:image/png;base64,' + base64.b64encode(doc['source_png']).decode('ascii')) if doc and doc.get('source_png') else None
    return jsonify(result)


@favicon.post('/api/admin/favicon/publish')
@favicon.put('/api/admin/favicon')
@admin_required
def admin_save():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise BadRequest('Upload an image and choose a crop shape.')
    shape = payload.get('shape')
    if shape not in CHOICES:
        raise BadRequest('Choose Circle, Square or Rounded Square.')
    source = decode_image(payload.get('source_data'), label='Original image')
    edited = decode_image(payload.get('cropped_data'), label='Cropped image')
    if abs(edited.width - edited.height) > 1 or edited.width < 64:
        raise BadRequest('The cropped favicon must be a square of at least 64px.')
    edited = edited.resize((512, 512), Image.Resampling.LANCZOS)
    # Enforce transparency outside the selected mask server-side, even if a
    # client bypasses the editor.
    if shape != 'square':
        from PIL import ImageDraw
        mask = Image.new('L', (512, 512), 0)
        d = ImageDraw.Draw(mask)
        if shape == 'circle':
            d.ellipse((0, 0, 511, 511), fill=255)
        else:
            d.rounded_rectangle((0, 0, 511, 511), radius=96, fill=255)
        a = edited.getchannel('A')
        from PIL import ImageChops
        edited.putalpha(ImageChops.multiply(a, mask))
    source_bytes = png_data(source, max_size=1000)
    edited_bytes = png_data(edited, max_size=512)
    if len(source_bytes) > 3_000_000 or len(edited_bytes) > 3_000_000:
        raise BadRequest('Image is too complex. Please choose a smaller photo.')
    previous = active_document() or {}
    revision = int(previous.get('revision', 0)) + 1
    now = datetime.now(timezone.utc)
    db().website_favicon.replace_one({'_id': 'active'}, {'_id': 'active', 'shape': shape,
        'revision': revision, 'updated_at': now,
        'source_png': source_bytes, 'cropped_png': edited_bytes}, upsert=True)
    return jsonify(metadata(active_document()))


@favicon.post('/api/admin/favicon/reset')
@admin_required
def admin_reset():
    db().website_favicon.delete_one({'_id': 'active'})
    return jsonify(metadata(None))
