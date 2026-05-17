'use strict';

const User = require('../models/User');
const Profile = require('../models/Profile');
const Validator = require('../utils/Validator');
const Config = require('../config/Config');

class ProfileController {
  static welcomePage(req, res) {
    if (req.user.username) return res.redirect('/dashboard');
    res.render('welcome', {
      title: 'Choisis ton pseudo · link2me',
      user: req.user,
      error: req.query.error || null
    });
  }

  static claimUsername(req, res) {
    const raw = (req.body.username || '').trim();
    const err = Validator.username(raw);
    if (err) return res.redirect('/welcome?error=' + err);
    if (User.usernameExists(raw)) return res.redirect('/welcome?error=taken');
    const u = User.findById(req.user.id);
    try {
      u.setUsername(raw.toLowerCase());
    } catch (e) {
      return res.redirect('/welcome?error=taken');
    }
    req.user.username = u.username;
    res.redirect('/dashboard');
  }

  static dashboard(req, res) {
    const profile = Profile.getByUserId(req.user.id);
    res.render('dashboard', {
      title: 'Mon profil · link2me',
      user: req.user,
      profile
    });
  }

  static editor(req, res) {
    const profile = Profile.getByUserId(req.user.id);
    res.render('editor', {
      title: 'Éditeur · link2me',
      user: req.user,
      profile,
      youtubeEnabled: Config.youtubeEnabled()
    });
  }

  static publicProfile(req, res) {
    const username = (req.params.username || '').toLowerCase();
    const user = User.findByUsername(username);
    if (!user) return res.status(404).render('404', { title: '404 · link2me' });
    const profile = Profile.getByUserId(user.id);
    if (!profile) return res.status(404).render('404', { title: '404 · link2me' });

    if (!req.user || req.user.id !== user.id) Profile.incrementViews(user.id);

    res.render('profile', {
      title: `@${user.username} · link2me`,
      user,
      profile,
      isOwner: req.user && req.user.id === user.id
    });
  }
}

module.exports = ProfileController;
