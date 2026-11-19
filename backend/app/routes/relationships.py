"""CMS for homepage clients, partners, and testimonials."""
from flask import Blueprint, request
from werkzeug.exceptions import BadRequest, Conflict, NotFound
from ..auth import admin_required
from ..core import by_id, db, http_url, media_url, now, number, option, paginated, payload, serialize, string

relationships = Blueprint('relationships', __name__)
COLLECTIONS = {'clients':'homepage_clients', 'partners':'homepage_partners', 'testimonials':'homepage_testimonials'}


def collection(kind):
    if kind not in COLLECTIONS:
        raise NotFound('Unknown homepage category.')
    return db()[COLLECTIONS[kind]]


def clean(kind, data):
    status = option(data.get('status','draft'), ['draft','published'], 'status')
    name = string(data, 'name', 180, required=True)
    image = media_url(data.get('image', ''))
    image_alt = string(data, 'image_alt', 220)
    website = string(data, 'website', 500)
    if website:
        website = http_url(website)
    if image and status == 'published' and not image_alt:
        image_alt = name
    doc = {
        'name':name, 'status':status, 'image':image, 'image_alt':image_alt,
        'order':number(data.get('order',0), 'display order',0,99999),
        'website':website if kind != 'testimonials' else '',
        'designation':string(data,'designation',180) if kind == 'testimonials' else '',
        'organisation':string(data,'organisation',180) if kind == 'testimonials' else '',
        'quote':string(data,'quote',2500) if kind == 'testimonials' else '',
    }
    if kind == 'testimonials' and status == 'published' and not doc['quote']:
        raise BadRequest('A published testimonial requires feedback text.')
    return doc


@relationships.get('/api/public/relationships/<kind>')
def public_list(kind):
    return paginated(collection(kind), {'status':'published'}, [('order',1),('published_at',-1),('_id',-1)])


@relationships.get('/api/admin/relationships/<kind>')
@admin_required
def admin_list(kind):
    query = {}
    if request.args.get('status'):
        query['status'] = option(request.args['status'], ['draft','published'], 'status')
    return paginated(collection(kind), query, [('order',1),('updated_at',-1),('_id',-1)])


@relationships.get('/api/admin/relationships/<kind>/<identifier>')
@admin_required
def admin_detail(kind, identifier):
    return serialize(by_id(collection(kind), identifier))


@relationships.post('/api/admin/relationships/<kind>')
@admin_required
def create(kind):
    c=collection(kind)
    doc=clean(kind,payload())
    dt=now()
    doc.update(version=1,created_at=dt,updated_at=dt,published_at=dt if doc['status']=='published' else None)
    result=c.insert_one(doc)
    return serialize(c.find_one({'_id':result.inserted_id})),201


@relationships.put('/api/admin/relationships/<kind>/<identifier>')
@admin_required
def update(kind,identifier):
    c=collection(kind)
    old=by_id(c,identifier)
    data=payload()
    version=number(data.get('version'),'version',1,2_000_000_000)
    doc=clean(kind,data)
    if doc['status']=='published' and old.get('status')!='published':
        doc['published_at']=now()
    result=c.update_one({'_id':old['_id'],'version':version},{'$set':{**doc,'updated_at':now()},'$inc':{'version':1}})
    if not result.matched_count:
        raise Conflict('This entry has changed. Reload before saving.')
    return serialize(c.find_one({'_id':old['_id']}))


@relationships.delete('/api/admin/relationships/<kind>/<identifier>')
@admin_required
def delete(kind,identifier):
    c=collection(kind)
    old=by_id(c,identifier)
    version=number(payload().get('version'),'version',1,2_000_000_000)
    if not c.delete_one({'_id':old['_id'],'version':version}).deleted_count:
        raise Conflict('This entry has changed. Reload before deleting.')
    return {'ok':True}
