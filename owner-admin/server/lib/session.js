'use strict';

const session = require('express-session');
const connectSessionSequelize = require('connect-session-sequelize');
const sequelize = require('../../../src/database/sequelize');
const config = require('../config');

const SequelizeStore = connectSessionSequelize(session.Store);

const DAY_MS = 24 * 60 * 60 * 1000;

// Deliberately a different table name than the guild dashboard's `dashboard_sessions` (see
// dashboard/server/lib/session.js) - same Postgres database, completely separate session store, so
// a guild-dashboard Discord OAuth session can never be mistaken for an owner-admin login.
const store = new SequelizeStore({
    db: sequelize,
    tableName: 'owner_admin_sessions',
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 7 * DAY_MS
});

function createSessionMiddleware() {
    return session({
        name: 'owner.admin.sid',
        secret: config.sessionSecret,
        store,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: config.isProduction,
            maxAge: 7 * DAY_MS
        }
    });
}

module.exports = { createSessionMiddleware, store };
