'use strict';

// POST /login lives in ./login.js and is mounted separately in app.js, before the
// ensureAdminAuthenticated gate - it's the one route in this API that must work while logged out.
// Everything in this file runs behind that gate.

const express = require('express');

const router = express.Router();

router.post('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy(() => {
            res.clearCookie('owner.admin.sid');
            res.json({ ok: true });
        });
    });
});

router.get('/me', (req, res) => {
    res.json({ id: req.user.id, username: req.user.username });
});

module.exports = router;
