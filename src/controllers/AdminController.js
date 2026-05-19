'use strict';

const crypto = require('crypto');
const { nanoid } = require('nanoid');
const GhData = require('../services/GitHubDataService');
const Config = require('../config/Config');
const User = require('../models/User');
const Profile = require('../models/Profile');

class AdminController {
  static authPage(req, res) {
    if (!req.user || !req.user.is_admin) return res.redirect('/dashboard');
    if (req.session.admin_verified) return res.redirect('/admin');
    res.render('admin/auth', { title: 'Accès Admin · link2me', user: req.user, error: req.query.error || null });
  }

  static verifyAuth(req, res) {
    if (!req.user || !req.user.is_admin) return res.redirect('/dashboard');
    const input = (req.body.password || '').trim();
    const known = Config.adminPassword();
    if (!known) return res.redirect('/admin/auth?error=not_configured');
    const hashInput = crypto.createHash('sha256').update(input).digest();
    const hashKnown = crypto.createHash('sha256').update(known).digest();
    if (crypto.timingSafeEqual(hashInput, hashKnown)) {
      req.session.admin_verified = true;
      return res.redirect('/admin');
    }
    res.redirect('/admin/auth?error=wrong');
  }

  static logoutAdmin(req, res) {
    delete req.session.admin_verified;
    res.redirect('/dashboard');
  }

  static dashboard(req, res) {
    const stats = GhData.getStats();
    res.render('admin/index', { title: 'Admin · link2me', user: req.user, stats });
  }

  static listUsers(req, res) {
    const search = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 30;
    const users = User.findAll({ page, limit, search });
    const total = User.count(search);
    const pages = Math.ceil(total / limit);
    // Attach profile views for the table
    const profiles = users.map(u => GhData.getProfile(u.id)).filter(Boolean);
    const profileMap = {};
    profiles.forEach(p => { profileMap[p.user_id] = p; });
    res.render('admin/users', { title: 'Utilisateurs · Admin', user: req.user, users, search, page, pages, total, profileMap });
  }

  static viewUser(req, res) {
    const u = User.findById(req.params.id);
    if (!u) return res.status(404).render('404', { title: '404' });
    const profile = Profile.getByUserId(u.id);
    const badges = User.getBadges(u.id);
    const allBadges = GhData.getAllBadges();
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
    const badges = GhData.getAllBadges();
    res.render('admin/badges', { title: 'Badges · Admin', user: req.user, badges });
  }

  static createBadge(req, res) {
    const name = (req.body.name || '').trim().slice(0, 40);
    const description = (req.body.description || '').trim().slice(0, 200);
    const icon = (req.body.icon || '⭐').trim().slice(0, 8);
    const color = /^#[0-9a-fA-F]{3,6}$/.test(req.body.color || '') ? req.body.color : '#7c5cff';
    if (!name) return res.status(400).json({ error: 'name_required' });
    const id = nanoid(10);
    GhData.insertBadge({ id, name, description, icon, color });
    res.json({ ok: true, id });
  }

  static deleteBadge(req, res) {
    GhData.deleteBadge(req.params.badgeId);
    res.json({ ok: true });
  }

  static assignBadge(req, res) {
    const { userId, badgeId } = req.params;
    const ok = GhData.assignBadge(userId, badgeId, req.user.id);
    if (!ok) return res.status(400).json({ error: 'already_assigned' });
    res.json({ ok: true });
  }

  static revokeBadge(req, res) {
    GhData.revokeBadge(req.params.userId, req.params.badgeId);
    res.json({ ok: true });
  }
}

module.exports = AdminController;
