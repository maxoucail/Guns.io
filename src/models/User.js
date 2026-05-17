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

  static findAll({ page = 1, limit = 30, search = '' } = {}) {
    const offset = (page - 1) * limit;
    if (search) {
      const q = '%' + search + '%';
      return Db.prepare(`SELECT * FROM users WHERE username LIKE ? OR email LIKE ? OR display_name LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .all(q, q, q, limit, offset).map(r => new User(r));
    }
    return Db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset).map(r => new User(r));
  }

  static count(search = '') {
    if (search) {
      const q = '%' + search + '%';
      return Db.prepare(`SELECT COUNT(*) as n FROM users WHERE username LIKE ? OR email LIKE ? OR display_name LIKE ?`).get(q, q, q).n;
    }
    return Db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  }

  static setAdmin(id, isAdmin) {
    Db.prepare('UPDATE users SET is_admin = ?, updated_at = ? WHERE id = ?').run(isAdmin ? 1 : 0, Date.now(), id);
  }

  static block(id, message = null) {
    Db.prepare('UPDATE users SET blocked = 1, blocked_message = ?, updated_at = ? WHERE id = ?').run(message || null, Date.now(), id);
  }

  static unblock(id) {
    Db.prepare('UPDATE users SET blocked = 0, blocked_message = NULL, updated_at = ? WHERE id = ?').run(Date.now(), id);
  }

  static delete(id) {
    Db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  static updateLastSeen(id, ip) {
    Db.prepare('UPDATE users SET last_ip = ?, last_seen_at = ? WHERE id = ?').run(ip || null, Date.now(), id);
  }

  static getBadges(userId) {
    return Db.prepare(`
      SELECT b.*, ub.awarded_at, ub.awarded_by FROM badges b
      JOIN user_badges ub ON b.id = ub.badge_id
      WHERE ub.user_id = ? ORDER BY ub.awarded_at DESC
    `).all(userId);
  }
}

module.exports = User;
