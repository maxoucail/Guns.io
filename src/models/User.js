'use strict';

const { nanoid } = require('nanoid');
const Db = require('../config/Database');

class User {
  constructor(row) { Object.assign(this, row); }

  static findById(id) {
    const row = Db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return row ? new User(row) : null;
  }

  static findByProvider(provider, providerId) {
    const row = Db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(provider, providerId);
    return row ? new User(row) : null;
  }

  static findByUsername(username) {
    if (!username) return null;
    const row = Db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
    return row ? new User(row) : null;
  }

  static usernameExists(username) {
    if (!username) return false;
    return !!Db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').get(username);
  }

  static create({ provider, providerId, email, displayName, avatarUrl }) {
    const id = nanoid(16);
    const now = Date.now();
    Db.prepare(`
      INSERT INTO users (id, provider, provider_id, email, display_name, avatar_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, provider, providerId, email || null, displayName || null, avatarUrl || null, now, now);
    Db.prepare(`INSERT INTO profiles (user_id, updated_at) VALUES (?, ?)`).run(id, now);
    return User.findById(id);
  }

  static upsertFromOAuth({ provider, providerId, email, displayName, avatarUrl }) {
    const existing = User.findByProvider(provider, providerId);
    if (existing) {
      Db.prepare(`
        UPDATE users SET email = COALESCE(?, email), display_name = COALESCE(?, display_name),
                         avatar_url = COALESCE(?, avatar_url), updated_at = ?
        WHERE id = ?
      `).run(email || null, displayName || null, avatarUrl || null, Date.now(), existing.id);
      return User.findById(existing.id);
    }
    return User.create({ provider, providerId, email, displayName, avatarUrl });
  }

  setUsername(username) {
    Db.prepare('UPDATE users SET username = ?, updated_at = ? WHERE id = ?')
      .run(username, Date.now(), this.id);
    this.username = username;
  }
}

module.exports = User;
