'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const Profile = require('../models/Profile');
const User = require('../models/User');
const Validator = require('../utils/Validator');
const Config = require('../config/Config');
const Deezer = require('../services/DeezerService');
const Logger = require('../utils/Logger');

const VALID_BG_TYPES   = new Set(['color', 'gradient', 'image']);
const VALID_USERNAME_FX = new Set(['none', 'glow', 'shimmer', 'rainbow', 'glitch']);
const VALID_CURSOR_FX  = new Set(['none', 'trail', 'sparkle', 'glow']);
const VALID_PARTICLES  = new Set(['none', 'stars', 'snow', 'bubbles', 'matrix']);
const VALID_FONTS      = new Set(['Inter', 'Geist', 'Space Grotesk', 'JetBrains Mono', 'Outfit', 'Poppins']);

const SOCIAL_PLATFORMS = new Set([
  'discord', 'twitter', 'instagram', 'tiktok', 'youtube',
  'twitch', 'spotify', 'soundcloud', 'github', 'telegram',
  'snapchat', 'kick', 'roblox', 'steam', 'email', 'website'
]);

class ApiController {
  static checkUsername(req, res) {
    const raw = (req.query.u || '').trim();
    const err = Validator.username(raw);
    if (err) return res.json({ ok: false, reason: err });
    if (User.usernameExists(raw)) return res.json({ ok: false, reason: 'taken' });
    return res.json({ ok: true });
  }

  static async musicSearch(req, res) {
    const q = (req.query.q || '').trim();
    const results = await Deezer.search(q, 12);
    res.json({ results });
  }

  static updateProfile(req, res) {
    const data = req.body || {};
    const updates = {};

    if ('bio' in data)            updates.bio = Validator.sanitizeText(String(data.bio || ''), 500);
    if ('splash_text' in data)    updates.splash_text = Validator.sanitizeText(String(data.splash_text || ''), 60);
    if ('splash_enabled' in data) updates.splash_enabled = !!data.splash_enabled;
    if ('music_autoplay' in data) updates.music_autoplay = !!data.music_autoplay;
    if ('nsfw' in data)           updates.nsfw = !!data.nsfw;

    if ('accent_color' in data && Validator.hexColor(data.accent_color)) updates.accent_color = data.accent_color;
    if ('text_color'   in data && Validator.hexColor(data.text_color))   updates.text_color   = data.text_color;

    if ('music_volume' in data) updates.music_volume = Validator.clamp(data.music_volume, 0, 100);

    if ('bg_type' in data && VALID_BG_TYPES.has(data.bg_type)) updates.bg_type = data.bg_type;
    if ('bg_value' in data) {
      if (typeof data.bg_value === 'string' && data.bg_value.length < 4096) {
        updates.bg_value = data.bg_value;
      }
    }

    if ('username_effect' in data && VALID_USERNAME_FX.has(data.username_effect)) updates.username_effect = data.username_effect;
    if ('cursor_effect'   in data && VALID_CURSOR_FX.has(data.cursor_effect))     updates.cursor_effect = data.cursor_effect;
    if ('particles'       in data && VALID_PARTICLES.has(data.particles))         updates.particles = data.particles;
    if ('font'            in data && VALID_FONTS.has(data.font))                  updates.font = data.font;

    if ('social_links' in data && Array.isArray(data.social_links)) {
      const clean = [];
      for (const l of data.social_links.slice(0, 20)) {
        if (!l || typeof l !== 'object') continue;
        const platform = String(l.platform || '').toLowerCase();
        if (!SOCIAL_PLATFORMS.has(platform)) continue;
        const value = Validator.sanitizeText(String(l.value || ''), 200);
        if (!value) continue;
        clean.push({ platform, value });
      }
      updates.social_links = clean;
    }

    if ('custom_links' in data && Array.isArray(data.custom_links)) {
      const clean = [];
      for (const l of data.custom_links.slice(0, 15)) {
        if (!l || typeof l !== 'object') continue;
        const label = Validator.sanitizeText(String(l.label || ''), 60);
        const url = Validator.safeUrl(l.url);
        if (!label || !url) continue;
        clean.push({ label, url });
      }
      updates.custom_links = clean;
    }

    if ('music_track' in data) {
      const t = data.music_track;
      if (t === null) {
        updates.music_track = null;
      } else if (t && typeof t === 'object' && t.preview && t.title) {
        updates.music_track = {
          id: String(t.id || ''),
          title: Validator.sanitizeText(String(t.title), 120),
          artist: Validator.sanitizeText(String(t.artist || ''), 120),
          cover: Validator.safeUrl(t.cover) || null,
          preview: Validator.safeUrl(t.preview)
        };
        if (!updates.music_track.preview) delete updates.music_track;
      }
    }

    const profile = Profile.update(req.user.id, updates);
    res.json({ ok: true, profile });
  }

  static async uploadImage(req, res) {
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    const kind = req.body.kind === 'banner' ? 'banner' : 'avatar';

    const dir = path.join(Config.paths.uploads, req.user.id);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const hash = crypto.createHash('sha1').update(req.file.buffer).digest('hex').slice(0, 10);
    const filename = `${kind}-${hash}.webp`;
    const fullPath = path.join(dir, filename);

    try {
      const pipeline = sharp(req.file.buffer);
      if (kind === 'avatar') pipeline.resize(512, 512, { fit: 'cover' });
      else pipeline.resize(1600, 600, { fit: 'cover' });
      await pipeline.webp({ quality: 86 }).toFile(fullPath);
    } catch (err) {
      Logger.warn('Conversion image impossible', err.message);
      return res.status(400).json({ error: 'invalid_image' });
    }

    const relUrl = `/uploads/${req.user.id}/${filename}`;
    Profile.update(req.user.id, { [kind]: relUrl });
    res.json({ ok: true, url: relUrl });
  }
}

module.exports = ApiController;
