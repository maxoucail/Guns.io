'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');

const Config = require('./config/Config');
const GhData = require('./services/GitHubDataService');
const FileSessionStore = require('./config/FileSessionStore');
const PassportConfig = require('./config/Passport');
const Logger = require('./utils/Logger');
const routes = require('./routes');
const SocialLinks = require('./utils/SocialLinks');

class Server {
  constructor() {
    this.app = express();
    this.config = Config;
  }

  async start() {
    this._ensureDirs();
    this._configureApp();
    this._configureCanonicalRedirect();
    this._configureSecurity();
    this._configureSession();
    this._configurePassport();
    this._configureRoutes();
    this._configureErrors();
    await this._initDataService();

    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, () => {
        Logger.info(`Worker ${process.pid} écoute sur :${this.config.port} (${this.config.env})`);
        resolve(this.server);
      });
      this._wireShutdown();
    });
  }

  _ensureDirs() {
    [this.config.paths.data, this.config.paths.uploads].forEach((p) => {
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    });
  }

  async _initDataService() {
    if (!GhData.isConfigured()) {
      Logger.warn('GitHubDataService: non configuré — les données seront uniquement en mémoire !');
      return;
    }
    await GhData.init();
    // Periodic views flush (every 5 minutes) to survive crashes
    this._viewsInterval = setInterval(() => {
      GhData.flushViews().catch(() => {});
    }, 5 * 60 * 1000);
    this._viewsInterval.unref();
  }

  _configureApp() {
    if (this.config.trustProxy) this.app.set('trust proxy', this.config.trustProxy);
    this.app.set('view engine', 'ejs');
    this.app.set('views', this.config.paths.views);
    this.app.disable('x-powered-by');

    this.app.use(compression());
    this.app.use(cookieParser());
    this.app.use(express.urlencoded({ extended: false, limit: '64kb' }));

    this.app.use('/static', express.static(this.config.paths.public, {
      maxAge: this.config.isProd() ? '30d' : 0,
      immutable: this.config.isProd()
    }));
    this.app.use('/uploads', express.static(this.config.paths.uploads, {
      maxAge: '7d'
    }));
  }

  _configureCanonicalRedirect() {
    if (!this.config.isProd()) return;
    try {
      const base = new URL(this.config.baseUrl);
      const canonical = base.hostname;
      const stripWww = (h) => h.replace(/^www\./i, '');
      this.app.use((req, res, next) => {
        if (req.hostname && stripWww(req.hostname) !== stripWww(canonical)) {
          return res.redirect(301, `${base.protocol}//${canonical}${req.url}`);
        }
        next();
      });
    } catch { }
  }

  _configureSecurity() {
    this.app.use(helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'img-src': ["'self'", 'data:', 'https:'],
          'media-src': ["'self'", 'https://cdnt-preview.dzcdn.net', 'https://cdns-preview-*.dzcdn.net', 'https:'],
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
          'connect-src': ["'self'", 'https://api.deezer.com', 'https://cdns-preview-e.dzcdn.net', 'https://cdns-preview-f.dzcdn.net'],
          'frame-src': ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
          'frame-ancestors': ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    }));
  }

  _configureSession() {
    let cookieDomain;
    try {
      const base = new URL(this.config.baseUrl);
      if (this.config.isProd() && base.hostname !== 'localhost') {
        cookieDomain = '.' + base.hostname.replace(/^www\./, '');
      }
    } catch { }

    this.sessionStore = new FileSessionStore();

    this.app.use(session({
      store: this.sessionStore,
      secret: this.config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      proxy: !!this.config.trustProxy,
      cookie: {
        httpOnly: true,
        secure: this.config.isProd(),
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 30,
        domain: cookieDomain
      }
    }));
  }

  _configurePassport() {
    PassportConfig.init();
    this.app.use(passport.initialize());
    this.app.use(passport.session());
  }

  _configureRoutes() {
    this.app.use((req, res, next) => {
      res.locals.SocialLinks = SocialLinks;
      res.locals.user = req.user || null;
      res.locals.req = req;
      res.locals.safeJSON = (v) =>
        JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
      next();
    });
    this.app.use(routes.build());
  }

  _configureErrors() {
    this.app.use((req, res) => {
      if (req.accepts('html')) return res.status(404).render('404', { title: '404 · link2me' });
      res.status(404).json({ error: 'not_found' });
    });

    this.app.use((err, req, res, _next) => {
      Logger.error('Erreur non gérée', err);
      if (res.headersSent) return;
      if (req.accepts('html')) {
        return res.status(500).render('500', { title: '500 · link2me' });
      }
      res.status(500).json({ error: 'server_error' });
    });
  }

  _wireShutdown() {
    const close = (sig) => async () => {
      Logger.info(`Worker ${process.pid} arrêt (${sig})`);
      // Flush views with timeout
      try { await Promise.race([GhData.flushViews(), new Promise(r => setTimeout(r, 5000))]); } catch {}
      if (this.sessionStore) this.sessionStore.close();
      this.server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGTERM', close('SIGTERM'));
    process.on('SIGINT', close('SIGINT'));
  }
}

module.exports = Server;
