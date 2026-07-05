'use strict';

/**
 * Thin wrapper around PayOS (https://payos.vn), a Vietnamese payment gateway that generates a
 * bank-transfer QR code for a given amount and confirms payment via a signed webhook callback.
 *
 * Credentials resolve in this order: `PaymentGatewayConfig` DB row (id: 1, edited from the Owner
 * Admin Panel) -> process.env (PAYOS_CLIENT_ID / PAYOS_API_KEY / PAYOS_CHECKSUM_KEY). If neither is
 * set, every call here throws a `PayOsNotConfiguredError` - callers must catch this and show a
 * friendly bilingual message instead of letting it bubble up as an unhandled rejection.
 *
 * IMPORTANT / UNVERIFIED: the create-payment-link request signature and the webhook signature
 * verification below are implemented from PayOS's publicly documented checksum scheme (HMAC-SHA256
 * over an alphabetically key-sorted `key=value` query string of the request body, using the
 * "Checksum Key" from the PayOS merchant dashboard) without live sandbox credentials to test
 * against. The general HMAC approach is correct per PayOS's docs, but exact field inclusion/casing
 * should be re-verified against a live PayOS sandbox account once credentials are available - see
 * the README "Shop / Premium" section.
 */

const crypto = require('crypto');
const axios = require('axios');

const PAYOS_BASE_URL = 'https://api-merchant.payos.vn';

class PayOsNotConfiguredError extends Error {
    constructor() {
        super('PayOS is not configured (missing client id / API key / checksum key).');
        this.name = 'PayOsNotConfiguredError';
        this.code = 'PAYOS_NOT_CONFIGURED';
    }
}

/**
 * Resolves PayOS credentials, preferring the owner-admin-editable DB row over env vars.
 * Never logs the resolved values.
 */
async function resolveConfig() {
    let clientId = process.env.PAYOS_CLIENT_ID || null;
    let apiKey = process.env.PAYOS_API_KEY || null;
    let checksumKey = process.env.PAYOS_CHECKSUM_KEY || null;

    try {
        const { PaymentGatewayConfig } = require('../../../database/models');
        const row = await PaymentGatewayConfig.findByPk(1);
        if (row) {
            clientId = row.payosClientId || clientId;
            apiKey = row.payosApiKey || apiKey;
            checksumKey = row.payosChecksumKey || checksumKey;
        }
    } catch {
        // DB unavailable - fall back to whatever env vars provided above.
    }

    return { clientId, apiKey, checksumKey };
}

function isConfigured(cfg) {
    return !!(cfg && cfg.clientId && cfg.apiKey && cfg.checksumKey);
}

/**
 * PayOS's documented checksum scheme: build a `key=value` string of the given fields sorted
 * alphabetically by key, joined with `&`, then HMAC-SHA256 it (hex digest) with the checksum key.
 * Used both for signing an outgoing create-payment-link request and (with the webhook's `data`
 * object) for verifying an incoming webhook.
 */
function buildSignature(fields, checksumKey) {
    const sortedKeys = Object.keys(fields).sort();
    const canonical = sortedKeys
        .map((key) => {
            const value = fields[key];
            const stringValue = value === null || value === undefined ? '' : (typeof value === 'object' ? JSON.stringify(value) : String(value));
            return `${key}=${stringValue}`;
        })
        .join('&');
    return crypto.createHmac('sha256', checksumKey).update(canonical).digest('hex');
}

/**
 * Creates a PayOS payment link/QR for a single order.
 * @param {object} params
 * @param {number} params.orderCode - unique numeric order code (PayOS requires a number, not a string)
 * @param {number} params.amount - amount in whole VND (no decimals)
 * @param {string} params.description - short description, PayOS caps this at 25 characters
 * @param {string} params.returnUrl - where PayOS redirects the buyer after a successful payment
 * @param {string} params.cancelUrl - where PayOS redirects the buyer if they cancel
 * @returns {Promise<{ checkoutUrl: string, qrCode: string, paymentLinkId: string, orderCode: number }>}
 */
async function createPaymentLink({ orderCode, amount, description, returnUrl, cancelUrl }) {
    const cfg = await resolveConfig();
    if (!isConfigured(cfg)) throw new PayOsNotConfiguredError();

    const truncatedDescription = String(description || 'Shop order').slice(0, 25);

    // Per PayOS docs, the signature for POST /v2/payment-requests only covers these five fields.
    const signature = buildSignature(
        { amount, cancelUrl, description: truncatedDescription, orderCode, returnUrl },
        cfg.checksumKey
    );

    const body = {
        orderCode,
        amount,
        description: truncatedDescription,
        cancelUrl,
        returnUrl,
        signature
    };

    const response = await axios.post(`${PAYOS_BASE_URL}/v2/payment-requests`, body, {
        headers: {
            'x-client-id': cfg.clientId,
            'x-api-key': cfg.apiKey,
            'Content-Type': 'application/json'
        },
        timeout: 10_000
    });

    const data = response.data?.data;
    if (!data) throw new Error(response.data?.desc || 'PayOS did not return a payment link');

    return {
        checkoutUrl: data.checkoutUrl,
        qrCode: data.qrCode,
        paymentLinkId: data.paymentLinkId,
        orderCode: data.orderCode
    };
}

/**
 * Verifies the `signature` field of an incoming PayOS webhook body against its `data` payload.
 * Returns false (rather than throwing) on any mismatch or missing config, so callers can respond
 * with a clean 4xx instead of crashing the webhook route.
 */
async function verifyWebhookSignature(webhookBody) {
    const cfg = await resolveConfig();
    if (!isConfigured(cfg)) return false;
    if (!webhookBody || typeof webhookBody !== 'object' || !webhookBody.data || !webhookBody.signature) return false;

    try {
        const expected = buildSignature(webhookBody.data, cfg.checksumKey);
        return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(webhookBody.signature, 'hex'));
    } catch {
        return false;
    }
}

module.exports = {
    PayOsNotConfiguredError,
    resolveConfig,
    isConfigured,
    createPaymentLink,
    verifyWebhookSignature
};
