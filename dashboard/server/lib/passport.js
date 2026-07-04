'use strict';

const passport = require('passport');
const { Strategy: DiscordStrategy } = require('passport-discord');
const config = require('../config');

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(new DiscordStrategy({
    clientID: config.discordClientId,
    clientSecret: config.discordClientSecret,
    callbackURL: config.callbackUrl,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    const user = {
        id: profile.id,
        username: profile.username,
        discriminator: profile.discriminator,
        avatar: profile.avatar,
        // Raw Discord "user guilds" entries: { id, name, icon, owner, permissions, features }.
        // Refreshed on login and via POST /api/auth/refresh-guilds.
        guilds: profile.guilds || [],
        accessToken
    };
    done(null, user);
}));

module.exports = passport;
