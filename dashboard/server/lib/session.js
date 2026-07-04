'use strict';

const session = require('express-session');
const connectSessionSequelize = require('connect-session-sequelize');
const sequelize = require('../../../src/database/sequelize');
const config = require('../config');

const SequelizeStore = connectSessionSequelize(session.Store);

const DAY_MS = 24 * 60 * 60 * 1000;

const store = new SequelizeStore({
    db: sequelize,
    tableName: 'dashboard_sessions',
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 30 * DAY_MS
});

function createSessionMiddleware() {
    return session({
        name: 'main.dashboard.sid',
        secret: config.sessionSecret,
        store,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: config.isProduction,
            maxAge: 30 * DAY_MS
        }
    });
}

module.exports = { createSessionMiddleware, store };
