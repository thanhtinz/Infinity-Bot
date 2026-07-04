'use strict';

const express = require('express');
const passport = require('../lib/passport');
const config = require('../config');
const { userAvatarUrl } = require('../lib/permissions');

const router = express.Router();

router.get('/discord/login', (req, res, next) => {
    // Support ?returnTo= to bounce back to a deep link after login.
    if (req.query.returnTo) {
        req.session.returnTo = String(req.query.returnTo);
    }
    passport.authenticate('discord')(req, res, next);
});

router.get('/discord/callback',
    passport.authenticate('discord', { failureRedirect: `${config.publicUrl}/login?error=auth_failed` }),
    (req, res) => {
        const returnTo = req.session.returnTo;
        delete req.session.returnTo;
        res.redirect(returnTo && returnTo.startsWith('/') ? `${config.publicUrl}${returnTo}` : config.publicUrl);
    }
);

router.get('/me', (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
        return res.status(401).json({ error: 'not logged in' });
    }
    const { id, username, discriminator, avatar } = req.user;
    res.json({ id, username, discriminator, avatar, avatarUrl: userAvatarUrl(req.user) });
});

router.post('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy(() => {
            res.clearCookie('main.dashboard.sid');
            res.json({ ok: true });
        });
    });
});

module.exports = router;
