/**
 * link2me — Routes d'authentification
 * GitHub / Google / Discord OAuth + Login + Onboarding + Logout
 */
const express = require('express');
const router = express.Router();
const passport = require('passport');
const db = require('../db');
const { ensureAuth, requireGuest } = require('../middleware/auth');

const SESSION_DAYS = process.env.NODE_ENV === 'production' ? 30 : 7;
const SocialLinks = require('../lib/SocialLinks');

function setUserSession(req, user) {
  return new Promise((resolve, reject) => {
    req.logIn(user, (err) => {
      if (err) return reject(err);
      req.session.cookie.maxAge = SESSION_DAYS * 24 * 60 * 60 * 1000;
      resolve();
    });
  });
}

function loginPage(req, res) {
  if (req.user) return res.redirect('/dashboard');
  res.render('auth/login', {
    title: 'Connexion · link2me',
    SocialLinks,
    user: null,
    error: req.query.error || null,
    providers: {
      github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_ID !== 'your_github_client_id_here'),
      google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here'),
      discord: !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_ID !== 'your_discord_client_id_here'),
    },
  });
}

async function handleOAuthSuccess(req, res) {
  try {
    await setUserSession(req, req.user);

    // Update last login
    db.users.update(
      { id: req.user.id },
      { $set: { lastLoginAt: new Date().toISOString(), updated_at: Date.now() } }
    );

    if (req.user.blocked) {
      return res.redirect('/login?error=blocked');
    }

    if (!req.user.username || !req.user.rgpdAccepted) {
      return res.redirect('/onboarding');
    }

    const returnTo = req.session.returnTo || '/dashboard';
    delete req.session.returnTo;
    res.redirect(returnTo);
  } catch (err) {
    console.error('[auth] OAuth success error:', err);
    res.redirect('/login?error=server');
  }
}

// ── Login page ────────────────────────────────────────────────
router.get('/login', loginPage);
router.get('/register', loginPage);

// ── GitHub ────────────────────────────────────────────────────
if (process.env.GITHUB_CLIENT_ID) {
  router.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
  router.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/login?error=github' }),
    async (req, res) => { try { await handleOAuthSuccess(req, res); } catch (e) { res.redirect('/login?error=server'); } }
  );
}

// ── Google ────────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID) {
  router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=google' }),
    async (req, res) => { try { await handleOAuthSuccess(req, res); } catch (e) { res.redirect('/login?error=server'); } }
  );
}

// ── Discord ───────────────────────────────────────────────────
if (process.env.DISCORD_CLIENT_ID) {
  router.get('/auth/discord', passport.authenticate('discord', { scope: ['identify', 'email'] }));
  router.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/login?error=discord' }),
    async (req, res) => { try { await handleOAuthSuccess(req, res); } catch (e) { res.redirect('/login?error=server'); } }
  );
}

// ── Onboarding ────────────────────────────────────────────────
router.get('/onboarding', ensureAuth, (req, res) => {
  if (req.user.username && req.user.rgpdAccepted) {
    return res.redirect('/dashboard');
  }
  res.render('auth/onboarding', {
    title: 'Bienvenue sur link2me · Choisis ton pseudo',
    user: req.user,
    SocialLinks,
    error: null,
    prefill: req.user.display_name || '',
  });
});

router.post('/onboarding', ensureAuth, async (req, res) => {
  const { username, rgpd } = req.body;

  if (!rgpd) {
    return res.render('auth/onboarding', {
      title: 'Bienvenue sur link2me', user: req.user, SocialLinks,
      error: 'Tu dois accepter les conditions pour continuer.',
      prefill: username || '',
    });
  }

  const cleanUsername = (username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 20) {
    return res.render('auth/onboarding', {
      title: 'Bienvenue sur link2me', user: req.user, SocialLinks,
      error: 'Le pseudo doit contenir entre 3 et 20 caractères (lettres, chiffres, _).',
      prefill: username || '',
    });
  }

  try {
    const existing = db.users.findOne({ username: cleanUsername });
    if (existing && existing.id !== req.user.id) {
      return res.render('auth/onboarding', {
        title: 'Bienvenue sur link2me', user: req.user, SocialLinks,
        error: 'Ce pseudo est déjà pris. Choisis-en un autre.',
        prefill: username || '',
      });
    }

    db.users.update(
      { id: req.user.id },
      { $set: {
        username: cleanUsername,
        linkSlug: cleanUsername,
        rgpdAccepted: 1,
        rgpdAcceptedAt: new Date().toISOString(),
        updated_at: Date.now(),
      }}
    );

    // Enregistrer consentement RGPD
    const existingConsent = db.gdpr.findOne({ userId: req.user.id });
    if (!existingConsent) {
      db.gdpr.insert({
        userId: req.user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'] || '',
        acceptedAt: new Date().toISOString(),
        version: '1.0',
      });
    }

    res.redirect('/dashboard');
  } catch (err) {
    console.error('[onboarding]', err);
    res.render('auth/onboarding', {
      title: 'Bienvenue sur link2me', user: req.user, SocialLinks,
      error: 'Une erreur est survenue. Réessaie.',
      prefill: username || '',
    });
  }
});

// ── API check username ────────────────────────────────────────
router.get('/api/username-check', (req, res) => {
  const { u } = req.query;
  if (!u || u.length < 3) return res.json({ available: false });
  const clean = u.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  try {
    const existing = db.users.findOne({ username: clean });
    res.json({ available: !existing || existing.id === (req.user?.id) });
  } catch {
    res.json({ available: false });
  }
});

// ── Logout ────────────────────────────────────────────────────
router.get('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie('link2me.sid');
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  });
});

router.post('/auth/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie('link2me.sid');
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  });
});

module.exports = router;
