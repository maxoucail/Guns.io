/**
 * link2me — Configuration Passport.js
 * Providers : GitHub, Google, Discord
 * Stratégie : OAuth2 → upsert user → session 7 jours (ou 30)
 */
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const DiscordStrategy = require('passport-discord').Strategy;
const crypto = require('crypto');
const { nanoid } = require('nanoid');
const db = require('../db');

const SITE_URL = process.env.SITE_URL || process.env.BASE_URL || 'http://localhost:4816';
const SESSION_DAYS = process.env.NODE_ENV === 'production' ? 30 : 7;

// ── Utilitaires ──────────────────────────────────────────────
function generateToken() {
  return crypto.randomBytes(48).toString('hex');
}

function sessionExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_DAYS);
  return d;
}

/**
 * Upsert user depuis profil OAuth
 * Retourne { user, isNew }
 */
async function upsertUser({ provider, providerId, email, displayName, avatar }) {
  const providerKey = `${provider}:${providerId}`;

  // Chercher par provider_id
  let user = db.users.findOne({ provider_id: providerKey });

  if (!user && email) {
    // Chercher par email (fusion de comptes)
    user = db.users.findOne({ email });
    if (user) {
      db.users.update(
        { id: user.id },
        { $set: { provider_id: providerKey, updated_at: Date.now() } }
      );
      user = db.users.findOne({ id: user.id });
    }
  }

  if (!user) {
    // Nouveau compte
    const id = nanoid(16);
    const now = Date.now();
    user = db.users.insert({
      id,
      provider,
      provider_id: providerKey,
      email: email || null,
      display_name: displayName || null,
      avatar: avatar || null,
      username: null,
      linkSlug: null,
      is_admin: 0,
      blocked: 0,
      blocked_message: null,
      last_ip: null,
      last_seen_at: null,
      lastLoginAt: new Date().toISOString(),
      pageConfig: '{}',
      stats: '{"totalViews":0,"todayViews":0,"todayDate":"","totalClicks":0}',
      rgpdAccepted: 0,
      rgpdAcceptedAt: null,
      created_at: now,
      updated_at: now,
    });
    return { user, isNew: true };
  }

  // Mettre à jour avatar si changé
  if (avatar && user.avatar !== avatar) {
    db.users.update(
      { id: user.id },
      { $set: { avatar, updated_at: Date.now() } }
    );
    user.avatar = avatar;
  }

  db.users.update(
    { id: user.id },
    { $set: { lastLoginAt: new Date().toISOString(), updated_at: Date.now() } }
  );

  return { user, isNew: false };
}

// ── Serialize / Deserialize ───────────────────────────────────
passport.serializeUser((user, done) => {
  done(null, user.id || user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = db.users.findOne({ id }) || db.users.findOne({ _id: id });
    done(null, user || false);
  } catch (err) {
    done(err, false);
  }
});

// ── GitHub ───────────────────────────────────────────────────
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_ID !== 'your_github_client_id_here') {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${SITE_URL}/auth/github/callback`,
    scope: ['user:email'],
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value || null;
      const { user, isNew } = await upsertUser({
        provider: 'github',
        providerId: String(profile.id),
        email,
        displayName: profile.displayName || profile.username,
        avatar: profile.photos?.[0]?.value || null,
      });
      user._isNew = isNew;
      done(null, user);
    } catch (err) {
      done(err, false);
    }
  }));
  console.log('[Passport] GitHub activé');
}

// ── Google ───────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here') {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${SITE_URL}/auth/google/callback`,
    scope: ['profile', 'email'],
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value || null;
      const { user, isNew } = await upsertUser({
        provider: 'google',
        providerId: String(profile.id),
        email,
        displayName: profile.displayName,
        avatar: profile.photos?.[0]?.value || null,
      });
      user._isNew = isNew;
      done(null, user);
    } catch (err) {
      done(err, false);
    }
  }));
  console.log('[Passport] Google activé');
}

// ── Discord ───────────────────────────────────────────────────
if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_ID !== 'your_discord_client_id_here') {
  passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: `${SITE_URL}/auth/discord/callback`,
    scope: ['identify', 'email'],
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const avatar = profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : null;
      const { user, isNew } = await upsertUser({
        provider: 'discord',
        providerId: String(profile.id),
        email: profile.email || null,
        displayName: profile.global_name || profile.username,
        avatar,
      });
      user._isNew = isNew;
      done(null, user);
    } catch (err) {
      done(err, false);
    }
  }));
  console.log('[Passport] Discord activé');
}

module.exports = { passport, generateToken, sessionExpiry };
