'use strict';

const Db = require('../config/Database');

const JSON_FIELDS = ['social_links', 'custom_links', 'music_track'];

class Profile {
  constructor(row) {
    Object.assign(this, row);
    for (const f of JSON_FIELDS) {
      if (typeof this[f] === 'string') {
        try { this[f] = JSON.parse(this[f]); } catch { }
      }
    }
    this.splash_enabled = !!this.splash_enabled;
    this.music_autoplay = !!this.music_autoplay;
    this.nsfw = !!this.nsfw;
  }

  static getByUserId(userId) {
    const row = Db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
    return row ? new Profile(row) : null;
  }

  static incrementViews(userId) {
    Db.prepare('UPDATE profiles SET views = views + 1 WHERE user_id = ?').run(userId);
  }

  static update(userId, fields) {
    const allowed = [
      'bio', 'avatar', 'banner', 'bg_type', 'bg_value', 'accent_color', 'text_color',
      'username_effect', 'cursor_effect', 'particles', 'font',
      'splash_text', 'splash_enabled',
      'music_track', 'music_volume', 'music_autoplay',
      'social_links', 'custom_links', 'nsfw'
    ];

    const sets = [];
    const vals = [];

    for (const key of allowed) {
      if (!(key in fields)) continue;
      let v = fields[key];
      if (JSON_FIELDS.includes(key) && typeof v !== 'string') v = JSON.stringify(v);
      if (['splash_enabled', 'music_autoplay', 'nsfw'].includes(key)) v = v ? 1 : 0;
      sets.push(`${key} = ?`);
      vals.push(v);
    }

    if (!sets.length) return Profile.getByUserId(userId);
    sets.push('updated_at = ?');
    vals.push(Date.now());
    vals.push(userId);

    Db.prepare(`UPDATE profiles SET ${sets.join(', ')} WHERE user_id = ?`).run(...vals);
    return Profile.getByUserId(userId);
  }
}

module.exports = Profile;
