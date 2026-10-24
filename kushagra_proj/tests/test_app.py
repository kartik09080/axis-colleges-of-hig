"""Tests for Axis Drive. Run from the kushagra_proj folder:

    python -m unittest discover -s tests -v
"""
import io
import os
import shutil
import sys
import tempfile
import unittest

# Use a temporary data folder for every test run (set BEFORE importing the app)
_TMP = tempfile.mkdtemp(prefix='drive-test-')
os.environ['DRIVE_DATA_DIR'] = _TMP
os.environ.pop('DRIVE_SECRET_KEY', None)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from PIL import Image  # noqa: E402

import app as drive_app  # noqa: E402

H = {'X-Drive-Client': '1'}


def png_bytes(size=(64, 40), color=(200, 30, 30)):
    buf = io.BytesIO()
    Image.new('RGB', size, color).save(buf, 'PNG')
    return buf.getvalue()


def jpeg_with_date(stamp):
    buf = io.BytesIO()
    exif = Image.Exif()
    exif[0x8769] = {36867: stamp}          # DateTimeOriginal
    Image.new('RGB', (30, 30), (10, 120, 10)).save(buf, 'JPEG', exif=exif)
    return buf.getvalue()


class DriveTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data_dir = tempfile.mkdtemp(prefix='drive-case-')
        cls.app = drive_app.create_app({
            'TESTING': True,
            'DATA_DIR': cls.data_dir,
            'SECRET_KEY': 'test-secret',
            'DEFAULT_QUOTA': 10 * 1024 * 1024,   # 10 MB quota for the tests
        })

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.data_dir, ignore_errors=True)

    def setUp(self):
        self.client = self.app.test_client()
        self.counter = getattr(self, 'counter', 0)

    # helpers ------------------------------------------------------------
    def signup(self, email=None, password='secret-pass-1', name='Test User', client=None):
        client = client or self.client
        if email is None:
            DriveTestCase.counter = getattr(DriveTestCase, 'counter', 0) + 1
            email = f'user{DriveTestCase.counter}@example.com'
        res = client.post('/api/signup', json={'name': name, 'email': email, 'password': password}, headers=H)
        self.assertEqual(res.status_code, 201, res.get_json())
        return email

    def upload(self, data, name, folder_id='root', client=None, mime=None):
        client = client or self.client
        payload = {'file': (io.BytesIO(data), name, mime) if mime else (io.BytesIO(data), name),
                   'folder_id': str(folder_id)}
        return client.post('/api/files', data=payload, headers=H, content_type='multipart/form-data')

    def listing(self, folder='root', client=None):
        return (client or self.client).get(f'/api/list?folder={folder}').get_json()


class AuthTests(DriveTestCase):
    def test_signup_login_logout_me(self):
        email = self.signup('auth1@example.com')
        me = self.client.get('/api/me').get_json()
        self.assertEqual(me['email'], email)
        self.assertEqual(me['quota'], 10 * 1024 * 1024)
        self.client.post('/api/logout', headers=H)
        self.assertEqual(self.client.get('/api/me').status_code, 401)
        res = self.client.post('/api/login', json={'email': email, 'password': 'secret-pass-1'}, headers=H)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.client.get('/api/me').status_code, 200)

    def test_duplicate_email_rejected(self):
        self.signup('dup@example.com')
        res = self.app.test_client().post(
            '/api/signup', json={'name': 'Again', 'email': 'DUP@example.com', 'password': 'secret-pass-1'}, headers=H)
        self.assertEqual(res.status_code, 409)

    def test_validation(self):
        c = self.app.test_client()
        bad = [
            {'name': 'A', 'email': 'a@example.com', 'password': 'secret-pass-1'},   # name too short
            {'name': 'Ann', 'email': 'not-an-email', 'password': 'secret-pass-1'},
            {'name': 'Ann', 'email': 'ann@example.com', 'password': 'short'},
        ]
        for body in bad:
            self.assertEqual(c.post('/api/signup', json=body, headers=H).status_code, 400, body)

    def test_wrong_password(self):
        email = self.signup('wrongpw@example.com')
        res = self.app.test_client().post('/api/login', json={'email': email, 'password': 'nope-nope'}, headers=H)
        self.assertEqual(res.status_code, 401)

    def test_login_rate_limit(self):
        email = self.signup('limit@example.com')
        c = self.app.test_client()
        for _ in range(drive_app.LOGIN_MAX_FAILURES):
            c.post('/api/login', json={'email': email, 'password': 'bad-bad-bad'}, headers=H)
        res = c.post('/api/login', json={'email': email, 'password': 'secret-pass-1'}, headers=H)
        self.assertEqual(res.status_code, 429)
        drive_app._login_failures.clear()

    def test_api_requires_login(self):
        self.assertEqual(self.app.test_client().get('/api/list').status_code, 401)

    def test_csrf_header_required_for_changes(self):
        self.signup()
        res = self.client.post('/api/folders', json={'name': 'Nope'})   # no X-Drive-Client header
        self.assertEqual(res.status_code, 403)


class FolderTests(DriveTestCase):
    def test_create_rename_move_delete(self):
        self.signup()
        a = self.client.post('/api/folders', json={'name': 'Holiday'}, headers=H).get_json()
        b = self.client.post('/api/folders', json={'name': 'Inner', 'parent_id': a['id']}, headers=H).get_json()
        self.assertEqual(self.listing()['folders'][0]['name'], 'Holiday')
        self.assertEqual(self.listing(a['id'])['folders'][0]['name'], 'Inner')
        self.assertEqual(self.listing(b['id'])['breadcrumb'][0]['name'], 'Holiday')

        res = self.client.patch(f"/api/folders/{b['id']}", json={'name': 'Renamed'}, headers=H)
        self.assertEqual(res.get_json()['name'], 'Renamed')

        # moving a folder into itself or its child must fail
        self.assertEqual(self.client.patch(f"/api/folders/{a['id']}", json={'parent_id': a['id']}, headers=H).status_code, 400)
        self.assertEqual(self.client.patch(f"/api/folders/{a['id']}", json={'parent_id': b['id']}, headers=H).status_code, 400)

        # move Renamed to My Drive
        self.client.patch(f"/api/folders/{b['id']}", json={'parent_id': None}, headers=H)
        self.assertEqual(len(self.listing()['folders']), 2)

        self.assertEqual(self.client.delete(f"/api/folders/{a['id']}", headers=H).status_code, 200)
        self.assertEqual([f['name'] for f in self.listing()['folders']], ['Renamed'])

    def test_empty_name_rejected(self):
        self.signup()
        self.assertEqual(self.client.post('/api/folders', json={'name': '   '}, headers=H).status_code, 400)

    def test_path_characters_are_stripped(self):
        self.signup()
        res = self.client.post('/api/folders', json={'name': '../../etc/passwd'}, headers=H).get_json()
        self.assertEqual(res['name'], 'passwd')


class FileTests(DriveTestCase):
    def test_upload_thumbnail_and_download(self):
        self.signup()
        res = self.upload(png_bytes(), 'sunset.png')
        self.assertEqual(res.status_code, 201, res.get_json())
        item = res.get_json()
        self.assertEqual(item['kind'], 'image')
        self.assertTrue(item['has_thumb'])
        thumb = self.client.get(f"/api/files/{item['id']}/thumb")
        self.assertEqual(thumb.status_code, 200)
        self.assertEqual(thumb.mimetype, 'image/jpeg')
        content = self.client.get(f"/api/files/{item['id']}/content")
        self.assertEqual(content.status_code, 200)
        self.assertIn('inline', content.headers['Content-Disposition'])
        dl = self.client.get(f"/api/files/{item['id']}/content?download=1")
        self.assertIn('attachment', dl.headers['Content-Disposition'])
        self.assertIn('sunset.png', dl.headers['Content-Disposition'])

    def test_stored_name_is_random(self):
        self.signup()
        item = self.upload(png_bytes(), '../secret name.png').get_json()
        self.assertEqual(item['name'], 'secret name.png')
        path = os.path.join(self.data_dir, 'files', str(self.client.get('/api/me').get_json()['id']))
        names = os.listdir(path)
        self.assertEqual(len(names), 1)
        self.assertNotIn('secret', names[0])

    def test_html_upload_is_never_rendered_inline(self):
        self.signup()
        item = self.upload(b'<script>alert(1)</script>', 'evil.html', mime='text/html').get_json()
        res = self.client.get(f"/api/files/{item['id']}/content")
        self.assertIn('attachment', res.headers['Content-Disposition'])
        self.assertEqual(res.headers['Content-Security-Policy'], 'sandbox')
        self.assertEqual(res.headers['X-Content-Type-Options'], 'nosniff')

    def test_exif_date_is_read(self):
        self.signup()
        item = self.upload(jpeg_with_date('2024:05:01 10:20:30'), 'trip.jpg').get_json()
        self.assertEqual(item['taken_at'], '2024-05-01T10:20:30')
        photos = self.client.get('/api/photos').get_json()['files']
        self.assertEqual(photos[0]['id'], item['id'])

    def test_quota_is_enforced(self):
        self.signup()
        big = b'x' * (6 * 1024 * 1024)
        self.assertEqual(self.upload(big, 'one.bin').status_code, 201)
        res = self.upload(big, 'two.bin')
        self.assertEqual(res.status_code, 413)
        self.assertIn('Not enough storage', res.get_json()['error'])
        me = self.client.get('/api/me').get_json()
        self.assertEqual(me['used'], len(big))

    def test_rename_move_star(self):
        self.signup()
        folder = self.client.post('/api/folders', json={'name': 'Docs'}, headers=H).get_json()
        item = self.upload(b'hello', 'a.txt').get_json()
        res = self.client.patch(f"/api/files/{item['id']}", json={'name': 'b.txt', 'starred': True,
                                                                 'folder_id': folder['id']}, headers=H).get_json()
        self.assertEqual(res['name'], 'b.txt')
        self.assertTrue(res['starred'])
        self.assertEqual(res['folder_id'], folder['id'])
        self.assertEqual(len(self.listing()['files']), 0)
        self.assertEqual(self.listing(folder['id'])['files'][0]['name'], 'b.txt')
        starred = self.client.get('/api/starred').get_json()['files']
        self.assertEqual([f['name'] for f in starred], ['b.txt'])

    def test_search_by_name(self):
        self.signup()
        self.upload(b'1', 'Beach 100%.txt')
        self.upload(b'2', 'beach2.txt')
        self.upload(b'3', 'mountain.txt')
        self.client.post('/api/folders', json={'name': 'Beach trip'}, headers=H)
        res = self.client.get('/api/search?q=beach').get_json()
        self.assertEqual(sorted(f['name'] for f in res['files']), ['Beach 100%.txt', 'beach2.txt'])
        self.assertEqual([f['name'] for f in res['folders']], ['Beach trip'])
        # % and _ are literal characters in searches
        res = self.client.get('/api/search?q=100%25').get_json()
        self.assertEqual([f['name'] for f in res['files']], ['Beach 100%.txt'])
        self.assertEqual(self.client.get('/api/search?q=%25').get_json()['files'][0]['name'], 'Beach 100%.txt')
        self.assertEqual(len(self.client.get('/api/search?q=_').get_json()['files']), 0)

    def test_users_cannot_see_each_other(self):
        self.signup()
        item = self.upload(b'secret', 'private.txt').get_json()
        other = self.app.test_client()
        self.signup(client=other)
        self.assertEqual(other.get(f"/api/files/{item['id']}/content").status_code, 404)
        self.assertEqual(other.patch(f"/api/files/{item['id']}", json={'starred': True}, headers=H).status_code, 404)
        self.assertEqual(other.get('/api/search?q=private').get_json()['files'], [])


class TrashTests(DriveTestCase):
    def test_trash_restore_and_delete_forever(self):
        self.signup()
        item = self.upload(png_bytes(), 'p.png').get_json()
        self.client.delete(f"/api/files/{item['id']}", headers=H)
        self.assertEqual(self.listing()['files'], [])
        trash = self.client.get('/api/trash').get_json()
        self.assertEqual([f['name'] for f in trash['files']], ['p.png'])
        self.client.post('/api/trash/restore', json={'type': 'file', 'id': item['id']}, headers=H)
        self.assertEqual(len(self.listing()['files']), 1)

        self.client.delete(f"/api/files/{item['id']}", headers=H)
        stored = os.path.join(self.data_dir, 'files')
        before = sum(len(f) for _, _, f in os.walk(stored))
        self.client.delete(f"/api/files/{item['id']}?permanent=1", headers=H)
        after = sum(len(f) for _, _, f in os.walk(stored))
        self.assertEqual(after, before - 1)
        self.assertEqual(self.client.get('/api/trash').get_json()['files'], [])

    def test_folder_trash_keeps_children_together(self):
        self.signup()
        folder = self.client.post('/api/folders', json={'name': 'Work'}, headers=H).get_json()
        inside = self.upload(b'in', 'inside.txt', folder_id=folder['id']).get_json()
        earlier = self.upload(b'old', 'earlier.txt').get_json()
        self.client.delete(f"/api/files/{earlier['id']}", headers=H)           # trashed before the folder
        self.client.delete(f"/api/folders/{folder['id']}", headers=H)

        trash = self.client.get('/api/trash').get_json()
        self.assertEqual([f['name'] for f in trash['folders']], ['Work'])
        self.assertEqual([f['name'] for f in trash['files']], ['earlier.txt'])  # inside.txt is not listed separately
        self.assertEqual(self.listing()['folders'], [])

        self.client.post('/api/trash/restore', json={'type': 'folder', 'id': folder['id']}, headers=H)
        self.assertEqual([f['name'] for f in self.listing(folder['id'])['files']], ['inside.txt'])
        self.assertEqual(self.listing()['files'], [])                          # earlier.txt stayed in the trash
        self.assertEqual(inside['folder_id'], folder['id'])

    def test_restore_file_from_trashed_folder_goes_to_root(self):
        self.signup()
        folder = self.client.post('/api/folders', json={'name': 'Box'}, headers=H).get_json()
        item = self.upload(b'x', 'x.txt', folder_id=folder['id']).get_json()
        self.client.delete(f"/api/folders/{folder['id']}", headers=H)
        self.client.post('/api/trash/restore', json={'type': 'file', 'id': item['id']}, headers=H)
        self.assertEqual([f['name'] for f in self.listing()['files']], ['x.txt'])

    def test_empty_trash(self):
        self.signup()
        f1 = self.upload(b'1', 'one.txt').get_json()
        folder = self.client.post('/api/folders', json={'name': 'Gone'}, headers=H).get_json()
        self.upload(b'2', 'two.txt', folder_id=folder['id'])
        self.client.delete(f"/api/files/{f1['id']}", headers=H)
        self.client.delete(f"/api/folders/{folder['id']}", headers=H)
        self.client.post('/api/trash/empty', headers=H)
        trash = self.client.get('/api/trash').get_json()
        self.assertEqual(trash, {'folders': [], 'files': []})
        self.assertEqual(self.client.get('/api/me').get_json()['used'], 0)


class ShareTests(DriveTestCase):
    def test_share_view_and_revoke(self):
        self.signup()
        item = self.upload(png_bytes(), 'shared.png').get_json()
        token = self.client.post(f"/api/files/{item['id']}/share", headers=H).get_json()['share_token']
        self.assertGreaterEqual(len(token), 20)

        anon = self.app.test_client()
        info = anon.get(f'/api/public/{token}').get_json()
        self.assertEqual(info['name'], 'shared.png')
        self.assertTrue(info['inline'])
        self.assertEqual(anon.get(f'/api/public/{token}/content').status_code, 200)
        self.assertIn('attachment', anon.get(f'/api/public/{token}/content?download=1').headers['Content-Disposition'])

        page = anon.get(f'/s/{token}')
        self.assertEqual(page.status_code, 200)
        self.assertIn(b'Axis Drive', page.data)

        # creating again keeps the same link
        self.assertEqual(self.client.post(f"/api/files/{item['id']}/share", headers=H).get_json()['share_token'], token)

        self.client.delete(f"/api/files/{item['id']}/share", headers=H)
        self.assertEqual(anon.get(f'/api/public/{token}').status_code, 404)
        self.assertEqual(anon.get(f'/api/public/{token}/content').status_code, 404)

    def test_trashed_file_link_stops_working(self):
        self.signup()
        item = self.upload(b'data', 'doc.txt').get_json()
        token = self.client.post(f"/api/files/{item['id']}/share", headers=H).get_json()['share_token']
        self.client.delete(f"/api/files/{item['id']}", headers=H)
        self.assertEqual(self.app.test_client().get(f'/api/public/{token}').status_code, 404)

    def test_unknown_token(self):
        self.assertEqual(self.app.test_client().get('/api/public/does-not-exist').status_code, 404)


class PageTests(DriveTestCase):
    def test_pages_served(self):
        c = self.app.test_client()
        self.assertIn(b'Axis Drive', c.get('/').data)
        self.assertEqual(c.get('/app.js').status_code, 200)
        self.assertEqual(c.get('/style.css').status_code, 200)


if __name__ == '__main__':
    unittest.main()
