'use strict';

function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  if (req.accepts('html')) return res.redirect('/login');
  return res.status(401).json({ error: 'unauthorized' });
}

function ensureUsername(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (!req.user.username) return res.redirect('/welcome');
  return next();
}

module.exports = { ensureAuth, ensureUsername };
