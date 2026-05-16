'use strict';

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const AuthController    = require('../controllers/AuthController');
const ProfileController = require('../controllers/ProfileController');
const ApiController     = require('../controllers/ApiController');
const { ensureAuth, ensureUsername } = require('../middleware/auth');
const Config = require('../config/Config');

const MAX_UPLOAD = 98 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD }
});

const writeLimit = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const authLimit  = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

function build() {
  const router = express.Router();

  router.get('/', (req, res) => {
    if (req.user && req.user.username) return res.redirect('/dashboard');
    res.render('index', {
      title: 'link2me · Ta page perso, sublime, gratuite',
      user: req.user || null
    });
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

  router.get('/welcome',         ensureAuth, ProfileController.welcomePage);
  router.post('/welcome',        ensureAuth, writeLimit, ProfileController.claimUsername);

  router.get('/dashboard', ensureAuth, ensureUsername, ProfileController.dashboard);
  router.get('/editor',    ensureAuth, ensureUsername, ProfileController.editor);

  router.get('/api/username',    ApiController.checkUsername);
  router.get('/api/music',       ApiController.musicSearch);
  router.post('/api/profile',    ensureAuth, ensureUsername, writeLimit, express.json({ limit: '256kb' }), ApiController.updateProfile);
  router.post('/api/upload',     ensureAuth, ensureUsername, writeLimit, upload.single('file'), ApiController.uploadImage);

  router.get('/:username', ProfileController.publicProfile);

  return router;
}

module.exports = { build };
