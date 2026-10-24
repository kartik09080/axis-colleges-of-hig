"""
db.py - Database helpers (SQLite).

SQLite is a single file database that comes with Python, so no extra
database server is needed. The tables are:
  users   - people who have an account and their storage quota
  folders - folders (they can be nested, like a tree)
  files   - uploaded files (the file itself is stored on disk, see app.py)
"""
import os
import sqlite3
from datetime import datetime, timezone

from flask import current_app, g

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    quota_bytes   INTEGER NOT NULL,
    created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    parent_id  INTEGER REFERENCES folders(id),
    name       TEXT    NOT NULL,
    created_at TEXT    NOT NULL,
    trashed_at TEXT
);

CREATE TABLE IF NOT EXISTS files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    folder_id   INTEGER REFERENCES folders(id),
    name        TEXT    NOT NULL,
    stored_name TEXT    NOT NULL,
    mime        TEXT    NOT NULL,
    kind        TEXT    NOT NULL,
    size        INTEGER NOT NULL,
    has_thumb   INTEGER NOT NULL DEFAULT 0,
    taken_at    TEXT,
    created_at  TEXT    NOT NULL,
    starred     INTEGER NOT NULL DEFAULT 0,
    trashed_at  TEXT,
    share_token TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_files_folder   ON files(user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(user_id, parent_id);
"""


def now_iso():
    """Current UTC time as text, e.g. 2026-10-24T10:20:30Z."""
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def trash_stamp():
    """Time with microseconds. Used to group items moved to trash together."""
    return datetime.now(timezone.utc).isoformat()


def db_path():
    return os.path.join(current_app.config['DATA_DIR'], 'drive.db')


def get_db():
    """Open one database connection per web request (stored in flask.g)."""
    if 'db' not in g:
        conn = sqlite3.connect(db_path(), timeout=10)
        conn.row_factory = sqlite3.Row          # rows can be read like dictionaries
        conn.execute('PRAGMA foreign_keys = ON')
        g.db = conn
    return g.db


def close_db(_error=None):
    conn = g.pop('db', None)
    if conn is not None:
        conn.close()


def init_db():
    """Create the tables if they do not exist yet. Safe to run many times."""
    conn = sqlite3.connect(db_path())
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


def init_app(app):
    app.teardown_appcontext(close_db)
