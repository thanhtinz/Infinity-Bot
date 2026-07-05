'use strict';

const config = require('../config');

/**
 * Server-to-server client for the bot's dashboard status API (src/bot/dashboardApi.js).
 * Never expose BOT_API_SECRET or these calls to the browser - only the dashboard's own
 * Express routes should import this module.
 */

async function request(path, { timeoutMs = 4000, method = 'GET', body } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const headers = { 'x-api-secret': config.botApiSecret, accept: 'application/json' };
        if (body !== undefined) headers['content-type'] = 'application/json';

        const response = await fetch(`${config.botApiBaseUrl}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
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

function postVerificationPanel(guildId) {
    return request(`/guilds/${guildId}/verification/panel`, { method: 'POST', timeoutMs: 8000 });
}

// Tells the live bot process a shop order was just confirmed paid (by a PayOS/PayPal webhook, or a
// dashboard admin manually confirming a crypto payment) so it can grant the product's role and
// record a PremiumSubscription - see src/bot/dashboardApi.js POST /shop/fulfill-order.
function fulfillOrder(orderId) {
    return request('/shop/fulfill-order', { method: 'POST', timeoutMs: 8000, body: { orderId } });
}

module.exports = { getGuilds, getGuild, getMember, postVerificationPanel, fulfillOrder };
