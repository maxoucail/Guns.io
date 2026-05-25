/**
 * link2me — The Ultimate Bio Link Platform
 * Cluster mode · Helmet CSP · GitHub Sync · SQLite · Admin · Badges · Effects
 */
'use strict';

require('dotenv').config();
const os = require('os');
const cluster = require('cluster');
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const { passport: passportConfig } = require('./config/passport');
const { attachUser } = require('./middleware/auth');
const GhData = require('./services/GitHubDataService');
const SocialLinks = require('./lib/SocialLinks');

const useCluster = process.env.CLUSTER === 'true';
const PORT = parseInt(process.env.PORT, 10) || 4816;
const workers = process.env.WORKERS === 'auto' || !process.env.WORKERS
  ? os.cpus().length
  : Math.max(1, parseInt(process.env.WORKERS, 10) || 1);

// ── Create app ─────────────────────────────────────────────────
function createApp() {
  const app = express();

  // Trust proxy
  app.set('trust proxy', process.env.TRUST_PROXY || 0);
  app.disable('x-powered-by');

  // Views
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // ── Security (Helmet CSP) ───────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'https:', 'blob:'],
        'media-src': ["'self'", 'https://cdns-preview-e.dzcdn.net', 'https://cdns-preview-f.dzcdn.net', 'https://e-cdns-proxy.dzcdn.net', 'https:', 'blob:'],
        'script-src': ["'self'", "'unsafe-inline'"],
        'script-src-attr': ["'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
        'connect-src': ["'self'", 'https://api.deezer.com', 'https://cdns-preview-e.dzcdn.net', 'https://cdns-preview-f.dzcdn.net'],
        'frame-src': ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
        'frame-ancestors': ["'none'"],
        'worker-src': ["'self'", 'blob:'],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // ── Compression + Parsing ───────────────────────────────────
  app.use(compression());
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));
  app.use(express.json({ limit: '512kb' }));

  // ── Logging ─────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(':remote-addr :method :url :status :response-time ms'));
  }

  // ── Rate Limiting ───────────────────────────────────────────
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const writeLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const adminLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // ── Session (SQLite) ────────────────────────────────────────
  let cookieDomain;
  try {
    const baseUrl = process.env.SITE_URL || process.env.BASE_URL || '';
    if (baseUrl && process.env.NODE_ENV === 'production') {
      const hostname = new URL(baseUrl).hostname;
      if (hostname !== 'localhost') cookieDomain = '.' + hostname.replace(/^www\./, '');
    }
  } catch {}

  const SqliteStore = require('better-sqlite3-session-store')(session);
  const sessionStore = new SqliteStore({
    client: db._sqlite,
    expired: { clear: true, intervalMs: 15 * 60 * 1000 },
  });

  app.use(session({
    name: 'link2me.sid',
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me-in-production',
    resave: false,
    saveUninitialized: false,
    proxy: !!process.env.TRUST_PROXY,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: (process.env.NODE_ENV === 'production' ? 30 : 7) * 24 * 60 * 60 * 1000,
      domain: cookieDomain,
    },
  }));

  // ── Passport ────────────────────────────────────────────────
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(attachUser);

  // ── Locals ──────────────────────────────────────────────────
  app.use((req, res, next) => {
    res.locals.SocialLinks = SocialLinks;
    res.locals.user = req.user || null;
    res.locals.req = req;
    res.locals.safeJSON = (v) => {
      try {
        return JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
      } catch { return '{}'; }
    };
    res.locals.siteUrl = process.env.SITE_URL || process.env.BASE_URL || `http://localhost:${PORT}`;
    next();
  });

  // ── Static files ────────────────────────────────────────────
  const publicDir = path.join(__dirname, 'public');
  const uploadsDir = path.join(publicDir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'avatars'), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'banner'), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'bg'), { recursive: true });

  app.use('/static', express.static(publicDir, {
    maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,
    immutable: process.env.NODE_ENV === 'production',
  }));
  app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

  // ── Routes ──────────────────────────────────────────────────
  app.use('/', require('./routes/index'));
  app.use('/', require('./routes/auth'));
  app.use('/', require('./routes/dashboard'));
  app.use('/', require('./routes/editor'));
  app.use('/', require('./routes/admin'));
  app.use('/', require('./routes/profile'));

  // ── Blocked page ────────────────────────────────────────────
  app.get('/blocked', (req, res) => {
    res.render('blocked', {
      title: 'Compte suspendu · link2me',
      user: req.user || null,
      message: req.user?.blocked_message || 'Votre compte a été suspendu.',
    });
  });

  // ── 404 ─────────────────────────────────────────────────────
  app.use((req, res) => {
    if (req.accepts('html')) return res.status(404).render('404', { title: '404 · link2me' });
    res.status(404).json({ error: 'not_found' });
  });

  // ── 500 ─────────────────────────────────────────────────────
  app.use((err, req, res, next) => {
    console.error('[500]', err.stack || err);
    if (res.headersSent) return;
    if (req.accepts('html')) return res.status(500).render('500', { title: '500 · link2me' });
    res.status(500).json({ error: 'server_error' });
  });

  return { app, sessionStore };
}

// ── Start server ──────────────────────────────────────────────
async function startServer() {
  const { app, sessionStore } = createApp();

  // Init GitHub data sync
  let viewsInterval;
  if (GhData.isConfigured()) {
    try {
      await GhData.init();
      viewsInterval = setInterval(() => {
        GhData.flushViews().catch(() => {});
      }, 5 * 60 * 1000);
      if (viewsInterval.unref) viewsInterval.unref();
    } catch (err) {
      console.warn('[Server] GitHub data init failed (continuing without):', err.message);
    }
  }

  const server = app.listen(PORT, () => {
    const providerList = [
      process.env.GITHUB_CLIENT_ID  ? 'GitHub'  : null,
      process.env.GOOGLE_CLIENT_ID  ? 'Google'  : null,
      process.env.DISCORD_CLIENT_ID ? 'Discord' : null,
    ].filter(Boolean);

    console.log(`[Server] Worker ${process.pid} on :${PORT} (${process.env.NODE_ENV || 'development'})`);
    console.log(`[Server] Auth providers: ${providerList.join(', ') || 'NONE (configure .env)'}`);
    if (GhData.isConfigured()) console.log('[Server] GitHub data sync: enabled');
  });

  // Graceful shutdown
  const shutdown = (sig) => async () => {
    console.log(`[Server] Worker ${process.pid} shutdown (${sig})`);
    try { await Promise.race([GhData.flushViews(), new Promise(r => setTimeout(r, 5000))]); } catch {}
    if (sessionStore) sessionStore.close();
    if (viewsInterval) clearInterval(viewsInterval);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));

  return server;
}

// ── Cluster or single ─────────────────────────────────────────
if (useCluster && cluster.isPrimary) {
  console.log(`[Master] ${process.pid} spawning ${workers} workers`);
  for (let i = 0; i < workers; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`[Master] Worker ${worker.process.pid} died (${signal || code}). Restarting.`);
    cluster.fork();
  });

  const shutdown = () => {
    console.log('[Master] Graceful shutdown...');
    for (const id in cluster.workers) cluster.workers[id].kill('SIGTERM');
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} else {
  startServer().catch((err) => {
    console.error('[Fatal]', err);
    process.exit(1);
  });
}
