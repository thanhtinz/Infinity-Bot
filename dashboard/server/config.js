'use strict';

require('dotenv').config({ quiet: true });

const env = process.env;
const read = (key, fallback = '') => env[key] ?? fallback;

const port = Number(read('DASHBOARD_PORT', '3000')) || 3000;
const botApiPort = Number(read('BOT_API_PORT', '3002')) || 3002;

module.exports = {
    port,
    isProduction: env.NODE_ENV === 'production',

    // The dashboard OAuth app is the same Discord Application as the bot (CLIENT_ID), unless a
    // dedicated DISCORD_CLIENT_ID is provided.
    discordClientId: read('DISCORD_CLIENT_ID') || read('CLIENT_ID'),
    discordClientSecret: read('DISCORD_CLIENT_SECRET'),
    discordBotToken: read('BOT_TOKEN'),

    publicUrl: read('DASHBOARD_PUBLIC_URL', `http://localhost:5173`),
    callbackUrl: read('DASHBOARD_CALLBACK_URL', `http://localhost:${port}/api/auth/discord/callback`),

    sessionSecret: read('DASHBOARD_SESSION_SECRET', 'change-me-main-dashboard-secret'),

    botApiBaseUrl: read('BOT_API_BASE_URL', `http://127.0.0.1:${botApiPort}`),
    botApiSecret: read('BOT_API_SECRET'),

    getMissingRequiredEnv() {
        const required = ['DISCORD_CLIENT_SECRET', 'DASHBOARD_SESSION_SECRET', 'BOT_API_SECRET'];
        return required.filter((key) => !read(key));
    }
};
