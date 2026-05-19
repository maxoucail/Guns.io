'use strict';

const GhData = require('../services/GitHubDataService');

const JSON_FIELDS = ['social_links', 'custom_links', 'music_track'];

class Profile {
  constructor(row) {
    Object.assign(this, row);
    // JSON fields are already parsed by GitHubDataService (stored as objects)
    // But handle the case where they might be strings (backward compat)
    for (const f of JSON_FIELDS) {
      if (typeof this[f] === 'string') {
        try { this[f] = JSON.parse(this[f]); } catch { }
      }
    }
    this.splash_enabled = !!this.splash_enabled;
    this.music_autoplay = !!this.music_autoplay;
    this.nsfw = !!this.nsfw;
    this.bio_widget = !!this.bio_widget;
  }

  static getByUserId(userId) {
    const row = GhData.getProfile(userId);
    return row ? new Profile(row) : null;
  }

  static incrementViews(userId) {
    GhData.incrementProfileViews(userId);
  }

  static update(userId, fields) {
    const allowed = [
      'bio', 'avatar', 'banner', 'bg_type', 'bg_value', 'accent_color', 'text_color',
      'username_effect', 'cursor_effect', 'particles', 'font',
      'splash_text', 'splash_enabled', 'bio_widget',
      'music_track', 'music_volume', 'music_autoplay',
      'social_links', 'custom_links', 'nsfw'
    ];

    const updates = {};

    for (const key of allowed) {
      if (!(key in fields)) continue;
      let v = fields[key];
      if (['splash_enabled', 'music_autoplay', 'nsfw', 'bio_widget'].includes(key)) v = !!v;
      updates[key] = v;
    }

    if (!Object.keys(updates).length) return Profile.getByUserId(userId);
    updates.updated_at = Date.now();

    const profile = GhData.updateProfile(userId, updates);
    return profile ? new Profile(profile) : null;
  }
}

module.exports = Profile;
