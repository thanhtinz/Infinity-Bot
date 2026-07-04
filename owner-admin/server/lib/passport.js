'use strict';

const passport = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const bcrypt = require('bcryptjs');
const { AdminUser } = require('../../../src/database/models');

passport.use(new LocalStrategy(
    { usernameField: 'username', passwordField: 'password' },
    async (username, password, done) => {
        try {
            const user = await AdminUser.findOne({ where: { username } });
            if (!user) return done(null, false, { message: 'Invalid username or password' });

            const ok = await bcrypt.compare(password, user.passwordHash);
            if (!ok) return done(null, false, { message: 'Invalid username or password' });

            done(null, { id: user.id, username: user.username });
        } catch (error) {
            done(error);
        }
    }
));

// Only the admin id is kept in the session cookie; the username is re-read from the database on
// every request so a username/password change (see PUT /api/account) takes effect immediately
// without forcing a re-login.
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
    try {
        const user = await AdminUser.findByPk(id);
        if (!user) return done(null, false);
        done(null, { id: user.id, username: user.username });
    } catch (error) {
        done(error);
    }
});

module.exports = passport;
