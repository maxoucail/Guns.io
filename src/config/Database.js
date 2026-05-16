'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const Config = require('./Config');
const Logger = require('../utils/Logger');

class Db {
  constructor() {
    if (!fs.existsSync(Config.paths.data)) fs.mkdirSync(Config.paths.data, { recursive: true });
    const file = path.join(Config.paths.data, 'link2me.db');
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this._migrate();
    Logger.info(`SQLite prêt : ${file}`);
  }

  _migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        provider      TEXT NOT NULL,
        provider_id   TEXT NOT NULL,
        email         TEXT,
        display_name  TEXT,
        avatar_url    TEXT,
        username      TEXT UNIQUE,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL,
        UNIQUE(provider, provider_id)
      );

      CREATE TABLE IF NOT EXISTS profiles (
        user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        bio            TEXT DEFAULT '',
        avatar         TEXT,
        banner         TEXT,
        bg_type        TEXT DEFAULT 'gradient',
        bg_value       TEXT DEFAULT '',
        accent_color   TEXT DEFAULT '#7c5cff',
        text_color     TEXT DEFAULT '#ffffff',
        username_effect TEXT DEFAULT 'glow',
        cursor_effect  TEXT DEFAULT 'trail',
        particles      TEXT DEFAULT 'stars',
        font           TEXT DEFAULT 'Inter',
        splash_text    TEXT DEFAULT 'click to enter',
        splash_enabled INTEGER DEFAULT 1,
        music_track    TEXT,
        music_volume   INTEGER DEFAULT 30,
        music_autoplay INTEGER DEFAULT 1,
        social_links   TEXT DEFAULT '[]',
        custom_links   TEXT DEFAULT '[]',
        views          INTEGER DEFAULT 0,
        nsfw           INTEGER DEFAULT 0,
        bio_widget     INTEGER DEFAULT 0,
        updated_at     INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);
    const profCols = this.db.prepare("PRAGMA table_info(profiles)").all().map(c => c.name);
    if (!profCols.includes('bio_widget')) this.db.exec("ALTER TABLE profiles ADD COLUMN bio_widget INTEGER DEFAULT 0");

    const userCols = this.db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    const userAlters = [
      ['is_admin', 'INTEGER DEFAULT 0'],
      ['blocked', 'INTEGER DEFAULT 0'],
      ['blocked_message', 'TEXT'],
      ['last_ip', 'TEXT'],
      ['last_seen_at', 'INTEGER']
    ];
    for (const [col, def] of userAlters) {
      if (!userCols.includes(col)) this.db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
    }

    this.db.exec(`
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
    `);
  }

  prepare(sql) { return this.db.prepare(sql); }
  exec(sql)    { return this.db.exec(sql); }
  close()      { this.db.close(); }
}

module.exports = new Db();
