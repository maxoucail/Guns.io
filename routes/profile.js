/**
 * link2me — Routes Profile
 * Public profile page with effects, badges, music, views tracking
 */
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const SocialLinks = require('../lib/SocialLinks');
const Validator = require('../lib/Validator');

// ── Public profile ────────────────────────────────────────────
router.get('/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    const reserved = ['dashboard', 'editor', 'login', 'register', 'onboarding', 'auth', 'api', 'css', 'js', 'images', 'uploads', 'terms', 'privacy', 'sitemap.xml', 'robots.txt', 'favicon.ico'];
    if (reserved.includes(username.toLowerCase())) return next();

    const user = db.users.findOne({ username: username.toLowerCase() });
    if (!user) return next();

    // Count view (not for preview)
    if (!req.query.preview) {
      const stats = user.stats || { totalViews: 0, todayViews: 0, todayDate: '', totalClicks: 0 };
      stats.totalViews = (stats.totalViews || 0) + 1;
      const today = new Date().toISOString().split('T')[0];
      if (stats.todayDate === today) {
        stats.todayViews = (stats.todayViews || 0) + 1;
      } else {
        stats.todayViews = 1;
        stats.todayDate = today;
      }
      db.users.update({ id: user.id }, { $set: { stats } });

      // Update last IP/seen
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim() || req.socket?.remoteAddress || null;
      db.users.update({ id: user.id }, { $set: { last_ip: ip, last_seen_at: Date.now() } });
    }

    const cfg = typeof user.pageConfig === 'string'
      ? JSON.parse(user.pageConfig || '{}')
      : (user.pageConfig || {});

    const badges = db.userBadges.findByUser(user.id);
    const isOwner = req.user && req.user.id === user.id;

    res.render('profile', {
      title: `${cfg.displayName || '@' + user.username} · link2me`,
      owner: user,
      cfg,
      SocialLinks,
      badges,
      isOwner,
      isPreview: !!req.query.preview,
      siteUrl: process.env.SITE_URL || process.env.BASE_URL || 'http://localhost:4816',
    });
  } catch (err) {
    console.error('[profile]', err);
    next(err);
  }
});

// ── Track click ───────────────────────────────────────────────
router.post('/api/click/:username', async (req, res) => {
  try {
    const user = db.users.findOne({ username: req.params.username.toLowerCase() });
    if (!user) return res.json({ ok: false });
    const stats = user.stats || {};
    stats.totalClicks = (stats.totalClicks || 0) + 1;
    db.users.update({ id: user.id }, { $set: { stats } });
    res.json({ ok: true });
  } catch { res.json({ ok: false }); }
});

module.exports = router;
