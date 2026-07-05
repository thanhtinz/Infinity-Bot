'use strict';

/**
 * Thin wrapper around PayPal's Checkout Orders v2 REST API (well-documented, stable API):
 * OAuth2 client-credentials token exchange, then create-order / capture-order.
 *
 * Credentials resolve in this order: `PaymentGatewayConfig` DB row (id: 1, edited from the Owner
 * Admin Panel) -> process.env (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_MODE). If not
 * configured, every call throws a `PayPalNotConfiguredError` - callers must catch this and show a
 * friendly bilingual message instead of crashing.
 */

const axios = require('axios');

class PayPalNotConfiguredError extends Error {
    constructor() {
        super('PayPal is not configured (missing client id / client secret).');
        this.name = 'PayPalNotConfiguredError';
        this.code = 'PAYPAL_NOT_CONFIGURED';
    }
}

async function resolveConfig() {
    let clientId = process.env.PAYPAL_CLIENT_ID || null;
    let clientSecret = process.env.PAYPAL_CLIENT_SECRET || null;
    let mode = process.env.PAYPAL_MODE || 'sandbox';

    try {
        const { PaymentGatewayConfig } = require('../../../database/models');
        const row = await PaymentGatewayConfig.findByPk(1);
        if (row) {
            clientId = row.paypalClientId || clientId;
            clientSecret = row.paypalClientSecret || clientSecret;
            mode = row.paypalMode || mode;
        }
    } catch {
        // DB unavailable - fall back to whatever env vars provided above.
    }

    return { clientId, clientSecret, mode: mode === 'live' ? 'live' : 'sandbox' };
}

function isConfigured(cfg) {
    return !!(cfg && cfg.clientId && cfg.clientSecret);
}

function baseUrl(mode) {
    return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

/** Exchanges client id/secret for a short-lived OAuth2 access token. */
async function getAccessToken() {
    const cfg = await resolveConfig();
    if (!isConfigured(cfg)) throw new PayPalNotConfiguredError();

    const basicAuth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
    const response = await axios.post(
        `${baseUrl(cfg.mode)}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
            headers: {
                Authorization: `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10_000
        }
    );

    return { accessToken: response.data.access_token, mode: cfg.mode };
}

/**
 * Creates a PayPal Checkout order for the given USD amount.
 * @param {object} params
 * @param {string} params.amountUsd - decimal string, e.g. "9.99"
 * @param {string} params.referenceId - our own order id, so the capture step can look it back up
 * @param {string} params.description
 * @param {string} params.returnUrl
 * @param {string} params.cancelUrl
 * @returns {Promise<{ orderId: string, approveUrl: string }>}
 */
async function createOrder({ amountUsd, referenceId, description, returnUrl, cancelUrl }) {
    const { accessToken, mode } = await getAccessToken();

    const response = await axios.post(
        `${baseUrl(mode)}/v2/checkout/orders`,
        {
            intent: 'CAPTURE',
            purchase_units: [
                {
                    reference_id: String(referenceId),
                    description: String(description || 'Shop order').slice(0, 127),
                    amount: { currency_code: 'USD', value: String(amountUsd) }
                }
            ],
            application_context: {
                return_url: returnUrl,
                cancel_url: cancelUrl,
                user_action: 'PAY_NOW'
            }
        },
        {
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            timeout: 10_000
        }
    );

    const order = response.data;
    const approveLink = (order.links || []).find((l) => l.rel === 'approve');

    return { orderId: order.id, approveUrl: approveLink ? approveLink.href : null };
}

/** Captures (finalizes) a previously-approved PayPal order. */
async function captureOrder(orderId) {
    const { accessToken, mode } = await getAccessToken();

    const response = await axios.post(
        `${baseUrl(mode)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        {},
        {
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            timeout: 10_000
        }
    );

    const data = response.data;
    const capture = data?.purchase_units?.[0]?.payments?.captures?.[0];

    return {
        status: data.status,
        captureId: capture?.id || null,
        captureStatus: capture?.status || null
    };
}

module.exports = {
    PayPalNotConfiguredError,
    resolveConfig,
    isConfigured,
    getAccessToken,
    createOrder,
    captureOrder
};
