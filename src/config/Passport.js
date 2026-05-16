'use strict';

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const DiscordStrategy = require('passport-discord').Strategy;
const Config = require('./Config');
const User = require('../models/User');
const Logger = require('../utils/Logger');

class PassportConfig {
  static init() {
    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser((id, done) => {
      try { done(null, User.findById(id)); } catch (e) { done(e); }
    });

    if (Config.googleEnabled()) {
      passport.use(new GoogleStrategy(
        {
          clientID: Config.oauth.google.clientId,
          clientSecret: Config.oauth.google.clientSecret,
          callbackURL: Config.baseUrl + Config.oauth.google.callbackPath,
          scope: ['profile', 'email']
        },
        (accessToken, refreshToken, profile, done) => {
          try {
            const user = User.upsertFromOAuth({
              provider: 'google',
              providerId: profile.id,
              email: profile.emails?.[0]?.value || null,
              displayName: profile.displayName || null,
              avatarUrl: profile.photos?.[0]?.value || null
            });
            done(null, user);
          } catch (e) { done(e); }
        }
      ));
      Logger.info('Passport: Google activé');
    } else {
      Logger.warn('Passport: Google désactivé (clés manquantes)');
    }

    if (Config.discordEnabled()) {
      passport.use(new DiscordStrategy(
        {
          clientID: Config.oauth.discord.clientId,
          clientSecret: Config.oauth.discord.clientSecret,
          callbackURL: Config.baseUrl + Config.oauth.discord.callbackPath,
          scope: ['identify', 'email']
        },
        (accessToken, refreshToken, profile, done) => {
          try {
            const avatar = profile.avatar
              ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
              : null;
            const user = User.upsertFromOAuth({
              provider: 'discord',
              providerId: profile.id,
              email: profile.email || null,
              displayName: profile.global_name || profile.username || null,
              avatarUrl: avatar
            });
            done(null, user);
          } catch (e) { done(e); }
        }
      ));
      Logger.info('Passport: Discord activé');
    } else {
      Logger.warn('Passport: Discord désactivé (clés manquantes)');
    }
  }
}

module.exports = PassportConfig;
