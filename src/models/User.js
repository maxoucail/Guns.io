'use strict';

const { nanoid } = require('nanoid');
const GhData = require('../services/GitHubDataService');

class User {
  constructor(row) { Object.assign(this, row); }

  static findById(id) {
    const row = GhData.findUserById(id);
    return row ? new User(row) : null;
  }

  static findByProvider(provider, providerId) {
    const row = GhData.findUserByProvider(provider, providerId);
    return row ? new User(row) : null;
  }

  static findByUsername(username) {
    const row = GhData.findUserByUsername(username);
    return row ? new User(row) : null;
  }

  static usernameExists(username) {
    return GhData.usernameExists(username);
  }

  static create({ provider, providerId, email, displayName, avatarUrl }) {
    const id = nanoid(16);
    const now = Date.now();
    const user = GhData.insertUser({
      id, provider, provider_id: providerId,
      email: email || null,
      display_name: displayName || null,
      avatar_url: avatarUrl || null,
      username: null,
      is_admin: false,
      blocked: false,
      blocked_message: null,
      last_ip: null,
      last_seen_at: null,
      created_at: now,
      updated_at: now
    });
    return new User(user);
  }

  static upsertFromOAuth({ provider, providerId, email, displayName, avatarUrl }) {
    const existing = User.findByProvider(provider, providerId);
    if (existing) {
      const updates = { updated_at: Date.now() };
      if (email) updates.email = email;
      if (displayName) updates.display_name = displayName;
      if (avatarUrl) updates.avatar_url = avatarUrl;
      const u = GhData.updateUser(existing.id, updates);
      if (!u) return User.create({ provider, providerId, email, displayName, avatarUrl });
      return new User(u);
    }
    return User.create({ provider, providerId, email, displayName, avatarUrl });
  }

  setUsername(username) {
    const u = GhData.updateUser(this.id, { username, updated_at: Date.now() });
    this.username = u.username;
  }

  static findAll({ page = 1, limit = 30, search = '' } = {}) {
    return GhData.findAllUsers({ page, limit, search }).map(r => new User(r));
  }

  static count(search = '') {
    return GhData.countUsers(search);
  }

  static setAdmin(id, isAdmin) {
    GhData.updateUser(id, { is_admin: !!isAdmin, updated_at: Date.now() });
  }

  static block(id, message = null) {
    GhData.updateUser(id, { blocked: true, blocked_message: message || null, updated_at: Date.now() });
  }

  static unblock(id) {
    GhData.updateUser(id, { blocked: false, blocked_message: null, updated_at: Date.now() });
  }

  static delete(id) {
    GhData.deleteUser(id);
  }

  static updateLastSeen(id, ip) {
    GhData.updateUser(id, { last_ip: ip || null, last_seen_at: Date.now() });
  }

  static getBadges(userId) {
    return GhData.getUserBadges(userId);
  }
}

module.exports = User;
