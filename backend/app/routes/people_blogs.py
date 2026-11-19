"""CMS-driven team, consultant and blog modules (no change to existing articles)."""
import re
from flask import Blueprint, request
from werkzeug.exceptions import BadRequest, Conflict, NotFound
from ..auth import admin_required
from ..core import SLUG_RE, by_id, db, media_url, now, number, option, payload, paginated, search_filter, serialize, string
from ..richtext import sanitise, plain

people_blogs = Blueprint('people_blogs', __name__)
COLLECTIONS = {'team': 'team_members', 'consultants': 'consultants', 'blogs': 'blog_posts'}


def coll(kind):
    if kind not in COLLECTIONS:
        raise NotFound('Unknown content type.')
    return db()[COLLECTIONS[kind]]


def clean(kind, data):
    status = option(data.get('status', 'draft'), ['draft', 'published'], 'status')
    slug = string(data, 'slug', 160, required=True)
    if not SLUG_RE.fullmatch(slug):
        raise BadRequest('Use lowercase words and hyphens in the slug.')
    image = media_url(data.get('image', ''))
    doc = {
        'slug': slug, 'status': status,
        'name': string(data, 'name', 180, required=True) if kind != 'blogs' else '',
        'title': string(data, 'title', 220, required=True) if kind == 'blogs' else '',
        'designation': string(data, 'designation', 180) if kind != 'blogs' else '',
        'department': string(data, 'department', 120) if kind == 'team' else '',
        'expertise': string(data, 'expertise', 360) if kind == 'consultants' else '',
        'qualification': string(data, 'qualification', 400) if kind != 'blogs' else '',
        'experience': string(data, 'experience', 300) if kind == 'consultants' else '',
        'author': string(data, 'author', 150) if kind == 'blogs' else '',
        'category': string(data, 'category', 140) if kind == 'blogs' else '',
        'summary': string(data, 'summary', 1200),
        'image': image,
        'image_alt': string(data, 'image_alt', 350),
        'order': number(data.get('order', 0), 'display order', 0, 99999),
        'seo_title': string(data, 'seo_title', 160),
        'seo_description': string(data, 'seo_description', 400),
    }
    doc['body'], doc['inline_media'] = sanitise(string(data, 'body', 160000))
    if status == 'published':
        if image and not doc['image_alt']:
            raise BadRequest('Describe the photograph before publishing.')
        if kind == 'blogs' and (not doc['summary'] or not plain(doc['body'])):
            raise BadRequest('Published blogs need a summary and body.')
    return doc


def unique_slug(collection, slug, existing=None):
    found = collection.find_one({'slug': slug}, {'_id': 1})
    if found and found['_id'] != existing:
        raise Conflict('That URL slug is already used in this section.')


@people_blogs.get('/api/public/directory/<kind>')
def public_list(kind):
    collection = coll(kind)
    query = search_filter(['name', 'title', 'summary', 'designation', 'expertise', 'category'])
    query['status'] = 'published'
    return paginated(collection, query, [('order', 1), ('published_at', -1), ('_id', -1)], {'inline_media': 0})


@people_blogs.get('/api/public/directory/<kind>/<slug>')
def public_detail(kind, slug):
    row = coll(kind).find_one({'slug': slug, 'status': 'published'}, {'inline_media': 0})
    if not row:
        raise NotFound('This profile or article is unavailable.')
    return serialize(row)


@people_blogs.get('/api/admin/directory/<kind>')
@admin_required
def admin_list(kind):
    query = search_filter(['name', 'title', 'summary', 'designation', 'expertise', 'category'])
    if request.args.get('status'):
        query['status'] = option(request.args['status'], ['draft', 'published'], 'status')
    return paginated(coll(kind), query, [('updated_at', -1), ('_id', -1)], {'inline_media': 0, 'body': 0})


@people_blogs.get('/api/admin/directory/<kind>/<identifier>')
@admin_required
def admin_detail(kind, identifier):
    return serialize(by_id(coll(kind), identifier))


@people_blogs.post('/api/admin/directory/<kind>')
@admin_required
def create(kind):
    collection = coll(kind)
    doc = clean(kind, payload())
    unique_slug(collection, doc['slug'])
    date = now()
    doc.update(version=1, created_at=date, updated_at=date, published_at=date if doc['status'] == 'published' else None)
    result = collection.insert_one(doc)
    return serialize(collection.find_one({'_id': result.inserted_id})), 201


@people_blogs.put('/api/admin/directory/<kind>/<identifier>')
@admin_required
def update(kind, identifier):
    collection = coll(kind)
    current = by_id(collection, identifier)
    data = payload()
    version = number(data.get('version'), 'version', 1, 2_000_000_000)
    doc = clean(kind, data)
    unique_slug(collection, doc['slug'], current['_id'])
    if doc['status'] == 'published' and current.get('status') != 'published':
        doc['published_at'] = now()
    result = collection.update_one({'_id': current['_id'], 'version': version}, {'$set': {**doc, 'updated_at': now()}, '$inc': {'version': 1}})
    if not result.matched_count:
        raise Conflict('This record changed. Reload it before saving.')
    return serialize(collection.find_one({'_id': current['_id']}))


@people_blogs.delete('/api/admin/directory/<kind>/<identifier>')
@admin_required
def delete(kind, identifier):
    collection = coll(kind)
    current = by_id(collection, identifier)
    version = number(payload().get('version'), 'version', 1, 2_000_000_000)
    if not collection.delete_one({'_id': current['_id'], 'version': version}).deleted_count:
        raise Conflict('Record changed. Reload before deleting.')
    return {'ok': True}
