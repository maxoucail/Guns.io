/**
 * link2me — Routes principales
 * Landing page, sitemap, robots.txt, legal, favicon
 */
const express = require('express');
const router = express.Router();

const DEMO_PROFILE = {
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

const REVIEWS = [
  { name: 'Sofia R.',  seed: 'sofia',  text: "Absolument incroyable, ma page ressemble à un chef-d'œuvre. Je recommande à tous mes followers !", stars: 5 },
  { name: 'Maxime T.', seed: 'maxime', text: "Simple, rapide, beau. La meilleure plateforme de liens que j'ai testée, et en plus c'est gratuit.", stars: 5 },
  { name: 'Léa M.',    seed: 'lea',    text: "Enfin une plateforme gratuite VRAIMENT gratuite. Pas de piège, pas de freemium caché.", stars: 5 },
  { name: 'Noah B.',   seed: 'noah',   text: "Les effets visuels sont dingues, toute ma commu est jalouse de ma page link2me.", stars: 5 },
  { name: 'Emma V.',   seed: 'emma',   text: "J'ai migré depuis Linktree, aucun regret. link2me c'est un autre niveau de personnalisation.", stars: 5 },
  { name: 'Enzo P.',   seed: 'enzo',   text: "J'ai passé 2h à customiser ma page tellement c'est fun. Le résultat est ouf.", stars: 5 },
  { name: 'Chloé D.',  seed: 'chloe',  text: "Interface ultra soignée, j'adore le thème Aurora. Mes abonnés me demandent comment j'ai fait.", stars: 5 },
  { name: 'Lucas F.',  seed: 'lucas',  text: "Rapide à configurer et le résultat est professionnel. Je suis bluffé pour un service gratuit.", stars: 5 },
];

const STATS = [
  { value: '+15', label: 'Polices uniques' },
  { value: '+20', label: 'Effets visuels' },
  { value: '+50', label: 'Thèmes disponibles' },
  { value: '100%', label: 'Gratuit & sans mensonge' },
  { value: '+30', label: 'Animations' },
  { value: '∞', label: 'Liens ajoutables' },
];

const SocialLinks = require('../lib/SocialLinks');

router.get('/', (req, res) => {
  if (req.user) return res.redirect(req.user.username ? '/dashboard' : '/onboarding');
  res.render('index', {
    title: 'link2me · Ta page perso, sublime, gratuite',
    user: null,
    SocialLinks,
    demoProfile: DEMO_PROFILE,
    reviews: REVIEWS,
    stats: STATS,
  });
});

// ── Legal ────────────────────────────────────────────────────
router.get('/terms', (req, res) => {
  res.render('legal', {
    title: "Conditions d'utilisation · link2me",
    type: 'terms',
    user: req.user || null,
    SocialLinks,
  });
});

router.get('/privacy', (req, res) => {
  res.render('legal', {
    title: 'Politique de confidentialité · link2me',
    type: 'privacy',
    user: req.user || null,
    SocialLinks,
  });
});

// ── Robots / Favicon / Sitemap ────────────────────────────────
router.get('/robots.txt', (req, res) => {
  const BASE = process.env.SITE_URL || process.env.BASE_URL || 'http://localhost:4816';
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /auth\nDisallow: /api\nSitemap: ${BASE}/sitemap.xml`);
});

router.get('/favicon.ico', (req, res) => {
  res.set('Content-Type', 'image/svg+xml');
  const path = require('path');
  const fp = path.join(__dirname, '..', 'public', 'images', 'logo.svg');
  try {
    const fs = require('fs');
    if (fs.existsSync(fp)) return res.sendFile(fp);
  } catch {}
  res.status(204).end();
});

router.get('/sitemap.xml', async (req, res) => {
  const BASE = process.env.SITE_URL || process.env.BASE_URL || 'http://localhost:4816';
  const now = new Date().toISOString().split('T')[0];

  const staticUrls = [
    { loc: BASE, priority: '1.0', changefreq: 'weekly' },
    { loc: `${BASE}/login`, priority: '0.5', changefreq: 'monthly' },
    { loc: `${BASE}/terms`, priority: '0.3', changefreq: 'yearly' },
    { loc: `${BASE}/privacy`, priority: '0.3', changefreq: 'yearly' },
  ];

  let userUrls = [];
  try {
    const db = require('../db');
    const users = db.users.find({ rgpdAccepted: 1 }, { limit: 500, orderBy: 'created_at DESC' });
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

module.exports = router;
