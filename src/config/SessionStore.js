'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const session = require('express-session');
const Config = require('./Config');

class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    if (!fs.existsSync(Config.paths.data)) fs.mkdirSync(Config.paths.data, { recursive: true });
    const file = path.join(Config.paths.data, 'sessions.db');
    this._db = new Database(file);
    this._db.pragma('journal_mode = WAL');
    this._db.pragma('synchronous = NORMAL');
    this._db.pragma('busy_timeout = 5000');
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid        TEXT    PRIMARY KEY,
        sess       TEXT    NOT NULL,
        expired_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sess_exp ON sessions(expired_at);
    `);
    setInterval(() => {
      try { this._db.prepare('DELETE FROM sessions WHERE expired_at < ?').run(Date.now()); } catch {}
    }, 60_000).unref();
  }

  get(sid, cb) {
    try {
      const row = this._db.prepare(
        'SELECT sess FROM sessions WHERE sid = ? AND expired_at > ?'
      ).get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (e) { cb(e); }
  }

  set(sid, sess, cb) {
    try {
      const ttl = sess.cookie?.maxAge ?? (86400 * 30 * 1000);
      this._db.prepare(
        'INSERT OR REPLACE INTO sessions (sid, sess, expired_at) VALUES (?, ?, ?)'
      ).run(sid, JSON.stringify(sess), Date.now() + ttl);
      cb(null);
    } catch (e) { cb(e); }
  }

  destroy(sid, cb) {
    try {
      this._db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      cb(null);
    } catch (e) { cb(e); }
  }

  touch(sid, sess, cb) {
    try {
      const ttl = sess.cookie?.maxAge ?? (86400 * 30 * 1000);
      this._db.prepare(
        'UPDATE sessions SET expired_at = ? WHERE sid = ?'
      ).run(Date.now() + ttl, sid);
      cb(null);
    } catch (e) { cb(e); }
  }
}

module.exports = SqliteSessionStore;
