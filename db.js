/**
 * link2me — Database Layer (SQLite via better-sqlite3)
 * Tables: users, badges, user_badges, gdpr
 * Profile data stored inline in users.pageConfig (JSON)
 */
'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const dbFile = path.join(DATA_DIR, 'link2me.db');
const sqlite = new Database(dbFile);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('foreign_keys = ON');

// ── Schema ─────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    provider        TEXT NOT NULL,
    provider_id     TEXT NOT NULL UNIQUE,
    email           TEXT,
    display_name    TEXT,
    avatar          TEXT,
    username        TEXT UNIQUE,
    linkSlug        TEXT,
    is_admin        INTEGER DEFAULT 0,
    blocked         INTEGER DEFAULT 0,
    blocked_message TEXT,
    last_ip         TEXT,
    last_seen_at    INTEGER,
    lastLoginAt     TEXT,
    pageConfig      TEXT DEFAULT '{}',
    stats           TEXT DEFAULT '{"totalViews":0,"todayViews":0,"todayDate":"","totalClicks":0}',
    rgpdAccepted    INTEGER DEFAULT 0,
    rgpdAcceptedAt  TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);

  CREATE TABLE IF NOT EXISTS badges (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon        TEXT DEFAULT '⭐',
    color       TEXT DEFAULT '#7c5cff'
  );

  CREATE TABLE IF NOT EXISTS user_badges (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id   TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    awarded_at INTEGER NOT NULL,
    awarded_by TEXT,
    PRIMARY KEY(user_id, badge_id)
  );

  CREATE TABLE IF NOT EXISTS gdpr (
    userId     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip         TEXT,
    userAgent  TEXT,
    acceptedAt TEXT NOT NULL,
    version    TEXT DEFAULT '1.0',
    PRIMARY KEY(userId, version)
  );
`);

// ── Migrations (add columns if missing) ───────────────────
const userCols = sqlite.prepare("PRAGMA table_info(users)").all().map(c => c.name);
const userMigrations = [
  ['is_admin', 'INTEGER DEFAULT 0'],
  ['blocked', 'INTEGER DEFAULT 0'],
  ['blocked_message', 'TEXT'],
  ['last_ip', 'TEXT'],
  ['last_seen_at', 'INTEGER'],
  ['lastLoginAt', 'TEXT'],
  ['pageConfig', "TEXT DEFAULT '{}'"],
  ['stats', "TEXT DEFAULT '{\"totalViews\":0,\"todayViews\":0,\"todayDate\":\"\",\"totalClicks\":0}'"],
  ['rgpdAccepted', 'INTEGER DEFAULT 0'],
  ['rgpdAcceptedAt', 'TEXT'],
];
for (const [col, def] of userMigrations) {
  if (!userCols.includes(col)) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
  }
}

// ── Helper: parse JSON fields ─────────────────────────────
function hydrateUser(row) {
  if (!row) return null;
  row.is_admin = !!row.is_admin;
  row.blocked = !!row.blocked;
  row.rgpdAccepted = !!row.rgpdAccepted;
  try { row.pageConfig = JSON.parse(row.pageConfig || '{}'); } catch { row.pageConfig = {}; }
  try { row.stats = JSON.parse(row.stats || '{}'); } catch { row.stats = { totalViews: 0, todayViews: 0, todayDate: '', totalClicks: 0 }; }
  return row;
}

// ── Public API ────────────────────────────────────────────
const db = {
  _sqlite: sqlite,

  // ── Users ───────────────────────────────────────────────
  users: {
    findOne(query) {
      const where = [];
      const vals = [];
      for (const [k, v] of Object.entries(query)) {
        if (v === null) { where.push(`${k} IS NULL`); continue; }
        if (typeof v === 'object' && v.$ne !== undefined) {
          where.push(`${k} != ?`);
          vals.push(v.$ne);
          continue;
        }
        where.push(`${k} = ?`);
        vals.push(v);
      }
      const sql = `SELECT * FROM users WHERE ${where.join(' AND ')} LIMIT 1`;
      return hydrateUser(sqlite.prepare(sql).get(...vals));
    },

    find(query, opts = {}) {
      const where = [];
      const vals = [];
      for (const [k, v] of Object.entries(query)) {
        if (v === null) { where.push(`${k} IS NULL`); continue; }
        if (typeof v === 'object' && v.$ne !== undefined) {
          where.push(`${k} != ?`);
          vals.push(v.$ne);
          continue;
        }
        where.push(`${k} = ?`);
        vals.push(v);
      }
      let sql = `SELECT * FROM users WHERE ${where.join(' AND ')}`;
      if (opts.orderBy) sql += ` ORDER BY ${opts.orderBy}`;
      if (opts.limit) { sql += ` LIMIT ${opts.limit}`; if (opts.offset) sql += ` OFFSET ${opts.offset}`; }
      return sqlite.prepare(sql).all(...vals).map(hydrateUser);
    },

    insert(data) {
      const keys = Object.keys(data);
      const vals = Object.values(data);
      const placeholders = keys.map(() => '?').join(', ');
      const sql = `INSERT INTO users (${keys.join(', ')}) VALUES (${placeholders})`;
      const info = sqlite.prepare(sql).run(...vals);
      return db.users.findOne({ id: data.id }) || data;
    },

    update(query, update) {
      const setClauses = [];
      const setVals = [];
      if (update.$set) {
        for (const [k, v] of Object.entries(update.$set)) {
          setClauses.push(`${k} = ?`);
          setVals.push(v);
        }
      } else {
        for (const [k, v] of Object.entries(update)) {
          setClauses.push(`${k} = ?`);
          setVals.push(v);
        }
      }
      const where = [];
      const whereVals = [];
      for (const [k, v] of Object.entries(query)) {
        where.push(`${k} = ?`);
        whereVals.push(v);
      }
      const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE ${where.join(' AND ')}`;
      sqlite.prepare(sql).run(...setVals, ...whereVals);
      return db.users.findOne(query);
    },

    delete(query) {
      const where = [];
      const vals = [];
      for (const [k, v] of Object.entries(query)) {
        where.push(`${k} = ?`);
        vals.push(v);
      }
      sqlite.prepare(`DELETE FROM users WHERE ${where.join(' AND ')}`).run(...vals);
    },

    count(query = {}) {
      const where = [];
      const vals = [];
      for (const [k, v] of Object.entries(query)) {
        if (v === null) { where.push(`${k} IS NULL`); continue; }
        if (typeof v === 'object' && v.$ne !== undefined) {
          where.push(`${k} != ?`);
          vals.push(v.$ne);
          continue;
        }
        where.push(`${k} = ?`);
        vals.push(v);
      }
      if (where.length === 0) return sqlite.prepare('SELECT COUNT(*) as c FROM users').get().c;
      return sqlite.prepare(`SELECT COUNT(*) as c FROM users WHERE ${where.join(' AND ')}`).get(...vals).c;
    },

    search({ q = '', page = 1, limit = 30 } = {}) {
      const offset = (page - 1) * limit;
      if (!q) {
        return sqlite.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset).map(hydrateUser);
      }
      const sq = `%${q}%`;
      return sqlite.prepare(
        `SELECT * FROM users WHERE username LIKE ? OR email LIKE ? OR display_name LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).all(sq, sq, sq, limit, offset).map(hydrateUser);
    },

    countSearch(q = '') {
      if (!q) return db.users.count();
      const sq = `%${q}%`;
      return sqlite.prepare(
        `SELECT COUNT(*) as c FROM users WHERE username LIKE ? OR email LIKE ? OR display_name LIKE ?`
      ).get(sq, sq, sq).c;
    },

    getStats() {
      const total = sqlite.prepare('SELECT COUNT(*) as c FROM users').get().c;
      const blocked = sqlite.prepare('SELECT COUNT(*) as c FROM users WHERE blocked = 1').get().c;
      const admins = sqlite.prepare('SELECT COUNT(*) as c FROM users WHERE is_admin = 1').get().c;
      let totalViews = 0;
      const all = sqlite.prepare('SELECT stats FROM users WHERE stats IS NOT NULL').all();
      for (const u of all) {
        try { const s = JSON.parse(u.stats); totalViews += s.totalViews || 0; } catch {}
      }
      return { users: total, blocked, admins, views: totalViews };
    },
  },

  // ── Badges ──────────────────────────────────────────────
  badges: {
    findAll() {
      return sqlite.prepare('SELECT * FROM badges ORDER BY name ASC').all();
    },
    findOne(query) {
      const where = Object.entries(query).map(([k]) => `${k} = ?`).join(' AND ');
      return sqlite.prepare(`SELECT * FROM badges WHERE ${where}`).get(...Object.values(query));
    },
    insert(data) {
      const keys = Object.keys(data);
      const vals = Object.values(data);
      sqlite.prepare(`INSERT INTO badges (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...vals);
      return data;
    },
    delete(id) {
      sqlite.prepare('DELETE FROM badges WHERE id = ?').run(id);
    },
  },

  userBadges: {
    findByUser(userId) {
      return sqlite.prepare(`
        SELECT b.*, ub.awarded_at, ub.awarded_by
        FROM user_badges ub JOIN badges b ON ub.badge_id = b.id
        WHERE ub.user_id = ?
        ORDER BY ub.awarded_at DESC
      `).all(userId);
    },
    assign(userId, badgeId, awardedBy) {
      const existing = sqlite.prepare('SELECT 1 FROM user_badges WHERE user_id = ? AND badge_id = ?').get(userId, badgeId);
      if (existing) return false;
      sqlite.prepare('INSERT INTO user_badges (user_id, badge_id, awarded_at, awarded_by) VALUES (?, ?, ?, ?)').run(
        userId, badgeId, Date.now(), awardedBy || null
      );
      return true;
    },
    revoke(userId, badgeId) {
      sqlite.prepare('DELETE FROM user_badges WHERE user_id = ? AND badge_id = ?').run(userId, badgeId);
    },
  },

  // ── GDPR ────────────────────────────────────────────────
  gdpr: {
    findOne(query) {
      const where = Object.entries(query).map(([k]) => `${k} = ?`).join(' AND ');
      return sqlite.prepare(`SELECT * FROM gdpr WHERE ${where}`).get(...Object.values(query)) || null;
    },
    insert(data) {
      const keys = Object.keys(data);
      const vals = Object.values(data);
      sqlite.prepare(`INSERT OR REPLACE INTO gdpr (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...vals);
      return data;
    },
  },

  // ── Close ───────────────────────────────────────────────
  close() {
    sqlite.close();
  },
};

module.exports = db;
