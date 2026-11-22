import io
from PIL import Image

def test_gallery_permissions_publication_and_optional_caption(env, staff):
    staff_client, headers = staff
    anon = env[0].test_client()
    data = io.BytesIO()
    Image.new('RGB', (90, 70), (100, 140, 170)).save(data, 'PNG')
    data.seek(0)
    uploaded = staff_client.post('/api/admin/media', headers=headers, data={'file': (data, 'photo.png', 'image/png')})
    assert uploaded.status_code == 201
    image = uploaded.json['url']
    assert anon.get(image).status_code == 404
    assert anon.get('/api/admin/gallery').status_code == 401
    assert anon.post('/api/admin/gallery', json={'image': image}).status_code == 401
    record = {'image': image, 'caption': '', 'alt': '', 'status': 'draft', 'order': 1}
    created = staff_client.post('/api/admin/gallery', headers=headers, json=record)
    assert created.status_code == 201, created.json
    assert anon.get('/api/public/gallery').json['total'] == 0
    assert anon.get(image).status_code == 404
    record.update({'status':'published', 'version':created.json['version']})
    changed = staff_client.put('/api/admin/gallery/' + created.json['id'], headers=headers, json=record)
    assert changed.status_code == 200, changed.json
    assert anon.get('/api/public/gallery').json['total'] == 1
    assert anon.get(image).status_code == 200
    stale = staff_client.put('/api/admin/gallery/' + created.json['id'], headers=headers, json=record)
    assert stale.status_code == 409
    removed = staff_client.delete('/api/admin/gallery/' + created.json['id'], headers=headers, json={'version':changed.json['version']})
    assert removed.status_code == 200
    assert anon.get('/api/public/gallery').json['total'] == 0
    assert anon.get(image).status_code == 404
