/**
 * link2me — Middleware d'authentification
 * Attach user, require auth, require admin, blocked checks
 */
const db = require('../db');

async function attachUser(req, res, next) {
  if (req.session?.passport?.user) {
    try {
      const user = db.users.findOne({ id: req.session.passport.user });
      if (user) {
        req.user = user;
        res.locals.user = user;
        res.locals.currentUser = user;
        res.locals.isAuthenticated = true;
      } else {
        delete req.session.passport.user;
      }
    } catch (err) {
      console.error('[auth] attachUser error:', err);
    }
  }
  next();
}

function ensureAuth(req, res, next) {
  if (req.user) {
    if (req.user.blocked) {
      return res.render('blocked', {
        title: 'Compte suspendu · link2me',
        user: req.user,
        message: req.user.blocked_message || 'Votre compte a été suspendu.',
      });
    }
    return next();
  }
  if (req.accepts('html')) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  return res.status(401).json({ error: 'unauthorized' });
}

function ensureUsername(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (!req.user.username) return res.redirect('/onboarding');
  return next();
}

function requireGuest(req, res, next) {
  if (!req.user) return next();
  res.redirect('/dashboard');
}

function ensureAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    if (req.accepts('html')) return res.status(403).redirect('/dashboard');
    return res.status(403).json({ error: 'forbidden' });
  }
  if (!req.session.admin_verified) {
    return res.redirect('/admin/auth');
  }
  return next();
}

module.exports = { attachUser, ensureAuth, ensureUsername, requireGuest, ensureAdmin };
