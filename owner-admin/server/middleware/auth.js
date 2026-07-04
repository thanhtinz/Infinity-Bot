'use strict';

function ensureAdminAuthenticated(req, res, next) {
    if (req.isAuthenticated && req.isAuthenticated() && req.user) return next();
    return res.status(401).json({ error: 'not logged in' });
}

module.exports = { ensureAdminAuthenticated };
