/**
 * link2me — Routes Editor
 * Full profile editor with effects, fonts, particles, music, uploads
 */
const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const sharp   = require('sharp');
const multer  = require('multer');
const db      = require('../db');
const { ensureAuth, ensureUsername } = require('../middleware/auth');
const Validator = require('../lib/Validator');
const SocialLinks = require('../lib/SocialLinks');
const Deezer = require('../services/DeezerService');
const YouTube = require('../services/YouTubeService');
const GhStorage = require('../services/GitHubStorageService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 98 * 1024 * 1024 },
});

const VALID_BG_TYPES    = new Set(['color', 'gradient', 'image', 'video']);
const VALID_USERNAME_FX = new Set(['none', 'glow', 'shimmer', 'rainbow', 'glitch']);
const VALID_CURSOR_FX   = new Set(['none', 'trail', 'sparkle', 'glow', 'dot', 'ring', 'star', 'heart']);
const VALID_PARTICLES   = new Set(['none', 'stars', 'snow', 'bubbles', 'matrix', 'fireflies', 'confetti', 'hearts', 'rain']);
const VALID_FONTS       = new Set(['Inter', 'Geist', 'Space Grotesk', 'JetBrains Mono', 'Outfit', 'Poppins', 'Unbounded', 'Orbitron', 'Fira Code', 'Raleway', 'Quicksand', 'Playfair Display']);
const VALID_LINK_STYLES = new Set(['full', 'icon', 'minimal']);

const SOCIAL_PLATFORMS = new Set([
  'discord', 'twitter', 'instagram', 'tiktok', 'youtube',
  'twitch', 'spotify', 'soundcloud', 'github', 'telegram',
  'snapchat', 'kick', 'roblox', 'steam', 'email', 'website',
]);

const EXT_MAP = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp',
  'image/gif': '.gif', 'image/avif': '.avif',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
};
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

// ── Editor page ───────────────────────────────────────────────
router.get('/editor', ensureAuth, ensureUsername, (req, res) => {
  const pageConfig = typeof req.user.pageConfig === 'string'
    ? JSON.parse(req.user.pageConfig || '{}')
    : (req.user.pageConfig || {});

  res.render('editor', {
    title: 'Éditeur · link2me',
    user: req.user,
    SocialLinks,
    pageConfig,
    VALID_BG_TYPES: Array.from(VALID_BG_TYPES),
    VALID_USERNAME_FX: Array.from(VALID_USERNAME_FX),
    VALID_CURSOR_FX: Array.from(VALID_CURSOR_FX),
    VALID_PARTICLES: Array.from(VALID_PARTICLES),
    VALID_FONTS: Array.from(VALID_FONTS),
    VALID_LINK_STYLES: Array.from(VALID_LINK_STYLES),
    SOCIAL_PLATFORMS: Array.from(SOCIAL_PLATFORMS),
  });
});

// ── Save config ───────────────────────────────────────────────
router.post('/api/save-config', ensureAuth, express.json({ limit: '512kb' }), async (req, res) => {
  try {
    const data = req.body || {};
    const cfg = typeof req.user.pageConfig === 'string'
      ? JSON.parse(req.user.pageConfig || '{}')
      : (req.user.pageConfig || {});

    // Apply updates with validation
    if ('displayName' in data)        cfg.displayName = Validator.sanitizeText(String(data.displayName || ''), 60);
    if ('bio' in data)                cfg.bio = Validator.sanitizeText(String(data.bio || ''), 500);
    if ('location' in data)           cfg.location = Validator.sanitizeText(String(data.location || ''), 80);
    if ('splash_text' in data)        cfg.splash_text = Validator.sanitizeText(String(data.splash_text || ''), 60);
    if ('splash_enabled' in data)     cfg.splash_enabled = !!data.splash_enabled;

    if ('accent_color' in data && Validator.hexColor(data.accent_color)) cfg.accentColor = data.accent_color;
    if ('text_color' in data && Validator.hexColor(data.text_color))     cfg.textColor = data.text_color;
    if ('bgColor1' in data && Validator.hexColor(data.bgColor1))         cfg.bgColor1 = data.bgColor1;
    if ('bgColor2' in data && Validator.hexColor(data.bgColor2))         cfg.bgColor2 = data.bgColor2;
    if ('bgSolid' in data && Validator.hexColor(data.bgSolid))           cfg.bgSolid = data.bgSolid;
    if ('bg_type' in data && VALID_BG_TYPES.has(data.bg_type))           cfg.bgType = data.bg_type || cfg.bgType;

    if ('bgValue' in data && typeof data.bgValue === 'string' && data.bgValue.length < 4096) cfg.bgValue = data.bgValue;
    if ('bgImageUrl' in data)    cfg.bgImageUrl = Validator.safeUrl(data.bgImageUrl) || '';
    if ('bgVideoUrl' in data)    cfg.bgVideoUrl = Validator.safeUrl(data.bgVideoUrl) || '';
    if ('overlayOpacity' in data) cfg.overlayOpacity = Validator.clamp(data.overlayOpacity, 0, 95);
    if ('avatarUrl' in data)     cfg.avatarUrl = Validator.safeUrl(data.avatarUrl) || '';
    if ('banner_url' in data)    cfg.banner_url = Validator.safeUrl(data.banner_url) || '';

    if ('username_effect' in data && VALID_USERNAME_FX.has(data.username_effect)) cfg.usernameEffect = data.username_effect;
    if ('cursor_effect' in data && VALID_CURSOR_FX.has(data.cursor_effect))       cfg.cursorEffect = data.cursor_effect;
    if ('cursorColor' in data && Validator.hexColor(data.cursorColor))            cfg.cursorColor = data.cursorColor;
    if ('particles' in data && VALID_PARTICLES.has(data.particles))               cfg.particles = data.particles;
    if ('fxIntensity' in data)     cfg.fxIntensity = Validator.clamp(data.fxIntensity, 1, 10);
    if ('font' in data && VALID_FONTS.has(data.font))                             cfg.font = data.font;
    if ('linkStyle' in data && VALID_LINK_STYLES.has(data.linkStyle))             cfg.linkStyle = data.linkStyle;
    if ('theme' in data)           cfg.theme = Validator.sanitizeText(String(data.theme || ''), 32);

    if ('music_volume' in data) cfg.musicVolume = Validator.clamp(data.music_volume, 0, 100);
    if ('music_autoplay' in data) cfg.musicAutoplay = !!data.music_autoplay;
    if ('nsfw' in data) cfg.nsfw = !!data.nsfw;
    if ('bio_widget' in data) cfg.bio_widget = !!data.bio_widget;
    if ('twName' in data) cfg.twName = !!data.twName;
    if ('twBio' in data) cfg.twBio = !!data.twBio;
    if ('twTexts' in data) cfg.twTexts = Validator.sanitizeText(String(data.twTexts || ''), 200);

    // Social links
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
      cfg.social_links = clean;
    }

    // Custom links
    if ('custom_links' in data && Array.isArray(data.custom_links)) {
      const clean = [];
      for (const l of data.custom_links.slice(0, 15)) {
        if (!l || typeof l !== 'object') continue;
        const label = Validator.sanitizeText(String(l.label || ''), 60);
        const url = Validator.safeUrl(l.url);
        if (!label || !url) continue;
        clean.push({ label, url, icon: l.icon || 'fa-solid fa-link', color: Validator.hexColor(l.color) ? l.color : '#7c5cff' });
      }
      cfg.custom_links = clean;
    }

    // Music track
    if ('music_track' in data) {
      const t = data.music_track;
      if (t === null) {
        cfg.music = null;
      } else if (t && typeof t === 'object' && t.preview && t.title) {
        cfg.music = {
          id: String(t.id || ''),
          title: Validator.sanitizeText(String(t.title), 120),
          artist: Validator.sanitizeText(String(t.artist || ''), 120),
          cover: Validator.safeUrl(t.cover) || null,
          preview: Validator.safeUrl(t.preview),
          source: t.source || 'deezer',
        };
        if (!cfg.music.preview) delete cfg.music;
      }
    }

    if ('music' in data) {
      const m = data.music;
      if (m === null) {
        cfg.music = null;
      } else if (m && typeof m === 'object' && m.preview) {
        cfg.music = {
          id: String(m.id || ''), title: Validator.sanitizeText(String(m.title), 120),
          artist: Validator.sanitizeText(String(m.artist || ''), 120),
          cover: Validator.safeUrl(m.cover) || null, preview: Validator.safeUrl(m.preview),
          source: m.source || 'deezer',
        };
      }
    }

    db.users.update(
      { id: req.user.id },
      { $set: { pageConfig: JSON.stringify(cfg), updated_at: Date.now() } }
    );

    res.json({ ok: true, pageConfig: cfg });
  } catch (err) {
    console.error('[editor] save-config:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Music search (Deezer + YouTube) ──────────────────────────
router.get('/api/music-search', ensureAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ results: [] });
    const [dz, yt] = await Promise.all([Deezer.search(q, 10), YouTube.search(q, 6)]);
    res.json({ results: [...dz, ...yt] });
  } catch (err) {
    console.error('[editor] music-search:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── Upload image (avatar/banner/bg) ──────────────────────────
router.post('/api/upload', ensureAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no_file' });

  const kind = ['avatar', 'banner', 'bg'].includes(req.body.kind) ? req.body.kind : 'avatar';
  const mime = req.file.mimetype || '';
  let buffer = req.file.buffer;
  let ext;

  if (kind === 'bg') {
    if (!VIDEO_MIMES.has(mime) && !IMAGE_MIMES.has(mime)) {
      return res.status(400).json({ error: 'unsupported_type' });
    }
    ext = EXT_MAP[mime] || '.bin';
  } else {
    if (!IMAGE_MIMES.has(mime)) {
      return res.status(400).json({ error: 'unsupported_type' });
    }
    try {
      if (kind === 'avatar') {
        buffer = await sharp(buffer).resize(512, 512, { fit: 'cover' }).webp({ quality: 86 }).toBuffer();
      } else {
        buffer = await sharp(buffer).resize(1600, 600, { fit: 'cover' }).webp({ quality: 86 }).toBuffer();
      }
    } catch (err) {
      console.warn('[editor] Image conversion failed:', err.message);
      return res.status(400).json({ error: 'invalid_image' });
    }
    ext = '.webp';
  }

  const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 10);
  const filename = `${kind}-${hash}${ext}`;

  if (GhStorage.isConfigured()) {
    try {
      const ghPath = `uploads/${req.user.id}/${filename}`;
      const url = await GhStorage.upload(buffer, ghPath);
      return res.json({ ok: true, url });
    } catch (err) {
      console.error('[editor] GitHub upload failed:', err.message);
      return res.status(500).json({ error: 'github_upload_failed', detail: err.message });
    }
  }

  // Fallback: local filesystem
  const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
  fs.mkdirSync(path.join(uploadsDir, kind), { recursive: true });
  const filePath = path.join(uploadsDir, kind, filename);
  fs.writeFileSync(filePath, buffer);
  res.json({ ok: true, url: `/uploads/${kind}/${filename}` });
});

module.exports = router;
