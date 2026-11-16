import re
from html import unescape

import nh3

from .core import MEDIA_RE, media_url

TAGS = {
    "p",
    "h2",
    "h3",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "ul",
    "ol",
    "li",
    "blockquote",
    "a",
    "img",
    "br",
    "hr",
    "code",
    "pre",
}


def sanitise(value):
    def attribute(tag, key, val):
        if tag == "img" and key == "src":
            return val if MEDIA_RE.fullmatch(val) and not val.endswith(".pdf") else None
        if tag == "a" and key == "href":
            return (
                val
                if val.startswith(("https://", "http://", "mailto:", "/", "#"))
                and not val.startswith("//")
                else None
            )
        return val

    html = nh3.clean(
        value,
        tags=TAGS,
        attributes={"a": {"href", "title"}, "img": {"src", "alt"}},
        attribute_filter=attribute,
        url_schemes={"https", "http", "mailto"},
        link_rel="noopener noreferrer",
        clean_content_tags={"script", "style", "iframe", "object", "svg"},
    )
    urls = sorted(set(re.findall(r'<img\b[^>]*\bsrc="(/media/[^"]+)"', html)))
    for url in urls:
        media_url(url)
    return html, urls


def plain(html):
    return unescape(re.sub(r"<[^>]*>", " ", html)).strip()
