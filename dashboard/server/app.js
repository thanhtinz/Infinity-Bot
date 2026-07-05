'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const passport = require('./lib/passport');
const { createSessionMiddleware } = require('./lib/session');
const { ensureAuthenticated, ensureGuildAccess } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const guildsRoutes = require('./routes/guilds');
const metaRoutes = require('./routes/meta');
const moderationRoutes = require('./routes/moderation');
const automodRoutes = require('./routes/automod');
const antinukeRoutes = require('./routes/antinuke');
const ticketsRoutes = require('./routes/tickets');
const giveawaysRoutes = require('./routes/giveaways');
const reactionRolesRoutes = require('./routes/reactionRoles');
const welcomeRoutes = require('./routes/welcome');
const loggingRoutes = require('./routes/logging');
const settingsRoutes = require('./routes/settings');
const statsChannelsRoutes = require('./routes/statsChannels');
const birthdayRoutes = require('./routes/birthday');
const starboardRoutes = require('./routes/starboard');
const verificationRoutes = require('./routes/verification');
const stickyNicknamesRoutes = require('./routes/stickyNicknames');
const shopRoutes = require('./routes/shop');
const webhooksRoutes = require('./routes/webhooks');

function createApp() {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);

    // contentSecurityPolicy is disabled because the SPA is a separately-built Vite bundle served
    // either by this server (production) or the Vite dev server (development) - a strict default
    // CSP would block its own inline-free but hashed/module script tags without extra tuning.
    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(express.json({ limit: '1mb' }));

    app.use('/api', rateLimit({ windowMs: 60_000, limit: 120 }));

    app.use(createSessionMiddleware());
    app.use(passport.initialize());
    app.use(passport.session());

    app.use('/api/auth', authRoutes);
    // Public - no Discord session. Verified independently per-route (PayOS: HMAC signature;
    // PayPal: capture call round-trips through PayPal itself). See routes/webhooks.js.
    app.use('/api/webhooks', webhooksRoutes);
    app.use('/api/guilds', ensureAuthenticated, guildsRoutes);

    const guildRouter = express.Router({ mergeParams: true });
    guildRouter.use('/meta', metaRoutes);
    guildRouter.use('/moderation', moderationRoutes);
    guildRouter.use('/automod', automodRoutes);
    guildRouter.use('/antinuke', antinukeRoutes);
    guildRouter.use('/tickets', ticketsRoutes);
    guildRouter.use('/giveaways', giveawaysRoutes);
    guildRouter.use('/reaction-roles', reactionRolesRoutes);
    guildRouter.use('/welcome', welcomeRoutes);
    guildRouter.use('/logging', loggingRoutes);
    guildRouter.use('/settings', settingsRoutes);
    guildRouter.use('/stats-channels', statsChannelsRoutes);
    guildRouter.use('/birthday', birthdayRoutes);
    guildRouter.use('/starboard', starboardRoutes);
    guildRouter.use('/verification', verificationRoutes);
    guildRouter.use('/sticky-nicknames', stickyNicknamesRoutes);
    guildRouter.use('/shop', shopRoutes);
    app.use('/api/guilds/:guildId', ensureAuthenticated, ensureGuildAccess, guildRouter);

    app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

    // Serve the built frontend in production (dashboard/dist, produced by `npm run build` in dashboard/).
    const distDir = path.join(__dirname, '..', 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
        res.sendFile(path.join(distDir, 'index.html'), (err) => {
            if (err) next();
        });
    });

    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        console.error('[Infinity Bot Dashboard] Unhandled error:', err);
        if (res.headersSent) return;
        res.status(500).json({ error: 'internal server error' });
    });

    return app;
}

module.exports = { createApp };
