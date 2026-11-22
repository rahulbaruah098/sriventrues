"""Homepage industry showcase images, individually managed by authenticated staff."""
from flask import Blueprint
from werkzeug.exceptions import BadRequest, Conflict
from ..auth import admin_required
from ..core import CONTENT, db, media_url, now, payload, serialize, string, number

industry_images = Blueprint('industry_images', __name__)
ALLOWED = {item['slug'] for item in CONTENT['industries']}


def col():
    return db().homepage_industry_images


@industry_images.get('/api/public/industry-images')
def public_images():
    rows = col().find({'image': {'$ne': ''}}, {'slug': 1, 'image': 1, 'alt': 1, '_id': 0})
    return {'items': list(rows)}


@industry_images.get('/api/admin/industry-images')
@admin_required
def admin_images():
    return {'items': serialize(list(col().find({})))}


@industry_images.put('/api/admin/industry-images/<slug>')
@admin_required
def save_image(slug):
    if slug not in ALLOWED:
        raise BadRequest('Unknown industry.')
    data = payload()
    image = media_url(data.get('image', ''))
    if image.endswith('.svg') or image.endswith('.pdf'):
        raise BadRequest('Use a JPG, PNG or WebP image.')
    alt = string(data, 'alt', 220)
    version = number(data.get('version', 0), 'version', 0, 2_000_000_000)
    current = col().find_one({'slug': slug})
    if (current or {}).get('version', 0) != version:
        raise Conflict('This image was edited elsewhere. Reload and try again.')
    result = col().update_one(
        {'slug': slug, 'version': version} if current else {'slug': slug, 'version': {'$exists': False}},
        {'$set': {'image': image, 'alt': alt, 'updated_at': now()}, '$inc': {'version': 1}, '$setOnInsert': {'slug': slug}},
        upsert=not bool(current),
    )
    if not result.matched_count and not result.upserted_id:
        raise Conflict('This image was edited elsewhere. Reload and try again.')
    return serialize(col().find_one({'slug': slug}))
