# link2me

Plateforme de bio links **premium gratuite** dans l'esprit guns.lol / haunt.gg.
URL publique : `https://link2me.fr/<pseudo>`.

## Stack

- **Node.js 18+** en POO (classes : `Server`, `User`, `Profile`, `AuthController`, etc.)
- **Express** + **EJS** (SSR)
- **better-sqlite3** (SQLite WAL — pas besoin de serveur DB séparé)
- **Passport** : OAuth Google + Discord
- **API musique publique** : Deezer (`https://api.deezer.com`) — pas de clé, previews 30s légales
- **Mode cluster Node** ou **PM2** pour la haute disponibilité multi-instances
- **CSP + Helmet + rate limiting** côté sécu

## Features (toutes gratuites)

- Auth via Google ou Discord (un seul compte, plusieurs providers possibles)
- Pseudo réservable (3-20 caractères, lettres/chiffres/_/.)
- Bannière + avatar (upload, conversion WebP via Sharp)
- Background : couleur / gradient / image / **vidéo .mp4 / .webm**
- Musique de fond (recherche Deezer, preview 30s, autoplay opt-in, volume)
- Liens sociaux (16 plateformes) avec logos SVG
- Boutons custom (label + URL)
- Effets pseudo : glow / shimmer / rainbow / glitch
- Effets curseur : trail / sparkle / glow
- Particules : étoiles / neige / bulles / matrix
- Splash screen "click to enter" custom
- Compteur de vues
- Éditeur live avec aperçu en temps réel dans une frame

## Démarrer

```bash
cp .env.example .env
# renseigne SESSION_SECRET (openssl rand -hex 64),
# GOOGLE_CLIENT_ID / SECRET et DISCORD_CLIENT_ID / SECRET

npm install
npm run dev          # 1 instance, hot-friendly
npm start            # cluster Node natif
npm run pm2          # via PM2 (recommandé en prod)
```

Ouvrir http://localhost:3000

## OAuth

- **Google** : créer un OAuth Client (Web) sur https://console.cloud.google.com/apis/credentials
  - Redirect URI : `https://link2me.fr/auth/google/callback`
- **Discord** : https://discord.com/developers/applications
  - Redirect URI : `https://link2me.fr/auth/discord/callback`

## Haute disponibilité

L'app est **stateless côté worker** : sessions et données sont stockées sur disque (SQLite + WAL),
les workers peuvent être démarrés par le module `cluster` natif (`CLUSTER=true`) ou par PM2
(`pm2 start ecosystem.config.js`). Pour scaler horizontalement sur plusieurs machines,
externalise la DB (Postgres) et les sessions (Redis) — les modèles sont déjà
factorisés pour ça.

## Légalité musique

L'API Deezer renvoie des URLs de **previews 30s** hébergées par Deezer.
La lecture en streaming de ces samples publics est conforme à la même règle que
Spotify / Apple : on ne stocke pas le fichier, on stream depuis le CDN officiel.
Pas de SACEM à payer pour ça. Aucun compte Deezer requis.
