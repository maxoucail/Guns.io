'use strict';

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const AuthController    = require('../controllers/AuthController');
const ProfileController = require('../controllers/ProfileController');
const ApiController     = require('../controllers/ApiController');
const AdminController   = require('../controllers/AdminController');
const { ensureAuth, ensureUsername, ensureAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Config = require('../config/Config');

const MAX_UPLOAD = 98 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD }
});

const writeLimit = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const authLimit  = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const adminLimit = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });

const getIp = (req) => {
  const xff = req.headers['x-forwarded-for'];
  return xff ? xff.split(',')[0].trim() : req.socket?.remoteAddress || null;
};

function build() {
  const router = express.Router();

  router.get('/', (req, res) => {
    if (req.user) return res.redirect(req.user.username ? '/dashboard' : '/welcome');
    res.render('index', { title: 'link2me · Ta page perso, sublime, gratuite', user: null });
  });

  router.get('/login',  authLimit, AuthController.loginPage);
  router.get('/logout', AuthController.logout);
  router.post('/logout', AuthController.logout);

  if (Config.googleEnabled()) {
    router.get('/auth/google', authLimit, AuthController.google);
    router.get(Config.oauth.google.callbackPath, AuthController.googleCallback);
  }
  if (Config.discordEnabled()) {
    router.get('/auth/discord', authLimit, AuthController.discord);
    router.get(Config.oauth.discord.callbackPath, AuthController.discordCallback);
  }

  router.get('/welcome',  ensureAuth, ProfileController.welcomePage);
  router.post('/welcome', ensureAuth, writeLimit, ProfileController.claimUsername);

  router.get('/dashboard', ensureAuth, ensureUsername, (req, res, next) => {
    if (req.user.blocked) return res.render('blocked', { title: 'Compte suspendu', user: req.user });
    next();
  }, ProfileController.dashboard);

  router.get('/editor', ensureAuth, ensureUsername, (req, res, next) => {
    if (req.user.blocked) return res.render('blocked', { title: 'Compte suspendu', user: req.user });
    next();
  }, ProfileController.editor);

  router.get('/api/username', ApiController.checkUsername);
  router.get('/api/music',    ApiController.musicSearch);
  router.post('/api/profile', ensureAuth, ensureUsername, writeLimit, express.json({ limit: '256kb' }), ApiController.updateProfile);
  router.post('/api/upload',  ensureAuth, ensureUsername, writeLimit, upload.single('file'), ApiController.uploadImage);

  router.get('/admin/stop-impersonate', ensureAuth, AdminController.stopImpersonate);
  router.get('/admin',              ensureAdmin, adminLimit, AdminController.dashboard);
  router.get('/admin/users',        ensureAdmin, adminLimit, AdminController.listUsers);
  router.get('/admin/users/:id',    ensureAdmin, adminLimit, AdminController.viewUser);
  router.get('/admin/badges',       ensureAdmin, adminLimit, AdminController.listBadges);
  router.post('/admin/badges',              ensureAdmin, express.json({ limit: '8kb' }), AdminController.createBadge);
  router.delete('/admin/badges/:badgeId',   ensureAdmin, AdminController.deleteBadge);
  router.post('/admin/users/:id/admin',     ensureAdmin, express.json({ limit: '1kb' }), AdminController.setAdmin);
  router.post('/admin/users/:id/block',     ensureAdmin, express.json({ limit: '2kb' }), AdminController.blockUser);
  router.post('/admin/users/:id/unblock',   ensureAdmin, AdminController.unblockUser);
  router.delete('/admin/users/:id',         ensureAdmin, AdminController.deleteUser);
  router.post('/admin/users/:id/impersonate', ensureAdmin, AdminController.impersonate);
  router.post('/admin/badges/:badgeId/assign/:userId',  ensureAdmin, AdminController.assignBadge);
  router.delete('/admin/badges/:badgeId/revoke/:userId', ensureAdmin, AdminController.revokeBadge);

  router.get('/:username', (req, res, next) => {
    if (req.user && req.isAuthenticated()) {
      User.updateLastSeen(req.user.id, getIp(req));
    }
    next();
  }, ProfileController.publicProfile);

  return router;
}

module.exports = { build };
