'use strict';

const fs = require('fs');
const path = require('path');
const session = require('express-session');

class FileSessionStore extends session.Store {
  constructor(options = {}) {
    super(options);
    this._dir = options.path || path.resolve(__dirname, '..', '..', 'data', 'sessions');
    this._ttl = options.ttl || 30 * 24 * 60 * 60 * 1000; // 30 days default
    this._cleanupInterval = options.cleanupInterval || 60 * 60 * 1000; // 1h
    if (!fs.existsSync(this._dir)) fs.mkdirSync(this._dir, { recursive: true });
    this._cleanupTimer = setInterval(() => this._cleanup(), this._cleanupInterval);
    if (this._cleanupTimer.unref) this._cleanupTimer.unref();
  }

  _sid(sid) {
    return path.join(this._dir, sid.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
  }

  get(sid, callback) {
    try {
      const file = this._sid(sid);
      if (!fs.existsSync(file)) return callback(null, null);
      const raw = fs.readFileSync(file, 'utf-8');
      const data = JSON.parse(raw);
      if (data.expires && Date.now() > data.expires) {
        try { fs.unlinkSync(file); } catch {}
        return callback(null, null);
      }
      callback(null, data.session);
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sessionData, callback) {
    try {
      const file = this._sid(sid);
      const expires = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires).getTime()
        : Date.now() + this._ttl;
      const data = { session: sessionData, expires };
      fs.writeFile(file, JSON.stringify(data), 'utf-8', (err) => {
        if (err) return callback(err);
        callback(null);
      });
    } catch (err) {
      callback(err);
    }
  }

  touch(sid, sessionData, callback) {
    if (!callback && typeof sessionData === 'function') {
      callback = sessionData;
      sessionData = undefined;
    }
    this.get(sid, (err, data) => {
      if (err) return callback(err);
      if (!data) return callback(null);
      this.set(sid, sessionData || data, callback);
    });
  }

  destroy(sid, callback) {
    try {
      const file = this._sid(sid);
      if (fs.existsSync(file)) fs.unlinkSync(file);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  _cleanup() {
    try {
      const now = Date.now();
      const files = fs.readdirSync(this._dir);
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        try {
          const raw = fs.readFileSync(path.join(this._dir, f), 'utf-8');
          const data = JSON.parse(raw);
          if (data.expires && now > data.expires) {
            fs.unlinkSync(path.join(this._dir, f));
          }
        } catch {}
      }
    } catch {}
  }

  close() {
    if (this._cleanupTimer) clearInterval(this._cleanupTimer);
  }
}

module.exports = FileSessionStore;
