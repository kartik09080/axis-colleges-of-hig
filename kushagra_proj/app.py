"""
app.py - Axis Drive: a Google Drive + Google Photos style cloud storage app.

Features
  * Sign up / log in (passwords are hashed, never stored as plain text)
  * Upload files (drag & drop or button), folders, rename, move
  * Photos view (timeline by date), thumbnails, preview of images/videos/PDF/audio
  * Starred files, search, trash (restore or delete forever), storage quota
  * Share links (anyone with the link can view/download, owner can revoke)

Run it:      python app.py          then open http://localhost:8000
Tests:       python -m unittest discover -s tests
"""
import mimetypes
import os
import re
import secrets
import time
import uuid
from datetime import timedelta
from functools import wraps

from flask import Flask, abort, g, jsonify, request, send_file, session
from werkzeug.security import check_password_hash, generate_password_hash

import db
import media

APP_DIR = os.path.dirname(os.path.abspath(__file__))
GB = 1024 ** 3
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$')

# Login protection: after 5 wrong passwords, the email is locked for 15 minutes.
LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_MAX_FAILURES = 5
_login_failures = {}


# ---------------------------------------------------------------------------
# Small helper functions
# ---------------------------------------------------------------------------

def err(message, code=400):
    """Send an error to the browser as JSON, e.g. {"error": "..."}."""
    return jsonify(error=message), code


def clean_name(value, fallback=''):
    """Remove folder parts, control characters and extra length from a name."""
    name = os.path.basename(str(value or '').replace('\\', '/')).strip()
    name = re.sub(r'[\x00-\x1f\x7f]', '', name)[:200].strip()
    return name or fallback


def parse_folder_ref(value):
    """'root', '', None -> None (My Drive). A number -> that folder id."""
    if value in (None, '', 'root', 'null'):
        return None
    return int(value)  # raises ValueError if it is not a number


def like_escape(text):
    """Escape %, _ and ! so a search for '100%' matches exactly that text."""
    return text.replace('!', '!!').replace('%', '!%').replace('_', '!_')


def file_path(user_id, stored_name):
    return os.path.join(db_path_dir(), 'files', str(user_id), stored_name)


def thumb_path(user_id, stored_name):
    return os.path.join(db_path_dir(), 'thumbs', str(user_id), stored_name + '.jpg')


def db_path_dir():
    from flask import current_app
    return current_app.config['DATA_DIR']


def remove_blobs(user_id, stored_name):
    """Delete the real file and its thumbnail from disk (missing files are ignored)."""
    for path in (file_path(user_id, stored_name), thumb_path(user_id, stored_name)):
        try:
            os.remove(path)
        except OSError:
            pass


def load_user(user_id):
    return db.get_db().execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()


def used_bytes(user_id):
    row = db.get_db().execute(
        'SELECT COALESCE(SUM(size), 0) AS total FROM files WHERE user_id = ?', (user_id,)
    ).fetchone()
    return row['total']


def user_payload(row):
    return {
        'id': row['id'],
        'name': row['name'],
        'email': row['email'],
        'quota': row['quota_bytes'],
        'used': used_bytes(row['id']),
    }


def serialize_file(row):
    return {
        'type': 'file',
        'id': row['id'],
        'name': row['name'],
        'kind': row['kind'],
        'mime': row['mime'],
        'size': row['size'],
        'folder_id': row['folder_id'],
        'created_at': row['created_at'],
        'taken_at': row['taken_at'],
        'starred': bool(row['starred']),
        'has_thumb': bool(row['has_thumb']),
        'trashed_at': row['trashed_at'],
        'share_token': row['share_token'],
    }


def serialize_folder(row):
    return {
        'type': 'folder',
        'id': row['id'],
        'name': row['name'],
        'parent_id': row['parent_id'],
        'created_at': row['created_at'],
        'trashed_at': row['trashed_at'],
    }


def owned_file(file_id, include_trashed=False):
    sql = 'SELECT * FROM files WHERE id = ? AND user_id = ?'
    if not include_trashed:
        sql += ' AND trashed_at IS NULL'
    return db.get_db().execute(sql, (file_id, g.user['id'])).fetchone()


def owned_folder(folder_id, include_trashed=False):
    sql = 'SELECT * FROM folders WHERE id = ? AND user_id = ?'
    if not include_trashed:
        sql += ' AND trashed_at IS NULL'
    return db.get_db().execute(sql, (folder_id, g.user['id'])).fetchone()


def breadcrumb(folder):
    """List of folders from My Drive down to this folder, for the path bar."""
    crumbs = []
    current = folder
    while current is not None:
        crumbs.append({'id': current['id'], 'name': current['name']})
        if current['parent_id']:
            current = db.get_db().execute(
                'SELECT * FROM folders WHERE id = ? AND user_id = ?',
                (current['parent_id'], g.user['id'])).fetchone()
        else:
            current = None
    return list(reversed(crumbs))


def descendant_folder_ids(folder_id):
    """Ids of all subfolders (at any depth) of a folder."""
    conn = db.get_db()
    found = []
    queue = [folder_id]
    while queue:
        parent = queue.pop()
        rows = conn.execute(
            'SELECT id FROM folders WHERE user_id = ? AND parent_id = ?',
            (g.user['id'], parent)).fetchall()
        for row in rows:
            found.append(row['id'])
            queue.append(row['id'])
    return found


def trash_folder_tree(folder_id, stamp):
    """Move a folder, all its subfolders and their files into the trash."""
    conn = db.get_db()
    uid = g.user['id']
    ids = [folder_id]
    i = 0
    while i < len(ids):
        rows = conn.execute(
            'SELECT id FROM folders WHERE user_id = ? AND parent_id = ? AND trashed_at IS NULL',
            (uid, ids[i])).fetchall()
        ids.extend(row['id'] for row in rows)
        i += 1
    marks = ','.join('?' * len(ids))
    conn.execute(f'UPDATE folders SET trashed_at = ? WHERE user_id = ? AND id IN ({marks})',
                 [stamp, uid, *ids])
    conn.execute(
        f'UPDATE files SET trashed_at = ? WHERE user_id = ? AND trashed_at IS NULL '
        f'AND folder_id IN ({marks})', [stamp, uid, *ids])


def restore_folder_tree(folder):
    """Bring back a trashed folder with the items that were trashed with it."""
    conn = db.get_db()
    uid = g.user['id']
    stamp = folder['trashed_at']
    ids = [folder['id']]
    i = 0
    while i < len(ids):
        rows = conn.execute(
            'SELECT id FROM folders WHERE user_id = ? AND parent_id = ? AND trashed_at = ?',
            (uid, ids[i], stamp)).fetchall()
        ids.extend(row['id'] for row in rows)
        i += 1
    marks = ','.join('?' * len(ids))
    conn.execute(f'UPDATE folders SET trashed_at = NULL WHERE user_id = ? AND id IN ({marks})',
                 [uid, *ids])
    conn.execute(
        f'UPDATE files SET trashed_at = NULL WHERE user_id = ? AND trashed_at = ? '
        f'AND folder_id IN ({marks})', [uid, stamp, *ids])
    # If the parent folder is still in the trash, put this folder back in My Drive
    if folder['parent_id']:
        parent = conn.execute('SELECT trashed_at FROM folders WHERE id = ? AND user_id = ?',
                              (folder['parent_id'], uid)).fetchone()
        if parent is not None and parent['trashed_at'] is not None:
            conn.execute('UPDATE folders SET parent_id = NULL WHERE id = ?', (folder['id'],))


def purge_folder(folder_id):
    """Delete a folder forever, with everything inside it (files are removed from disk)."""
    conn = db.get_db()
    uid = g.user['id']
    ids = [folder_id] + descendant_folder_ids(folder_id)
    marks = ','.join('?' * len(ids))
    for row in conn.execute(
            f'SELECT stored_name FROM files WHERE user_id = ? AND folder_id IN ({marks})',
            [uid, *ids]).fetchall():
        remove_blobs(uid, row['stored_name'])
    conn.execute(f'DELETE FROM files WHERE user_id = ? AND folder_id IN ({marks})', [uid, *ids])
    conn.execute(f'DELETE FROM folders WHERE user_id = ? AND id IN ({marks})', [uid, *ids])


def send_stored(row, as_download):
    """Send a stored file. Safe types open in the browser, the rest are downloaded."""
    path = file_path(row['user_id'], row['stored_name'])
    if not os.path.exists(path):
        abort(404)
    inline = (not as_download) and media.is_inline_safe(row['mime'])
    response = send_file(path, mimetype=row['mime'], as_attachment=not inline,
                         download_name=row['name'], conditional=True)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    if not inline:
        response.headers['Content-Security-Policy'] = 'sandbox'
    return response


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

def create_app(test_config=None):
    app = Flask(__name__, static_folder=os.path.join(APP_DIR, 'static'), static_url_path='')

    data_dir = os.environ.get('DRIVE_DATA_DIR') or os.path.join(APP_DIR, 'data_store')
    app.config.from_mapping(
        DATA_DIR=data_dir,
        SECRET_KEY=os.environ.get('DRIVE_SECRET_KEY'),
        MAX_CONTENT_LENGTH=int(os.environ.get('DRIVE_MAX_UPLOAD_MB', '2048')) * 1024 * 1024,
        DEFAULT_QUOTA=int(float(os.environ.get('DRIVE_QUOTA_GB', '15')) * GB),
        SESSION_COOKIE_HTTPONLY=True,
        # On HTTPS the cookie must allow cross-site use: the app is often shown inside
        # another site's frame (e.g. a preview), and SameSite=Lax would drop the login there.
        # Changing data still needs the X-Drive-Client header, which blocks cross-site forms.
        SESSION_COOKIE_SAMESITE='None' if os.environ.get('DRIVE_COOKIE_SECURE') == '1' else 'Lax',
        SESSION_COOKIE_SECURE=os.environ.get('DRIVE_COOKIE_SECURE') == '1',
        PERMANENT_SESSION_LIFETIME=timedelta(days=14),
    )
    if test_config:
        app.config.update(test_config)

    # Make sure the storage folders exist
    os.makedirs(app.config['DATA_DIR'], exist_ok=True)

    # The secret key signs the login cookie. If none is given, create one once and keep it.
    if not app.config['SECRET_KEY']:
        key_file = os.path.join(app.config['DATA_DIR'], 'secret.key')
        if not os.path.exists(key_file):
            with open(key_file, 'w', encoding='utf-8') as fh:
                fh.write(secrets.token_hex(32))
        with open(key_file, encoding='utf-8') as fh:
            app.config['SECRET_KEY'] = fh.read().strip()

    db.init_app(app)
    with app.app_context():
        db.init_db()

    # -----------------------------------------------------------------------
    # Security checks run before every request
    # -----------------------------------------------------------------------

    @app.before_request
    def require_client_header():
        """Changing data needs a special header. Other websites can not add it,
        so this protects against CSRF (a malicious site making your browser act)."""
        if request.path.startswith('/api/') and request.method not in ('GET', 'HEAD', 'OPTIONS'):
            if request.headers.get('X-Drive-Client') != '1':
                return err('Request blocked: missing client header.', 403)
        return None

    @app.errorhandler(413)
    def file_too_large(_e):
        limit_mb = app.config['MAX_CONTENT_LENGTH'] // (1024 * 1024)
        return err(f'File is too large. The maximum upload size is {limit_mb} MB.', 413)

    @app.errorhandler(404)
    def not_found(_e):
        if request.path.startswith('/api/'):
            return err('Not found.', 404)
        return ('<h1>404 - Page not found</h1><p><a href="/">Go to Axis Drive</a></p>', 404)

    def login_required(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            uid = session.get('uid')
            user = load_user(uid) if uid else None
            if user is None:
                return err('Please log in first.', 401)
            g.user = user
            return view(*args, **kwargs)
        return wrapper

    # -----------------------------------------------------------------------
    # Pages
    # -----------------------------------------------------------------------

    @app.get('/')
    def home_page():
        return app.send_static_file('index.html')

    @app.get('/s/<token>')
    def share_page(token):
        return app.send_static_file('share.html')

    # -----------------------------------------------------------------------
    # Account: sign up, log in, log out
    # -----------------------------------------------------------------------

    @app.post('/api/signup')
    def signup():
        data = request.get_json(silent=True) or {}
        name = clean_name(data.get('name'))[:80]
        email = str(data.get('email') or '').strip().lower()
        password = str(data.get('password') or '')
        if len(name) < 2:
            return err('Please enter your name.')
        if not EMAIL_RE.match(email):
            return err('Please enter a valid email address.')
        if len(password) < 8:
            return err('Password must be at least 8 characters.')
        conn = db.get_db()
        if conn.execute('SELECT 1 FROM users WHERE email = ?', (email,)).fetchone():
            return err('This email is already registered. Please log in.', 409)
        cur = conn.execute(
            'INSERT INTO users (name, email, password_hash, quota_bytes, created_at) VALUES (?, ?, ?, ?, ?)',
            (name, email, generate_password_hash(password), app.config['DEFAULT_QUOTA'], db.now_iso()))
        conn.commit()
        session.clear()
        session.permanent = True
        session['uid'] = cur.lastrowid
        return jsonify(user_payload(load_user(cur.lastrowid))), 201

    @app.post('/api/login')
    def login():
        data = request.get_json(silent=True) or {}
        email = str(data.get('email') or '').strip().lower()
        password = str(data.get('password') or '')
        now = time.time()
        recent = [t for t in _login_failures.get(email, []) if now - t < LOGIN_WINDOW_SECONDS]
        if len(recent) >= LOGIN_MAX_FAILURES:
            return err('Too many failed attempts. Please try again after 15 minutes.', 429)
        row = db.get_db().execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        if row is None or not check_password_hash(row['password_hash'], password):
            recent.append(now)
            _login_failures[email] = recent
            return err('Wrong email or password.', 401)
        _login_failures.pop(email, None)
        session.clear()
        session.permanent = True
        session['uid'] = row['id']
        return jsonify(user_payload(row))

    @app.post('/api/logout')
    def logout():
        session.clear()
        return jsonify(ok=True)

    @app.get('/api/me')
    def me():
        uid = session.get('uid')
        row = load_user(uid) if uid else None
        if row is None:
            return err('Not logged in.', 401)
        return jsonify(user_payload(row))

    # -----------------------------------------------------------------------
    # Folders
    # -----------------------------------------------------------------------

    @app.get('/api/list')
    @login_required
    def list_folder():
        """Everything inside one folder (or My Drive when folder=root)."""
        try:
            folder_id = parse_folder_ref(request.args.get('folder', 'root'))
        except ValueError:
            return err('Invalid folder.')
        folder = None
        crumbs = []
        if folder_id is not None:
            folder = owned_folder(folder_id)
            if folder is None:
                return err('Folder not found.', 404)
            crumbs = breadcrumb(folder)
        conn = db.get_db()
        uid = g.user['id']
        folders = conn.execute(
            'SELECT * FROM folders WHERE user_id = ? AND trashed_at IS NULL AND parent_id IS ? '
            'ORDER BY name COLLATE NOCASE', (uid, folder_id)).fetchall()
        files = conn.execute(
            'SELECT * FROM files WHERE user_id = ? AND trashed_at IS NULL AND folder_id IS ? '
            'ORDER BY name COLLATE NOCASE', (uid, folder_id)).fetchall()
        return jsonify(
            folder=serialize_folder(folder) if folder else None,
            breadcrumb=crumbs,
            folders=[serialize_folder(f) for f in folders],
            files=[serialize_file(f) for f in files])

    @app.get('/api/folders/all')
    @login_required
    def all_folders():
        """Every folder with its full path, used by the 'Move to' dialog."""
        rows = db.get_db().execute(
            'SELECT * FROM folders WHERE user_id = ? AND trashed_at IS NULL', (g.user['id'],)).fetchall()
        by_id = {r['id']: r for r in rows}

        def path_of(row):
            names = [row['name']]
            parent = by_id.get(row['parent_id'])
            while parent is not None:
                names.append(parent['name'])
                parent = by_id.get(parent['parent_id'])
            return ' / '.join(reversed(names))

        items = [{'id': r['id'], 'path': path_of(r)} for r in rows]
        items.sort(key=lambda x: x['path'].lower())
        return jsonify(folders=items)

    @app.post('/api/folders')
    @login_required
    def create_folder():
        data = request.get_json(silent=True) or {}
        name = clean_name(data.get('name'))
        if not name:
            return err('Please enter a folder name.')
        try:
            parent_id = parse_folder_ref(data.get('parent_id'))
        except ValueError:
            return err('Invalid folder.')
        if parent_id is not None and owned_folder(parent_id) is None:
            return err('Parent folder not found.', 404)
        conn = db.get_db()
        cur = conn.execute(
            'INSERT INTO folders (user_id, parent_id, name, created_at) VALUES (?, ?, ?, ?)',
            (g.user['id'], parent_id, name, db.now_iso()))
        conn.commit()
        return jsonify(serialize_folder(owned_folder(cur.lastrowid))), 201

    @app.patch('/api/folders/<int:folder_id>')
    @login_required
    def update_folder(folder_id):
        folder = owned_folder(folder_id)
        if folder is None:
            return err('Folder not found.', 404)
        data = request.get_json(silent=True) or {}
        conn = db.get_db()
        if 'name' in data:
            name = clean_name(data.get('name'))
            if not name:
                return err('Please enter a folder name.')
            conn.execute('UPDATE folders SET name = ? WHERE id = ?', (name, folder_id))
        if 'parent_id' in data:
            try:
                parent_id = parse_folder_ref(data.get('parent_id'))
            except ValueError:
                return err('Invalid folder.')
            if parent_id == folder_id:
                return err('A folder cannot be moved into itself.')
            if parent_id is not None:
                if owned_folder(parent_id) is None:
                    return err('Destination folder not found.', 404)
                if parent_id in descendant_folder_ids(folder_id):
                    return err('A folder cannot be moved into its own subfolder.')
            conn.execute('UPDATE folders SET parent_id = ? WHERE id = ?', (parent_id, folder_id))
        conn.commit()
        return jsonify(serialize_folder(owned_folder(folder_id)))

    @app.delete('/api/folders/<int:folder_id>')
    @login_required
    def delete_folder(folder_id):
        folder = owned_folder(folder_id, include_trashed=True)
        if folder is None:
            return err('Folder not found.', 404)
        if request.args.get('permanent') == '1':
            purge_folder(folder_id)
        elif folder['trashed_at'] is None:
            trash_folder_tree(folder_id, db.trash_stamp())
        db.get_db().commit()
        return jsonify(ok=True)

    # -----------------------------------------------------------------------
    # Files
    # -----------------------------------------------------------------------

    @app.post('/api/files')
    @login_required
    def upload_file():
        upload = request.files.get('file')
        if upload is None or not upload.filename:
            return err('No file selected.')
        try:
            folder_id = parse_folder_ref(request.form.get('folder_id'))
        except ValueError:
            return err('Invalid folder.')
        if folder_id is not None and owned_folder(folder_id) is None:
            return err('Folder not found.', 404)

        uid = g.user['id']
        quota = g.user['quota_bytes']
        used = used_bytes(uid)
        if used + (request.content_length or 0) > quota:
            return err('Not enough storage space. Delete some files or empty the trash.', 413)

        name = clean_name(upload.filename, 'Untitled')
        ext = os.path.splitext(name)[1].lower()
        ext = ext if re.match(r'^\.[a-z0-9]{1,10}$', ext) else ''
        stored_name = uuid.uuid4().hex + ext
        path = file_path(uid, stored_name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        upload.save(path)
        size = os.path.getsize(path)
        if used + size > quota:
            os.remove(path)
            return err('Not enough storage space. Delete some files or empty the trash.', 413)

        mime = mimetypes.guess_type(name)[0] or upload.mimetype or 'application/octet-stream'
        kind = media.detect_kind(mime)
        taken_at = None
        has_thumb = 0
        if kind == 'image':
            taken_at = media.read_taken_at(path)
            has_thumb = 1 if media.make_thumbnail(path, thumb_path(uid, stored_name)) else 0

        conn = db.get_db()
        cur = conn.execute(
            'INSERT INTO files (user_id, folder_id, name, stored_name, mime, kind, size, has_thumb, '
            'taken_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (uid, folder_id, name, stored_name, mime, kind, size, has_thumb, taken_at, db.now_iso()))
        conn.commit()
        return jsonify(serialize_file(owned_file(cur.lastrowid, include_trashed=True))), 201

    @app.get('/api/files/<int:file_id>/content')
    @login_required
    def file_content(file_id):
        row = owned_file(file_id)
        if row is None:
            return err('File not found.', 404)
        return send_stored(row, as_download=request.args.get('download') == '1')

    @app.get('/api/files/<int:file_id>/thumb')
    @login_required
    def file_thumb(file_id):
        row = owned_file(file_id)
        if row is None or not row['has_thumb']:
            return err('No preview.', 404)
        path = thumb_path(row['user_id'], row['stored_name'])
        if not os.path.exists(path):
            return err('No preview.', 404)
        response = send_file(path, mimetype='image/jpeg')
        response.headers['Cache-Control'] = 'private, max-age=3600'
        return response

    @app.patch('/api/files/<int:file_id>')
    @login_required
    def update_file(file_id):
        """Rename, move to another folder, or star / unstar."""
        row = owned_file(file_id)
        if row is None:
            return err('File not found.', 404)
        data = request.get_json(silent=True) or {}
        changes = {}
        if 'name' in data:
            name = clean_name(data.get('name'))
            if not name:
                return err('Please enter a file name.')
            changes['name'] = name
        if 'starred' in data:
            changes['starred'] = 1 if data.get('starred') else 0
        if 'folder_id' in data:
            try:
                folder_id = parse_folder_ref(data.get('folder_id'))
            except ValueError:
                return err('Invalid folder.')
            if folder_id is not None and owned_folder(folder_id) is None:
                return err('Destination folder not found.', 404)
            changes['folder_id'] = folder_id
        if changes:
            assignments = ', '.join(f'{column} = ?' for column in changes)  # column names are fixed above
            conn = db.get_db()
            conn.execute(f'UPDATE files SET {assignments} WHERE id = ? AND user_id = ?',
                         [*changes.values(), file_id, g.user['id']])
            conn.commit()
        return jsonify(serialize_file(owned_file(file_id, include_trashed=True)))

    @app.delete('/api/files/<int:file_id>')
    @login_required
    def delete_file(file_id):
        row = owned_file(file_id, include_trashed=True)
        if row is None:
            return err('File not found.', 404)
        conn = db.get_db()
        if request.args.get('permanent') == '1':
            remove_blobs(row['user_id'], row['stored_name'])
            conn.execute('DELETE FROM files WHERE id = ?', (file_id,))
        elif row['trashed_at'] is None:
            conn.execute('UPDATE files SET trashed_at = ? WHERE id = ?', (db.trash_stamp(), file_id))
        conn.commit()
        return jsonify(ok=True)

    @app.post('/api/files/<int:file_id>/share')
    @login_required
    def create_share(file_id):
        row = owned_file(file_id)
        if row is None:
            return err('File not found.', 404)
        token = row['share_token'] or secrets.token_urlsafe(18)
        conn = db.get_db()
        conn.execute('UPDATE files SET share_token = ? WHERE id = ?', (token, file_id))
        conn.commit()
        return jsonify(share_token=token, share_path=f'/s/{token}')

    @app.delete('/api/files/<int:file_id>/share')
    @login_required
    def revoke_share(file_id):
        row = owned_file(file_id)
        if row is None:
            return err('File not found.', 404)
        conn = db.get_db()
        conn.execute('UPDATE files SET share_token = NULL WHERE id = ?', (file_id,))
        conn.commit()
        return jsonify(ok=True)

    # -----------------------------------------------------------------------
    # Views: Photos, Starred, Search, Trash
    # -----------------------------------------------------------------------

    @app.get('/api/photos')
    @login_required
    def photos():
        rows = db.get_db().execute(
            "SELECT * FROM files WHERE user_id = ? AND trashed_at IS NULL AND kind IN ('image', 'video') "
            "ORDER BY COALESCE(taken_at, created_at) DESC", (g.user['id'],)).fetchall()
        return jsonify(files=[serialize_file(r) for r in rows])

    @app.get('/api/starred')
    @login_required
    def starred():
        rows = db.get_db().execute(
            'SELECT * FROM files WHERE user_id = ? AND starred = 1 AND trashed_at IS NULL '
            'ORDER BY name COLLATE NOCASE', (g.user['id'],)).fetchall()
        return jsonify(files=[serialize_file(r) for r in rows])

    @app.get('/api/search')
    @login_required
    def search():
        query = (request.args.get('q') or '').strip()
        if not query:
            return jsonify(folders=[], files=[])
        pattern = f'%{like_escape(query)}%'
        conn = db.get_db()
        uid = g.user['id']
        folders = conn.execute(
            "SELECT * FROM folders WHERE user_id = ? AND trashed_at IS NULL AND name LIKE ? ESCAPE '!' "
            "ORDER BY name COLLATE NOCASE LIMIT 100", (uid, pattern)).fetchall()
        files = conn.execute(
            "SELECT * FROM files WHERE user_id = ? AND trashed_at IS NULL AND name LIKE ? ESCAPE '!' "
            "ORDER BY name COLLATE NOCASE LIMIT 100", (uid, pattern)).fetchall()
        return jsonify(folders=[serialize_folder(f) for f in folders],
                       files=[serialize_file(f) for f in files])

    @app.get('/api/trash')
    @login_required
    def trash():
        """Top-level trashed items only (items inside a trashed folder come with it)."""
        conn = db.get_db()
        uid = g.user['id']
        trashed_folders = conn.execute(
            'SELECT * FROM folders WHERE user_id = ? AND trashed_at IS NOT NULL AND '
            '(parent_id IS NULL OR parent_id NOT IN '
            '(SELECT id FROM folders WHERE user_id = ? AND trashed_at IS NOT NULL)) '
            'ORDER BY trashed_at DESC', (uid, uid)).fetchall()
        trashed_files = conn.execute(
            'SELECT * FROM files WHERE user_id = ? AND trashed_at IS NOT NULL AND '
            '(folder_id IS NULL OR folder_id NOT IN '
            '(SELECT id FROM folders WHERE user_id = ? AND trashed_at IS NOT NULL)) '
            'ORDER BY trashed_at DESC', (uid, uid)).fetchall()
        return jsonify(
            folders=[serialize_folder(f) for f in trashed_folders],
            files=[serialize_file(f) for f in trashed_files])

    @app.post('/api/trash/restore')
    @login_required
    def restore_from_trash():
        data = request.get_json(silent=True) or {}
        kind = data.get('type')
        try:
            item_id = int(data.get('id'))
        except (TypeError, ValueError):
            return err('Invalid item.')
        conn = db.get_db()
        if kind == 'folder':
            folder = owned_folder(item_id, include_trashed=True)
            if folder is None or folder['trashed_at'] is None:
                return err('Item not found in trash.', 404)
            restore_folder_tree(folder)
        elif kind == 'file':
            row = owned_file(item_id, include_trashed=True)
            if row is None or row['trashed_at'] is None:
                return err('Item not found in trash.', 404)
            folder_in_trash = False
            if row['folder_id'] is not None:
                parent = conn.execute('SELECT trashed_at FROM folders WHERE id = ?',
                                      (row['folder_id'],)).fetchone()
                folder_in_trash = parent is not None and parent['trashed_at'] is not None
            conn.execute('UPDATE files SET trashed_at = NULL, folder_id = ? WHERE id = ?',
                         (None if folder_in_trash else row['folder_id'], item_id))
        else:
            return err('Invalid item type.')
        conn.commit()
        return jsonify(ok=True)

    @app.post('/api/trash/empty')
    @login_required
    def empty_trash():
        conn = db.get_db()
        uid = g.user['id']
        for row in conn.execute(
                'SELECT id FROM folders WHERE user_id = ? AND trashed_at IS NOT NULL', (uid,)).fetchall():
            if conn.execute('SELECT 1 FROM folders WHERE id = ?', (row['id'],)).fetchone():
                purge_folder(row['id'])
        for row in conn.execute(
                'SELECT id, stored_name FROM files WHERE user_id = ? AND trashed_at IS NOT NULL',
                (uid,)).fetchall():
            remove_blobs(uid, row['stored_name'])
            conn.execute('DELETE FROM files WHERE id = ?', (row['id'],))
        conn.commit()
        return jsonify(ok=True)

    # -----------------------------------------------------------------------
    # Public share links (no login needed)
    # -----------------------------------------------------------------------

    @app.get('/api/public/<token>')
    def public_info(token):
        row = db.get_db().execute(
            'SELECT * FROM files WHERE share_token = ? AND trashed_at IS NULL', (token,)).fetchone()
        if row is None:
            return err('This link is invalid or has been removed.', 404)
        return jsonify(name=row['name'], kind=row['kind'], mime=row['mime'], size=row['size'],
                       inline=media.is_inline_safe(row['mime']), created_at=row['created_at'])

    @app.get('/api/public/<token>/content')
    def public_content(token):
        row = db.get_db().execute(
            'SELECT * FROM files WHERE share_token = ? AND trashed_at IS NULL', (token,)).fetchone()
        if row is None:
            return err('This link is invalid or has been removed.', 404)
        return send_stored(row, as_download=request.args.get('download') == '1')

    return app


app = create_app()

if __name__ == '__main__':
    host = os.environ.get('DRIVE_HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', '8000'))
    print(f'Axis Drive is running at http://localhost:{port}  (stop with Ctrl+C)')
    app.run(host=host, port=port, threaded=True, debug=False)
