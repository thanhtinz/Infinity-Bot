'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const passport = require('../lib/passport');

const router = express.Router();

// This panel controls the whole bot infrastructure, so the login route gets its own strict limiter
// on top of the global one in app.js - a handful of attempts per IP per window, not per-account, so
// a single account can't be hammered from many IPs without also throttling the offending IP.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'too many login attempts, try again later' }
});

// The only unauthenticated route in this whole API - see app.js, everything else sits behind
// ensureAdminAuthenticated.
router.post('/', loginLimiter, (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ error: info?.message || 'invalid username or password' });

        req.logIn(user, (loginErr) => {
            if (loginErr) return next(loginErr);
            res.json({ ok: true, user: { id: user.id, username: user.username } });
        });
    })(req, res, next);
});

module.exports = router;
