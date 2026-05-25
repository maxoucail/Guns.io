/**
 * link2me — Routes Admin
 * Full admin panel: dashboard, users, badges, impersonation, blocking
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { nanoid } = require('nanoid');
const db = require('../db');
const { ensureAuth, ensureAdmin } = require('../middleware/auth');
const SocialLinks = require('../lib/SocialLinks');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// ── Auth (2FA-like for admin) ─────────────────────────────────
router.get('/admin/auth', ensureAuth, (req, res) => {
  if (!req.user.is_admin) return res.redirect('/dashboard');
  if (req.session.admin_verified) return res.redirect('/admin');
  res.render('admin/auth', {
    title: 'Accès Admin · link2me',
    user: req.user,
    SocialLinks,
    error: req.query.error || null,
  });
});

router.post('/admin/auth', ensureAuth, (req, res) => {
  if (!req.user.is_admin) return res.redirect('/dashboard');
  const input = (req.body.password || '').trim();
  if (!ADMIN_PASSWORD) return res.redirect('/admin/auth?error=not_configured');
  const hashInput = crypto.createHash('sha256').update(input).digest();
  const hashKnown = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  if (crypto.timingSafeEqual(hashInput, hashKnown)) {
    req.session.admin_verified = true;
    return res.redirect('/admin');
  }
  res.redirect('/admin/auth?error=wrong');
});

router.get('/admin/logout-admin', ensureAuth, (req, res) => {
  delete req.session.admin_verified;
  res.redirect('/dashboard');
});

router.get('/admin/stop-impersonate', ensureAuth, (req, res) => {
  const originalId = req.session.impersonating;
  if (!originalId) return res.redirect('/dashboard');
  const original = db.users.findOne({ id: originalId });
  if (!original) return res.redirect('/dashboard');
  delete req.session.impersonating;
  req.logIn(original, (err) => {
    if (err) return res.redirect('/dashboard');
    res.redirect('/admin');
  });
});

// ── Dashboard ─────────────────────────────────────────────────
router.get('/admin', ensureAdmin, (req, res) => {
  const stats = db.users.getStats();
  res.render('admin/index', {
    title: 'Admin · link2me',
    user: req.user,
    SocialLinks,
    stats,
  });
});

// ── Users list ────────────────────────────────────────────────
router.get('/admin/users', ensureAdmin, (req, res) => {
  const search = (req.query.q || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = 30;

  const users = db.users.search({ q: search, page, limit });
  const total = db.users.countSearch(search);
  const pages = Math.ceil(total / limit);

  res.render('admin/users', {
    title: 'Utilisateurs · Admin',
    user: req.user, SocialLinks,
    users, search, page, pages, total,
  });
});

// ── User detail ───────────────────────────────────────────────
router.get('/admin/users/:id', ensureAdmin, (req, res) => {
  const target = db.users.findOne({ id: req.params.id });
  if (!target) return res.status(404).render('404', { title: '404 · link2me' });
  const cfg = typeof target.pageConfig === 'string' ? JSON.parse(target.pageConfig || '{}') : (target.pageConfig || {});
  const badges = db.userBadges.findByUser(target.id);
  const allBadges = db.badges.findAll();

  res.render('admin/user', {
    title: `@${target.username || target.id} · Admin`,
    user: req.user, SocialLinks, target, cfg, badges, allBadges,
  });
});

// ── Set admin ─────────────────────────────────────────────────
router.post('/admin/users/:id/admin', ensureAdmin, (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) return res.status(400).json({ error: 'cannot_self' });
  const isAdmin = req.body.is_admin === '1' || req.body.is_admin === true;
  db.users.update({ id }, { $set: { is_admin: isAdmin ? 1 : 0, updated_at: Date.now() } });
  res.json({ ok: true });
});

// ── Block / Unblock ───────────────────────────────────────────
router.post('/admin/users/:id/block', ensureAdmin, (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) return res.status(400).json({ error: 'cannot_self' });
  const message = (req.body.message || '').trim().slice(0, 500) || null;
  db.users.update({ id }, { $set: { blocked: 1, blocked_message: message, updated_at: Date.now() } });
  res.json({ ok: true });
});

router.post('/admin/users/:id/unblock', ensureAdmin, (req, res) => {
  db.users.update({ id: req.params.id }, { $set: { blocked: 0, blocked_message: null, updated_at: Date.now() } });
  res.json({ ok: true });
});

// ── Delete user ───────────────────────────────────────────────
router.delete('/admin/users/:id', ensureAdmin, (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) return res.status(400).json({ error: 'cannot_self' });
  db.users.delete({ id });
  res.json({ ok: true });
});

// ── Impersonate ───────────────────────────────────────────────
router.post('/admin/users/:id/impersonate', ensureAdmin, (req, res) => {
  const target = db.users.findOne({ id: req.params.id });
  if (!target) return res.status(404).json({ error: 'not_found' });
  req.session.impersonating = req.user.id;
  req.logIn(target, (err) => {
    if (err) return res.status(500).json({ error: 'login_failed' });
    res.json({ ok: true, redirect: '/dashboard' });
  });
});

// ── Badges ────────────────────────────────────────────────────
router.get('/admin/badges', ensureAdmin, (req, res) => {
  const badges = db.badges.findAll();
  res.render('admin/badges', {
    title: 'Badges · Admin',
    user: req.user, SocialLinks, badges,
  });
});

router.post('/admin/badges', ensureAdmin, (req, res) => {
  const name = (req.body.name || '').trim().slice(0, 40);
  const description = (req.body.description || '').trim().slice(0, 200);
  const icon = (req.body.icon || '⭐').trim().slice(0, 8);
  const color = /^#[0-9a-fA-F]{3,6}$/.test(req.body.color || '') ? req.body.color : '#7c5cff';
  if (!name) return res.status(400).json({ error: 'name_required' });
  const id = nanoid(10);
  db.badges.insert({ id, name, description, icon, color });
  res.json({ ok: true, id });
});

router.delete('/admin/badges/:badgeId', ensureAdmin, (req, res) => {
  db.badges.delete(req.params.badgeId);
  res.json({ ok: true });
});

router.post('/admin/badges/:badgeId/assign/:userId', ensureAdmin, (req, res) => {
  const ok = db.userBadges.assign(req.params.userId, req.params.badgeId, req.user.id);
  if (!ok) return res.status(400).json({ error: 'already_assigned' });
  res.json({ ok: true });
});

router.delete('/admin/badges/:badgeId/revoke/:userId', ensureAdmin, (req, res) => {
  db.userBadges.revoke(req.params.userId, req.params.badgeId);
  res.json({ ok: true });
});

module.exports = router;
