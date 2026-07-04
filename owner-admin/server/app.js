'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const passport = require('./lib/passport');
const { createSessionMiddleware } = require('./lib/session');
const { ensureAdminAuthenticated } = require('./middleware/auth');

const loginRoute = require('./routes/login');
const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');
const controlRoutes = require('./routes/control');
const accountRoutes = require('./routes/account');

function createApp() {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);

    // Same reasoning as dashboard/server/app.js: the SPA is a separately-built Vite bundle, so the
    // default CSP is disabled rather than hand-tuned for its module script tags.
    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(express.json({ limit: '1mb' }));

    app.use('/api', rateLimit({ windowMs: 60_000, limit: 120 }));

    app.use(createSessionMiddleware());
    app.use(passport.initialize());
    app.use(passport.session());

    // POST /api/login is the one route in this whole API that works while logged out. Every other
    // /api route sits behind ensureAdminAuthenticated below. This session is completely separate
    // from the guild dashboard's Discord OAuth session (different cookie name, different session
    // table, different passport strategy) - one can never grant access to the other.
    app.use('/api/login', loginRoute);

    app.use('/api', ensureAdminAuthenticated);

    app.use('/api', authRoutes);
    app.use('/api/config', configRoutes);
    app.use('/api', controlRoutes);
    app.use('/api/account', accountRoutes);

    app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

    // Serve the built frontend in production (owner-admin/dist, produced by `npm run build`).
    const distDir = path.join(__dirname, '..', 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
        res.sendFile(path.join(distDir, 'index.html'), (err) => {
            if (err) next();
        });
    });

    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        console.error('[Owner Admin] Unhandled error:', err);
        if (res.headersSent) return;
        res.status(500).json({ error: 'internal server error' });
    });

    return app;
}

module.exports = { createApp };
