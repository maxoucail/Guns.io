'use strict';

const RESERVED = new Set([
  'admin', 'api', 'auth', 'login', 'logout', 'register', 'dashboard',
  'editor', 'settings', 'me', 'profile', 'public', 'static', 'assets',
  'welcome', 'onboarding',
  'help', 'support', 'about', 'tos', 'privacy', 'contact', 'home',
  'discord', 'google', 'callback', 'uploads', 'css', 'js', 'img',
  'favicon.ico', 'robots.txt', 'sitemap.xml', '404', '500'
]);

class Validator {
  static username(name) {
    if (typeof name !== 'string') return 'invalid';
    name = name.trim().toLowerCase();
    if (name.length < 3) return 'too_short';
    if (name.length > 20) return 'too_long';
    if (!/^[a-z0-9_.]+$/.test(name)) return 'invalid_chars';
    if (RESERVED.has(name)) return 'reserved';
    return null;
  }

  static hexColor(c) {
    return typeof c === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c);
  }

  static clamp(n, min, max) {
    n = parseInt(n, 10);
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  static sanitizeText(s, max = 500) {
    if (typeof s !== 'string') return '';
    let out = '';
    for (let i = 0; i < s.length && out.length < max; i++) {
      const code = s.charCodeAt(i);
      if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)) {
        out += s[i];
      }
    }
    return out;
  }

  static safeUrl(url) {
    if (typeof url !== 'string') return null;
    url = url.trim();
    if (!url) return null;
    try {
      const u = new URL(url);
      if (!['http:', 'https:'].includes(u.protocol)) return null;
      return u.toString();
    } catch { return null; }
  }
}

module.exports = Validator;
