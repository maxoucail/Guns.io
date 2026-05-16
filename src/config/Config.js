'use strict';

const path = require('path');

class Config {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.port = parseInt(process.env.PORT, 10) || 3000;
    this.baseUrl = (process.env.BASE_URL || `http://localhost:${this.port}`).replace(/\/$/, '');
    this.sessionSecret = process.env.SESSION_SECRET || 'dev-secret-change-me';
    this.trustProxy = parseInt(process.env.TRUST_PROXY, 10) || 0;

    this.paths = {
      root: path.resolve(__dirname, '..', '..'),
      data: path.resolve(__dirname, '..', '..', 'data'),
      views: path.resolve(__dirname, '..', '..', 'views'),
      public: path.resolve(__dirname, '..', '..', 'public'),
      uploads: path.resolve(__dirname, '..', '..', 'public', 'uploads')
    };

    this.oauth = {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackPath: '/auth/google/callback'
      },
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID || '',
        clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
        callbackPath: '/auth/discord/callback'
      }
    };

    this.uploads = {
      maxAvatar: parseInt(process.env.MAX_AVATAR_SIZE, 10) || 2 * 1024 * 1024,
      maxBanner: parseInt(process.env.MAX_BANNER_SIZE, 10) || 5 * 1024 * 1024
    };
  }

  isProd() { return this.env === 'production'; }

  googleEnabled() { return !!(this.oauth.google.clientId && this.oauth.google.clientSecret); }
  discordEnabled() { return !!(this.oauth.discord.clientId && this.oauth.discord.clientSecret); }
  soundcloudEnabled() { return !!process.env.SOUNDCLOUD_CLIENT_ID; }
}

module.exports = new Config();
