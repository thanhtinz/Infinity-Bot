'use strict';

const config = require('../config');

/**
 * Server-to-server client for the bot's internal control API (src/bot/dashboardApi.js), mirroring
 * dashboard/server/lib/botApi.js's request-signing approach (shared secret in the `x-api-secret`
 * header). Never expose BOT_API_SECRET or these calls to the browser - only this server's own
 * Express routes should import this module.
 */

async function request(path, { timeoutMs = 8000, method = 'GET' } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${config.botApiBaseUrl}${path}`, {
            method,
            headers: { 'x-api-secret': config.botApiSecret, accept: 'application/json' },
            signal: controller.signal
        });

        if (response.status === 404) return null;
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || `bot API request failed: ${response.status}`);
        }
        if (response.status === 204) return null;
        return response.json();
    } finally {
        clearTimeout(timeout);
    }
}

function getStatus() {
    return request('/control/status');
}

function restart() {
    return request('/control/restart', { method: 'POST', timeoutMs: 20000 });
}

function stop() {
    return request('/control/stop', { method: 'POST', timeoutMs: 10000 });
}

function start() {
    return request('/control/start', { method: 'POST', timeoutMs: 20000 });
}

function getGuilds() {
    return request('/guilds').then((data) => data || []);
}

function leaveGuild(guildId) {
    return request(`/guilds/${guildId}`, { method: 'DELETE' });
}

module.exports = { getStatus, restart, stop, start, getGuilds, leaveGuild };
