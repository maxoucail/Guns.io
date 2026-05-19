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
const GhData = require('../services/GitHubDataService');

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

// ── Landing page data ─────────────────────────────────────────
const demoProfile = {
  username: 'axeldev',
  bio: 'Dev passionné · Designer · Créateur de contenu',
  avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=axeldev&backgroundColor=0B1020',
  links: [
    { fa: 'fa-brands fa-x-twitter',  label: 'X (Twitter)',  url: '#', color: '#e2e8f0' },
    { fa: 'fa-brands fa-instagram',  label: 'Instagram',    url: '#', color: '#E1306C' },
    { fa: 'fa-brands fa-github',     label: 'GitHub',       url: '#', color: '#8b949e' },
    { fa: 'fa-brands fa-discord',    label: 'Discord',      url: '#', color: '#5865F2' },
    { fa: 'fa-brands fa-youtube',    label: 'YouTube',      url: '#', color: '#FF0000' },
  ],
  style: 'Neon Pulse',
};

const reviews = [
  { name: 'Sofia R.',  seed: 'sofia',  text: "Absolument incroyable, ma page ressemble à un chef-d'œuvre. Je recommande à tous mes followers !", stars: 5 },
  { name: 'Maxime T.', seed: 'maxime', text: "Simple, rapide, beau. La meilleure plateforme de liens que j'ai testée, et en plus c'est gratuit.", stars: 5 },
  { name: 'Léa M.',    seed: 'lea',    text: "Enfin une plateforme gratuite VRAIMENT gratuite. Pas de piège, pas de freemium caché.", stars: 5 },
  { name: 'Noah B.',   seed: 'noah',   text: "Les effets visuels sont dingues, toute ma commu est jalouse de ma page link2me.", stars: 5 },
  { name: 'Emma V.',   seed: 'emma',   text: "J'ai migré depuis Linktree, aucun regret. link2me c'est un autre niveau de personnalisation.", stars: 5 },
  { name: 'Enzo P.',   seed: 'enzo',   text: "J'ai passé 2h à customiser ma page tellement c'est fun. Le résultat est ouf.", stars: 5 },
  { name: 'Chloé D.',  seed: 'chloe',  text: "Interface ultra soignée, j'adore le thème Aurora. Mes abonnés me demandent comment j'ai fait.", stars: 5 },
  { name: 'Lucas F.',  seed: 'lucas',  text: "Rapide à configurer et le résultat est professionnel. Je suis bluffé pour un service gratuit.", stars: 5 },
];

const stats = [
  { value: '+15', label: 'Polices uniques' },
  { value: '+20', label: 'Effets visuels' },
  { value: '+50', label: 'Thèmes disponibles' },
  { value: '100%', label: 'Gratuit & sans mensonge' },
  { value: '+30', label: 'Animations' },
  { value: '∞', label: 'Liens ajoutables' },
];

function build() {
  const router = express.Router();

  // ── Landing page ──────────────────────────────────────────
  router.get('/', (req, res) => {
    if (req.user) return res.redirect(req.user.username ? '/dashboard' : '/welcome');
    res.render('index', {
      title: 'link2me · Ta page perso, sublime, gratuite',
      user: null,
      demoProfile,
      reviews,
      stats
    });
  });

  // ── Legal pages ───────────────────────────────────────────
  router.get('/terms', (req, res) => {
    res.render('legal', { title: "Conditions d'utilisation · link2me", type: 'terms', user: req.user || null });
  });
  router.get('/privacy', (req, res) => {
    res.render('legal', { title: 'Politique de confidentialité · link2me', type: 'privacy', user: req.user || null });
  });

  // ── Auth ──────────────────────────────────────────────────
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

  // ── Onboarding / Welcome ──────────────────────────────────
  router.get('/welcome',  ensureAuth, ProfileController.welcomePage);
  router.post('/welcome', ensureAuth, writeLimit, ProfileController.claimUsername);

  // ── Dashboard ─────────────────────────────────────────────
  router.get('/dashboard', ensureAuth, ensureUsername, (req, res, next) => {
    if (req.user.blocked) return res.render('blocked', { title: 'Compte suspendu', user: req.user });
    next();
  }, ProfileController.dashboard);

  // ── Editor ────────────────────────────────────────────────
  router.get('/editor', ensureAuth, ensureUsername, (req, res, next) => {
    if (req.user.blocked) return res.render('blocked', { title: 'Compte suspendu', user: req.user });
    next();
  }, ProfileController.editor);

  // ── API ───────────────────────────────────────────────────
  router.get('/api/username', ApiController.checkUsername);
  router.get('/api/music',    ApiController.musicSearch);
  router.post('/api/profile', ensureAuth, ensureUsername, writeLimit, express.json({ limit: '256kb' }), ApiController.updateProfile);
  router.post('/api/upload',  ensureAuth, ensureUsername, writeLimit, upload.single('file'), ApiController.uploadImage);

  // ── Sitemap ───────────────────────────────────────────────
  router.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(`User-agent: *\nAllow: /\nSitemap: ${Config.baseUrl}/sitemap.xml`);
  });

  router.get('/favicon.ico', (req, res) => {
    res.set('Content-Type', 'image/svg+xml');
    res.sendFile(require('path').join(__dirname, '..', '..', 'public', 'img', 'favicon.svg'));
  });

  router.get('/sitemap.xml', async (req, res) => {
    const BASE = Config.baseUrl;
    const now = new Date().toISOString().split('T')[0];

    const staticUrls = [
      { loc: BASE, priority: '1.0', changefreq: 'weekly' },
      { loc: `${BASE}/login`, priority: '0.5', changefreq: 'monthly' },
      { loc: `${BASE}/terms`, priority: '0.3', changefreq: 'yearly' },
      { loc: `${BASE}/privacy`, priority: '0.3', changefreq: 'yearly' },
    ];

    let userUrls = [];
    try {
      const users = GhData.findAllUsers({ page: 1, limit: 500 });
      userUrls = users
        .filter(u => u.username)
        .map(u => ({
          loc: `${BASE}/${u.username}`,
          priority: '0.7',
          changefreq: 'weekly',
          lastmod: u.updated_at ? new Date(u.updated_at).toISOString().split('T')[0] : now,
        }));
    } catch {}

    const allUrls = [...staticUrls, ...userUrls];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allUrls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod || now}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')}\n</urlset>`;
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  });

  // ── Admin ─────────────────────────────────────────────────
  router.get('/admin/auth',  ensureAuth, AdminController.authPage);
  router.post('/admin/auth', ensureAuth, express.urlencoded({ extended: false }), AdminController.verifyAuth);
  router.get('/admin/logout-admin', ensureAuth, AdminController.logoutAdmin);
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

  // ── Public profile ────────────────────────────────────────
  router.get('/:username', (req, res, next) => {
    if (req.user && req.isAuthenticated()) {
      User.updateLastSeen(req.user.id, getIp(req));
    }
    next();
  }, ProfileController.publicProfile);

  return router;
}

module.exports = { build };
