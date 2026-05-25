/**
 * link2me — GitHub Data Service
 * Sync users, profiles, badges to GitHub as JSON files (backup/persistence)
 */
'use strict';

const axios = require('axios');

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
      users: new Map(),
      profiles: new Map(),
      badges: new Map(),
      userBadges: new Map(),
      indexByUsername: new Map(),
      indexByProvider: new Map(),
    };

    this.client = axios.create({
      baseURL: GH_API,
      timeout: 30_000,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
    });
  }

  isConfigured() {
    return !!(this.owner && this.repo && this.token);
  }

  async init() {
    if (!this.isConfigured()) return false;
    try {
      await this._ensureBranch();
      await this._loadAllData();
      this._ready = true;
      console.log(`[GitHubData] Prêt, ${this._cache.users.size} utilisateurs en cache`);
      return true;
    } catch (err) {
      console.error('[GitHubData] Init échoué:', err.message);
      return false;
    }
  }

  isReady() { return this._ready; }

  // ── Branch ───────────────────────────────────────────────
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
        sha: mainRef.object.sha,
      });
      console.log(`[GitHubData] Branche '${DATA_BRANCH}' créée`);
    }
  }

  // ── Load ─────────────────────────────────────────────────
  async _loadAllData() {
    try {
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
          } catch (e) { /* skip */ }
        }
      }
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
        console.log('[GitHubData] Data branch empty (first run)');
      } else {
        console.error('[GitHubData] _loadAllData error:', err.message);
        throw err;
      }
    }
  }

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
      branch: DATA_BRANCH,
    };
    if (sha) body.sha = sha;
    await this.client.put(`/repos/${this.owner}/${this.repo}/contents/${ghPath}`, body);
  }

  async _deleteFile(ghPath, message) {
    try {
      const { data } = await this.client.get(
        `/repos/${this.owner}/${this.repo}/contents/${ghPath}?ref=${DATA_BRANCH}`
      );
      await this.client.delete(`/repos/${this.owner}/${this.repo}/contents/${ghPath}`, {
        data: { message: message || `delete: ${ghPath}`, sha: data.sha, branch: DATA_BRANCH },
      });
    } catch (err) {
      if (err.response?.status !== 404) throw err;
    }
  }

  _enqueueWrite(fn) {
    if (!this.isConfigured()) return Promise.resolve();
    this._writeQueue = this._writeQueue.then(fn).catch(async (err) => {
      console.error('[GitHubData] Write failed, retrying:', err.message);
      for (let i = 0; i < MAX_WRITE_RETRIES; i++) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        try { return await fn(); } catch (e) {
          console.error(`[GitHubData] Retry ${i + 1}/${MAX_WRITE_RETRIES} failed:`, e.message);
        }
      }
      console.error('[GitHubData] Write permanently failed');
    });
    return this._writeQueue;
  }

  // ── Users ────────────────────────────────────────────────
  findUserById(id) { return this._cache.users.get(id) || null; }
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
      this._deleteFile(`data/profiles/${id}.json`, `delete profile ${id}`),
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

  // ── Profiles ─────────────────────────────────────────────
  getProfile(userId) { return this._cache.profiles.get(userId) || null; }

  incrementProfileViews(userId) {
    const profile = this._cache.profiles.get(userId);
    if (profile) profile.views = (profile.views || 0) + 1;
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

  // ── Badges ───────────────────────────────────────────────
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

  getStats() {
    let blocked = 0, admins = 0, totalViews = 0;
    for (const u of this._cache.users.values()) {
      if (u.blocked) blocked++;
      if (u.is_admin) admins++;
    }
    for (const p of this._cache.profiles.values()) {
      totalViews += p.views || 0;
    }
    return { users: this._cache.users.size, blocked, admins, views: totalViews };
  }

  async flushViews() {
    if (!this.isConfigured()) return;
    for (const [userId, profile] of this._cache.profiles) {
      try {
        await this._putFile(`data/profiles/${userId}.json`, JSON.stringify(profile, null, 2), `update views ${userId}`);
      } catch (e) { /* skip */ }
    }
  }
}

module.exports = new GitHubDataService();
