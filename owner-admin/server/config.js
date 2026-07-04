'use strict';

require('dotenv').config({ quiet: true });

const env = process.env;
const read = (key, fallback = '') => env[key] ?? fallback;

const port = Number(read('ADMIN_PORT', '3004')) || 3004;
const botApiPort = Number(read('BOT_API_PORT', '3002')) || 3002;

module.exports = {
    port,
    isProduction: env.NODE_ENV === 'production',

    publicUrl: read('ADMIN_PUBLIC_URL', 'http://localhost:5174'),

    sessionSecret: read('ADMIN_SESSION_SECRET', 'change-me-owner-admin-secret'),

    botApiBaseUrl: read('BOT_API_BASE_URL', `http://127.0.0.1:${botApiPort}`),
    botApiSecret: read('BOT_API_SECRET'),

    getMissingRequiredEnv() {
        const required = ['ADMIN_SESSION_SECRET', 'BOT_API_SECRET'];
        return required.filter((key) => !read(key));
    }
};
