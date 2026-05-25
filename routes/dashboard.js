/**
 * link2me — Routes Dashboard
 * User dashboard with stats and quick actions
 */
const express = require('express');
const router = express.Router();
const { ensureAuth, ensureUsername } = require('../middleware/auth');
const db = require('../db');
const SocialLinks = require('../lib/SocialLinks');

router.get('/dashboard', ensureAuth, ensureUsername, (req, res) => {
  const stats = req.user.stats || { totalViews: 0, todayViews: 0, totalClicks: 0 };
  const pageConfig = req.user.pageConfig || {};
  const badges = db.userBadges.findByUser(req.user.id);

  res.render('dashboard', {
    title: `Dashboard · @${req.user.username} · link2me`,
    user: req.user,
    SocialLinks,
    stats,
    pageConfig,
    badges,
    siteUrl: process.env.SITE_URL || process.env.BASE_URL || 'http://localhost:4816',
  });
});

// ── Delete account ────────────────────────────────────────────
router.post('/api/delete-account', ensureAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const sqlite = db._sqlite;

    // Delete related data first (foreign keys cascade, but do it explicitly for safety)
    sqlite.prepare('DELETE FROM user_badges WHERE user_id = ?').run(userId);
    sqlite.prepare('DELETE FROM gdpr WHERE userId = ?').run(userId);
    db.users.delete({ id: userId });

    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie('link2me.sid');
        res.clearCookie('connect.sid');
        res.redirect('/');
      });
    });
  } catch (err) {
    console.error('[dashboard] delete-account:', err);
    res.status(500).render('500', { title: '500 · link2me' });
  }
});

module.exports = router;
