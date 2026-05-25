/**
 * Sanitisation de pageConfig (serveur + schéma partagé)
 */

const ALLOWED_FONTS = new Set([
  'Space Grotesk', 'Unbounded', 'Orbitron', 'Fira Code', 'JetBrains Mono',
  'Raleway', 'Quicksand', 'Playfair Display',
]);

const ALLOWED_FX = new Set([
  'none', 'snow', 'rain', 'matrix', 'particles', 'stars',
  'bubbles', 'fireflies', 'confetti', 'hearts',
]);

const ALLOWED_CURSOR = new Set([
  'default', 'dot', 'ring', 'crosshair', 'star', 'cat', 'heart', 'sparkle', 'custom',
]);

const ALLOWED_BG_TYPES = new Set(['gradient', 'solid', 'image', 'video']);
const ALLOWED_LINK_STYLES = new Set(['full', 'icon', 'minimal']);
const FA_ICON_RE = /^fa-(solid|regular|brands)\s+fa-[\w-]+$/;
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function clampInt(n, min, max, fallback) {
  const v = parseInt(n, 10);
  if (Number.isNaN(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function sanitizeText(s, maxLen = 500) {
  return String(s ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/</g, '\u003c')
    .replace(/>/g, '\u003e')
    .slice(0, maxLen);
}

function sanitizeColor(c, fallback = '#7c5cff') {
  if (typeof c !== 'string') return fallback;
  const t = c.trim();
  return HEX_COLOR_RE.test(t) ? t : fallback;
}

function sanitizeUrl(url, { allowRelative = true } = {}) {
  if (typeof url !== 'string' || !url.trim()) return '';
  const t = url.trim();
  if (allowRelative && /^\/uploads\/[a-z0-9_./-]+$/i.test(t)) return t;
  if (/^mailto:[^\s<>'"]+$/i.test(t)) return t; // ← ajouter ça
  if (!/^https?:\/\//i.test(t)) return '';
  try {
    const u = new URL(t);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
  } catch { /* invalid */ }
  return '';
}

function sanitizeIcon(icon) {
  const t = String(icon ?? '').trim();
  return FA_ICON_RE.test(t) ? t : 'fa-solid fa-link';
}

function sanitizeMusic(m) {
  if (!m || typeof m !== 'object') return null;
  const title  = sanitizeText(m.title, 120);
  const artist = sanitizeText(m.artist, 120);
  const cover   = sanitizeUrl(m.cover, { allowRelative: false });
  const preview = sanitizeUrl(m.preview, { allowRelative: false });
  if (!title || !preview) return null;
  return { title, artist, cover, preview };
}

function sanitizePageConfig(raw = {}) {
  const links = Array.isArray(raw.links)
    ? raw.links.map((l, i) => {
        const url = sanitizeUrl(l?.url);
        return {
          id:    typeof l?.id === 'number' ? l.id : Date.now() + i,
          label: sanitizeText(l?.label, 80),
          url:   url || 'https://example.com',
          icon:  sanitizeIcon(l?.icon),
          color: sanitizeColor(l?.color),
        };
      }).filter(l => l.label)
    : [];

  return {
    displayName: sanitizeText(raw.displayName, 60),
    bio:         sanitizeText(raw.bio, 500),
    location:    sanitizeText(raw.location, 80),
    bgType:      ALLOWED_BG_TYPES.has(raw.bgType) ? raw.bgType : 'gradient',
    bgColor1:    sanitizeColor(raw.bgColor1, '#0B1020'),
    bgColor2:    sanitizeColor(raw.bgColor2, '#1a0b30'),
    bgSolid:     sanitizeColor(raw.bgSolid, '#0B1020'),
    bgImageUrl:  sanitizeUrl(raw.bgImageUrl),
    bgVideoUrl:  sanitizeUrl(raw.bgVideoUrl),
    overlayOpacity: clampInt(raw.overlayOpacity, 0, 90, 40),
    accentColor: sanitizeColor(raw.accentColor),
    theme:       sanitizeText(raw.theme, 32),
    linkStyle:   ALLOWED_LINK_STYLES.has(raw.linkStyle) ? raw.linkStyle : 'full',
    links,
    fx:          ALLOWED_FX.has(raw.fx) ? raw.fx : 'none',
    fxIntensity: clampInt(raw.fxIntensity, 1, 10, 5),
    font:        ALLOWED_FONTS.has(raw.font) ? raw.font : 'Space Grotesk',
    textColor:   sanitizeColor(raw.textColor, '#ffffff'),
    twName:      !!raw.twName,
    twBio:       !!raw.twBio,
    twTexts:     sanitizeText(raw.twTexts, 200),
    cursor:      ALLOWED_CURSOR.has(raw.cursor) ? raw.cursor : 'default',
    cursorColor: sanitizeColor(raw.cursorColor),
    cursorImageUrl: sanitizeUrl(raw.cursorImageUrl),
    avatarUrl:   sanitizeUrl(raw.avatarUrl),
    music:       sanitizeMusic(raw.music),
    musicVolume: clampInt(raw.musicVolume, 0, 100, 50),
    musicAutoplay: !!raw.musicAutoplay,
  };
}

/** Échappement HTML (côté client possible via copie légère) */
function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** CSS url() — rejette les guillemets et parenthèses */
function cssUrl(url) {
  const safe = sanitizeUrl(url);
  if (!safe) return '';
  return safe.replace(/['"()\\]/g, '');
}

/** Couleur pour insertion dans style inline */
function cssColor(c, fallback = '#7c5cff') {
  return sanitizeColor(c, fallback);
}

module.exports = {
  sanitizePageConfig,
  sanitizeIcon,
  sanitizeUrl,
  sanitizeColor,
  escHtml,
  cssUrl,
  cssColor,
  FA_ICON_RE,
};
