'use strict';

const axios = require('axios');
const Logger = require('../utils/Logger');

const GH_API = 'https://api.github.com';
const DATA_BRANCH = 'data';
const MAX_WRITE_RETRIES = 3;

class GitHubDataService {
  constructor() {
    this.owner = process.env.GITHUB_OWNER || '';
    this.repo  = process.env.GITHUB_REPO  || '';
    this.token = process.env.GITHUB_TOKEN || '';
    this._ready = false;
    this._writeQueue = Promise.resolve();
    this._cache = {
      users: new Map(),       // id -> user
      profiles: new Map(),    // userId -> profile
      badges: new Map(),      // id -> badge
      userBadges: new Map(),  // userId -> [badgeIds]
      indexByUsername: new Map(),  // username (lower) -> userId
      indexByProvider: new Map(),  // "provider:providerId" -> userId
    };

    this.client = axios.create({
      baseURL: GH_API,
      timeout: 30_000,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      }
    });
  }

  isConfigured() {
    return !!(this.owner && this.repo && this.token);
  }

  // ── Initialization ──────────────────────────────────────────
  async init() {
    if (!this.isConfigured()) {
      Logger.warn('GitHubDataService: non configuré (GITHUB_OWNER/REPO/TOKEN)');
      return false;
    }
    try {
      await this._ensureBranch();
      await this._loadAllData();
      this._ready = true;
      Logger.info(`GitHubDataService: prêt, ${this._cache.users.size} utilisateurs en cache`);
      return true;
    } catch (err) {
      Logger.error('GitHubDataService: init échoué', err.message);
      return false;
    }
  }

  isReady() { return this._ready; }

  // ── Branch management ───────────────────────────────────────
  async _ensureBranch() {
    try {
      await this.client.get(`/repos/${this.owner}/${this.repo}/git/ref/heads/${DATA_BRANCH}`);
    } catch (err) {
      if (err.response?.status !== 404) throw err;
      const { data: repo } = await this.client.get(`/repos/${this.owner}/${this.repo}`);
      const { data: mainRef } = await this.client.get(
        `/repos/${this.owner}/${this.repo}/git/ref/heads/${repo.default_branch}`
      );
      await this.client.post(`/repos/${this.owner}/${this.repo}/git/refs`, {
        ref: `refs/heads/${DATA_BRANCH}`,
        sha: mainRef.object.sha
      });
      Logger.info(`GitHubDataService: branche '${DATA_BRANCH}' créée`);
    }
  }

  // ── Load all data into cache ─────────────────────────────────
  async _loadAllData() {
    try {
      // Load users
      const usersTree = await this._getTree('data/users');
      for (const item of (usersTree || [])) {
        if (item.type === 'blob' && item.path.endsWith('.json')) {
          try {
            const content = await this._getFileContent(item.path);
            const user = JSON.parse(content);
            this._cache.users.set(user.id, user);
            if (user.username) this._cache.indexByUsername.set(user.username.toLowerCase(), user.id);
            if (user.provider && user.provider_id) {
              this._cache.indexByProvider.set(`${user.provider}:${user.provider_id}`, user.id);
            }
          } catch (e) { Logger.warn(`GitHubDataService: skip ${item.path}`, e.message); }
        }
      }
      // Load profiles
      const profilesTree = await this._getTree('data/profiles');
      for (const item of (profilesTree || [])) {
        if (item.type === 'blob' && item.path.endsWith('.json')) {
          try {
            const content = await this._getFileContent(item.path);
            const profile = JSON.parse(content);
            this._cache.profiles.set(profile.user_id, profile);
          } catch (e) { /* skip */ }
        }
      }
      // Load badges
      const badgesTree = await this._getTree('data/badges');
      for (const item of (badgesTree || [])) {
        if (item.type === 'blob' && item.path.endsWith('.json')) {
          try {
            const content = await this._getFileContent(item.path);
            const badge = JSON.parse(content);
            this._cache.badges.set(badge.id, badge);
          } catch (e) { /* skip */ }
        }
      }
      // Load user_badges
      const ubTree = await this._getTree('data/user_badges');
      for (const item of (ubTree || [])) {
        if (item.type === 'blob' && item.path.endsWith('.json')) {
          try {
            const content = await this._getFileContent(item.path);
            const ub = JSON.parse(content);
            const arr = this._cache.userBadges.get(ub.user_id) || [];
            arr.push(ub);
            this._cache.userBadges.set(ub.user_id, arr);
          } catch (e) { /* skip */ }
        }
      }
    } catch (err) {
      if (err.response?.status === 404) {
        // Empty data branch — normal on first run
        Logger.info('GitHubDataService: data branch empty (first run)');
      } else {
        Logger.error('GitHubDataService: _loadAllData critical error', err.message);
        throw err;
      }
    }
  }

  // ── GitHub API helpers ──────────────────────────────────────
  async _getTree(dirPath) {
    try {
      const { data } = await this.client.get(
        `/repos/${this.owner}/${this.repo}/contents/${dirPath}?ref=${DATA_BRANCH}`
      );
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (err.response?.status === 404) return [];
      throw err;
    }
  }

  async _getFileContent(ghPath) {
    const { data } = await this.client.get(
      `/repos/${this.owner}/${this.repo}/contents/${ghPath}?ref=${DATA_BRANCH}`
    );
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  async _putFile(ghPath, content, message) {
    let sha;
    try {
      const { data } = await this.client.get(
        `/repos/${this.owner}/${this.repo}/contents/${ghPath}?ref=${DATA_BRANCH}`
      );
      sha = data.sha;
    } catch (err) {
      if (err.response?.status !== 404) throw err;
    }

    const body = {
      message: message || `update: ${ghPath}`,
      content: Buffer.from(content).toString('base64'),
      branch: DATA_BRANCH
    };
    if (sha) body.sha = sha;

    await this.client.put(
      `/repos/${this.owner}/${this.repo}/contents/${ghPath}`,
      body
    );
  }

  async _deleteFile(ghPath, message) {
    try {
      const { data } = await this.client.get(
        `/repos/${this.owner}/${this.repo}/contents/${ghPath}?ref=${DATA_BRANCH}`
      );
      await this.client.delete(
        `/repos/${this.owner}/${this.repo}/contents/${ghPath}`,
        { data: { message: message || `delete: ${ghPath}`, sha: data.sha, branch: DATA_BRANCH } }
      );
    } catch (err) {
      if (err.response?.status !== 404) throw err;
    }
  }

  // ── Write queue (serialize writes to avoid conflicts) ───────
  _enqueueWrite(fn) {
    this._writeQueue = this._writeQueue.then(fn).catch(async (err) => {
      Logger.error('GitHubDataService: write failed, retrying', err.message);
      for (let i = 0; i < MAX_WRITE_RETRIES; i++) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        try { return await fn(); } catch (e) {
          Logger.error(`GitHubDataService: retry ${i + 1}/${MAX_WRITE_RETRIES} failed`, e.message);
        }
      }
      // Don't throw — cache has the data, queue stays alive
      // Data will sync on next restart or flushViews
      Logger.error('GitHubDataService: write permanently failed — cache/GitHub desynced (will retry on restart)');
    });
    return this._writeQueue;
  }

  // ═══════════════════════════════════════════════════════════
  //  USERS
  // ═══════════════════════════════════════════════════════════
  findUserById(id) {
    return this._cache.users.get(id) || null;
  }

  findUserByProvider(provider, providerId) {
    const key = `${provider}:${providerId}`;
    const id = this._cache.indexByProvider.get(key);
    return id ? this._cache.users.get(id) || null : null;
  }

  findUserByUsername(username) {
    if (!username) return null;
    const id = this._cache.indexByUsername.get(username.toLowerCase());
    return id ? this._cache.users.get(id) || null : null;
  }

  usernameExists(username) {
    if (!username) return false;
    return this._cache.indexByUsername.has(username.toLowerCase());
  }

  insertUser(userData) {
    const user = { ...userData };
    this._cache.users.set(user.id, user);
    if (user.username) this._cache.indexByUsername.set(user.username.toLowerCase(), user.id);
    if (user.provider && user.provider_id) {
      this._cache.indexByProvider.set(`${user.provider}:${user.provider_id}`, user.id);
    }
    // Create default profile
    if (!this._cache.profiles.has(user.id)) {
      const profile = {
        user_id: user.id,
        bio: '', avatar: null, banner: null,
        bg_type: 'gradient', bg_value: '',
        accent_color: '#7c5cff', text_color: '#ffffff',
        username_effect: 'glow', cursor_effect: 'trail', particles: 'stars',
        font: 'Inter', splash_text: 'click to enter', splash_enabled: true,
        music_track: null, music_volume: 30, music_autoplay: true,
        social_links: [], custom_links: [],
        views: 0, nsfw: false, bio_widget: false,
        updated_at: Date.now()
      };
      this._cache.profiles.set(user.id, profile);
      this._enqueueWrite(() => this._putFile(`data/profiles/${user.id}.json`, JSON.stringify(profile, null, 2), `create profile for ${user.id}`));
    }
    this._enqueueWrite(() => this._putFile(`data/users/${user.id}.json`, JSON.stringify(user, null, 2), `create user ${user.id}`));
    return user;
  }

  updateUser(id, updates) {
    const user = this._cache.users.get(id);
    if (!user) return null;
    const oldUsername = user.username;
    Object.assign(user, updates, { updated_at: Date.now() });
    if (updates.username !== undefined) {
      if (oldUsername) this._cache.indexByUsername.delete(oldUsername.toLowerCase());
      if (user.username) this._cache.indexByUsername.set(user.username.toLowerCase(), user.id);
    }
    this._enqueueWrite(() => this._putFile(`data/users/${id}.json`, JSON.stringify(user, null, 2), `update user ${id}`));
    return user;
  }

  deleteUser(id) {
    const user = this._cache.users.get(id);
    if (!user) return;
    if (user.username) this._cache.indexByUsername.delete(user.username.toLowerCase());
    if (user.provider && user.provider_id) {
      this._cache.indexByProvider.delete(`${user.provider}:${user.provider_id}`);
    }
    this._cache.users.delete(id);
    this._cache.profiles.delete(id);
    this._cache.userBadges.delete(id);
    this._enqueueWrite(() => Promise.all([
      this._deleteFile(`data/users/${id}.json`, `delete user ${id}`),
      this._deleteFile(`data/profiles/${id}.json`, `delete profile ${id}`)
    ]));
  }

  findAllUsers({ page = 1, limit = 30, search = '' } = {}) {
    let all = Array.from(this._cache.users.values(), u => ({ ...u }));
    if (search) {
      const q = search.toLowerCase();
      all = all.filter(u =>
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.display_name && u.display_name.toLowerCase().includes(q))
      );
    }
    all.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    const offset = (page - 1) * limit;
    return all.slice(offset, offset + limit);
  }

  countUsers(search = '') {
    if (!search) return this._cache.users.size;
    const q = search.toLowerCase();
    let c = 0;
    for (const u of this._cache.users.values()) {
      if ((u.username && u.username.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.display_name && u.display_name.toLowerCase().includes(q))) c++;
    }
    return c;
  }

  // ═══════════════════════════════════════════════════════════
  //  PROFILES
  // ═══════════════════════════════════════════════════════════
  getProfile(userId) {
    return this._cache.profiles.get(userId) || null;
  }

  incrementProfileViews(userId) {
    const profile = this._cache.profiles.get(userId);
    if (profile) {
      profile.views = (profile.views || 0) + 1;
      // Don't persist every view - batch periodically
    }
  }

  updateProfile(userId, updates) {
    let profile = this._cache.profiles.get(userId);
    if (!profile) {
      profile = { user_id: userId };
      this._cache.profiles.set(userId, profile);
    }
    Object.assign(profile, updates, { updated_at: Date.now() });
    this._enqueueWrite(() => this._putFile(`data/profiles/${userId}.json`, JSON.stringify(profile, null, 2), `update profile ${userId}`));
    return profile;
  }

  // ═══════════════════════════════════════════════════════════
  //  BADGES
  // ═══════════════════════════════════════════════════════════
  getAllBadges() {
    return Array.from(this._cache.badges.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  insertBadge(badge) {
    this._cache.badges.set(badge.id, badge);
    this._enqueueWrite(() => this._putFile(`data/badges/${badge.id}.json`, JSON.stringify(badge, null, 2), `create badge ${badge.id}`));
    return badge;
  }

  deleteBadge(badgeId) {
    this._cache.badges.delete(badgeId);
    // Also remove from user_badges
    for (const [userId, badges] of this._cache.userBadges) {
      this._cache.userBadges.set(userId, badges.filter(b => b.badge_id !== badgeId));
    }
    this._enqueueWrite(() => this._deleteFile(`data/badges/${badgeId}.json`, `delete badge ${badgeId}`));
  }

  getUserBadges(userId) {
    const userBadges = this._cache.userBadges.get(userId) || [];
    return userBadges.map(ub => {
      const badge = this._cache.badges.get(ub.badge_id);
      return badge ? { ...badge, awarded_at: ub.awarded_at, awarded_by: ub.awarded_by } : null;
    }).filter(Boolean);
  }

  assignBadge(userId, badgeId, awardedBy) {
    const arr = this._cache.userBadges.get(userId) || [];
    if (arr.some(b => b.badge_id === badgeId)) return false;
    const ub = { user_id: userId, badge_id: badgeId, awarded_at: Date.now(), awarded_by: awardedBy || null };
    arr.push(ub);
    this._cache.userBadges.set(userId, arr);
    const key = `${userId}_${badgeId}`;
    this._enqueueWrite(() => this._putFile(`data/user_badges/${key}.json`, JSON.stringify(ub, null, 2), `assign badge ${badgeId} to ${userId}`));
    return true;
  }

  revokeBadge(userId, badgeId) {
    const arr = this._cache.userBadges.get(userId) || [];
    this._cache.userBadges.set(userId, arr.filter(b => b.badge_id !== badgeId));
    const key = `${userId}_${badgeId}`;
    this._enqueueWrite(() => this._deleteFile(`data/user_badges/${key}.json`, `revoke badge ${badgeId} from ${userId}`));
  }

  // ═══════════════════════════════════════════════════════════
  //  AGGREGATES
  // ═══════════════════════════════════════════════════════════
  getStats() {
    let blocked = 0, admins = 0, totalViews = 0;
    for (const u of this._cache.users.values()) {
      if (u.blocked) blocked++;
      if (u.is_admin) admins++;
    }
    for (const p of this._cache.profiles.values()) {
      totalViews += p.views || 0;
    }
    return {
      users: this._cache.users.size,
      blocked,
      admins,
      views: totalViews
    };
  }

  // Flush cache views to GitHub (call periodically or on shutdown)
  async flushViews() {
    for (const [userId, profile] of this._cache.profiles) {
      try {
        await this._putFile(`data/profiles/${userId}.json`, JSON.stringify(profile, null, 2), `update views ${userId}`);
      } catch (e) { Logger.warn(`flushViews failed for ${userId}`, e.message); }
    }
  }
}

module.exports = new GitHubDataService();
