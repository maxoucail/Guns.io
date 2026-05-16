'use strict';

const { nanoid } = require('nanoid');
const Db = require('../config/Database');
const User = require('../models/User');
const Profile = require('../models/Profile');

class AdminController {
  static dashboard(req, res) {
    const stats = {
      users: Db.prepare('SELECT COUNT(*) as n FROM users').get().n,
      blocked: Db.prepare('SELECT COUNT(*) as n FROM users WHERE blocked = 1').get().n,
      admins: Db.prepare('SELECT COUNT(*) as n FROM users WHERE is_admin = 1').get().n,
      views: Db.prepare('SELECT SUM(views) as n FROM profiles').get().n || 0
    };
    res.render('admin/index', { title: 'Admin · link2me', user: req.user, stats });
  }

  static listUsers(req, res) {
    const search = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 30;
    const users = User.findAll({ page, limit, search });
    const total = User.count(search);
    const pages = Math.ceil(total / limit);
    res.render('admin/users', { title: 'Utilisateurs · Admin', user: req.user, users, search, page, pages, total });
  }

  static viewUser(req, res) {
    const u = User.findById(req.params.id);
    if (!u) return res.status(404).render('404', { title: '404' });
    const profile = Profile.getByUserId(u.id);
    const badges = User.getBadges(u.id);
    const allBadges = Db.prepare('SELECT * FROM badges ORDER BY name').all();
    res.render('admin/user', { title: `@${u.username || u.id} · Admin`, user: req.user, target: u, profile, badges, allBadges });
  }

  static setAdmin(req, res) {
    const { id } = req.params;
    const isAdmin = req.body.is_admin === '1' || req.body.is_admin === true;
    if (id === req.user.id) return res.status(400).json({ error: 'cannot_self' });
    User.setAdmin(id, isAdmin);
    res.json({ ok: true });
  }

  static blockUser(req, res) {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'cannot_self' });
    const message = (req.body.message || '').trim().slice(0, 500) || null;
    User.block(id, message);
    res.json({ ok: true });
  }

  static unblockUser(req, res) {
    User.unblock(req.params.id);
    res.json({ ok: true });
  }

  static deleteUser(req, res) {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'cannot_self' });
    User.delete(id);
    res.json({ ok: true });
  }

  static impersonate(req, res) {
    const { id } = req.params;
    const target = User.findById(id);
    if (!target) return res.status(404).json({ error: 'not_found' });
    req.session.impersonating = req.user.id;
    req.logIn(target, (err) => {
      if (err) return res.status(500).json({ error: 'login_failed' });
      res.json({ ok: true, redirect: '/dashboard' });
    });
  }

  static stopImpersonate(req, res) {
    const originalId = req.session.impersonating;
    if (!originalId) return res.redirect('/dashboard');
    const original = User.findById(originalId);
    if (!original) return res.redirect('/dashboard');
    delete req.session.impersonating;
    req.logIn(original, (err) => {
      if (err) return res.redirect('/dashboard');
      res.redirect('/admin');
    });
  }

  static listBadges(req, res) {
    const badges = Db.prepare('SELECT * FROM badges ORDER BY name').all();
    res.render('admin/badges', { title: 'Badges · Admin', user: req.user, badges });
  }

  static createBadge(req, res) {
    const name = (req.body.name || '').trim().slice(0, 40);
    const description = (req.body.description || '').trim().slice(0, 200);
    const icon = (req.body.icon || '⭐').trim().slice(0, 8);
    const color = /^#[0-9a-fA-F]{3,6}$/.test(req.body.color || '') ? req.body.color : '#7c5cff';
    if (!name) return res.status(400).json({ error: 'name_required' });
    const id = nanoid(10);
    Db.prepare('INSERT INTO badges (id, name, description, icon, color) VALUES (?, ?, ?, ?, ?)').run(id, name, description, icon, color);
    res.json({ ok: true, id });
  }

  static deleteBadge(req, res) {
    Db.prepare('DELETE FROM badges WHERE id = ?').run(req.params.badgeId);
    res.json({ ok: true });
  }

  static assignBadge(req, res) {
    const { userId, badgeId } = req.params;
    try {
      Db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id, awarded_at, awarded_by) VALUES (?, ?, ?, ?)').run(userId, badgeId, Date.now(), req.user.id);
      res.json({ ok: true });
    } catch { res.status(400).json({ error: 'failed' }); }
  }

  static revokeBadge(req, res) {
    Db.prepare('DELETE FROM user_badges WHERE user_id = ? AND badge_id = ?').run(req.params.userId, req.params.badgeId);
    res.json({ ok: true });
  }
}

module.exports = AdminController;
