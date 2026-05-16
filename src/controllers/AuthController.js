'use strict';

const passport = require('passport');
const Config = require('../config/Config');

class AuthController {
  static loginPage(req, res) {
    if (req.user) return res.redirect('/dashboard');
    res.render('login', {
      title: 'Connexion · link2me',
      googleEnabled: Config.googleEnabled(),
      discordEnabled: Config.discordEnabled(),
      error: req.query.error || null
    });
  }

  static logout(req, res, next) {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/');
      });
    });
  }

  static google(req, res, next) {
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  }

  static googleCallback(req, res, next) {
    passport.authenticate('google', {
      failureRedirect: '/login?error=google_failed'
    }, (err, user) => {
      if (err || !user) return res.redirect('/login?error=google_failed');
      if (user.blocked) return res.redirect('/login?error=blocked');
      req.session.regenerate((rErr) => {
        if (rErr) return next(rErr);
        req.logIn(user, (lErr) => {
          if (lErr) return next(lErr);
          res.redirect(user.username ? '/dashboard' : '/welcome');
        });
      });
    })(req, res, next);
  }

  static discord(req, res, next) {
    passport.authenticate('discord', { scope: ['identify', 'email'] })(req, res, next);
  }

  static discordCallback(req, res, next) {
    passport.authenticate('discord', {
      failureRedirect: '/login?error=discord_failed'
    }, (err, user) => {
      if (err || !user) return res.redirect('/login?error=discord_failed');
      if (user.blocked) return res.redirect('/login?error=blocked');
      req.session.regenerate((rErr) => {
        if (rErr) return next(rErr);
        req.logIn(user, (lErr) => {
          if (lErr) return next(lErr);
          res.redirect(user.username ? '/dashboard' : '/welcome');
        });
      });
    })(req, res, next);
  }
}

module.exports = AuthController;
