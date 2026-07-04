'use strict';

const config = require('../config');

/**
 * Server-to-server client for the bot's dashboard status API (src/bot/dashboardApi.js).
 * Never expose BOT_API_SECRET or these calls to the browser - only the dashboard's own
 * Express routes should import this module.
 */

async function request(path, { timeoutMs = 4000 } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${config.botApiBaseUrl}${path}`, {
            headers: { 'x-api-secret': config.botApiSecret, accept: 'application/json' },
            signal: controller.signal
        });

        if (response.status === 404) return null;
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || `bot API request failed: ${response.status}`);
        }
        return response.json();
    } finally {
        clearTimeout(timeout);
    }
}

function getGuilds() {
    return request('/guilds').then((data) => data || []);
}

function getGuild(guildId) {
    return request(`/guilds/${guildId}`);
}

function getMember(guildId, userId) {
    return request(`/guilds/${guildId}/member/${userId}`);
}

module.exports = { getGuilds, getGuild, getMember };
