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
        updated_at     INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);
  }

  prepare(sql) { return this.db.prepare(sql); }
  exec(sql)    { return this.db.exec(sql); }
  close()      { this.db.close(); }
}

module.exports = new Db();
