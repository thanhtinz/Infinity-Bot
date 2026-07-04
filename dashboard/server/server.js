'use strict';

const config = require('./config');
const { createApp } = require('./app');
const { store } = require('./lib/session');
const { dbReady } = require('../../src/database/models');

async function start() {
    const missing = config.getMissingRequiredEnv();
    if (missing.length) {
        console.warn(`[Infinity Bot Dashboard] Missing env vars: ${missing.join(', ')} - OAuth login and sessions will not work until these are set in .env.`);
    }

    try {
        await dbReady;
    } catch (error) {
        console.error('[Infinity Bot Dashboard] Database initialization failed:', error.message || error);
    }

    await new Promise((resolve) => {
        store.sync().then(resolve).catch((error) => {
            console.error('[Infinity Bot Dashboard] Failed to sync session store:', error.message || error);
            resolve();
        });
    });

    const app = createApp();
    app.listen(config.port, () => {
        console.log(`[Infinity Bot Dashboard] Server listening on http://localhost:${config.port}`);
        console.log(`[Infinity Bot Dashboard] Talking to bot status API at ${config.botApiBaseUrl}`);
    });
}

start();
