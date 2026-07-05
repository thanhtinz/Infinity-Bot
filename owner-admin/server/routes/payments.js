'use strict';

const express = require('express');
const { PaymentGatewayConfig } = require('../../../src/database/models');

const router = express.Router();

async function getSingletonRow() {
    let row = await PaymentGatewayConfig.findByPk(1);
    if (!row) {
        row = await PaymentGatewayConfig.create({ id: 1 });
    }
    return row;
}

// Same masking convention as owner-admin/server/routes/config.js's BotRuntimeConfig: only the
// last 4 characters of a secret are ever sent back to the browser.
function maskSecret(value) {
    if (!value) return null;
    const last4 = value.slice(-4);
    return value.length <= 4 ? '*'.repeat(value.length) : `${'*'.repeat(Math.min(value.length - 4, 12))}${last4}`;
}

router.get('/', async (req, res) => {
    try {
        const row = await getSingletonRow();

        const effectivePayosApiKey = row.payosApiKey || process.env.PAYOS_API_KEY || null;
        const effectivePayosChecksumKey = row.payosChecksumKey || process.env.PAYOS_CHECKSUM_KEY || null;
        const effectivePaypalSecret = row.paypalClientSecret || process.env.PAYPAL_CLIENT_SECRET || null;

        res.json({
            payosClientId: row.payosClientId || process.env.PAYOS_CLIENT_ID || '',
            payosApiKeyMasked: maskSecret(effectivePayosApiKey),
            payosApiKeySource: row.payosApiKey ? 'database' : (process.env.PAYOS_API_KEY ? 'env' : 'unset'),
            payosChecksumKeyMasked: maskSecret(effectivePayosChecksumKey),
            payosChecksumKeySource: row.payosChecksumKey ? 'database' : (process.env.PAYOS_CHECKSUM_KEY ? 'env' : 'unset'),

            paypalClientId: row.paypalClientId || process.env.PAYPAL_CLIENT_ID || '',
            paypalClientSecretMasked: maskSecret(effectivePaypalSecret),
            paypalClientSecretSource: row.paypalClientSecret ? 'database' : (process.env.PAYPAL_CLIENT_SECRET ? 'env' : 'unset'),
            paypalMode: row.paypalMode || process.env.PAYPAL_MODE || 'sandbox',

            cryptoWalletBtc: row.cryptoWalletBtc || process.env.CRYPTO_WALLET_BTC || '',
            cryptoWalletEth: row.cryptoWalletEth || process.env.CRYPTO_WALLET_ETH || '',
            cryptoWalletUsdt: row.cryptoWalletUsdt || process.env.CRYPTO_WALLET_USDT || ''
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'failed to read payment gateway config' });
    }
});

router.put('/', async (req, res) => {
    try {
        const row = await getSingletonRow();
        const body = req.body || {};

        // Secrets: only overwrite when a non-empty value is actually submitted - the frontend always
        // sends these blank (never round-trips the masked value), so blank means "keep current".
        if (typeof body.payosApiKey === 'string' && body.payosApiKey.trim()) row.payosApiKey = body.payosApiKey.trim();
        if (typeof body.payosChecksumKey === 'string' && body.payosChecksumKey.trim()) row.payosChecksumKey = body.payosChecksumKey.trim();
        if (typeof body.paypalClientSecret === 'string' && body.paypalClientSecret.trim()) row.paypalClientSecret = body.paypalClientSecret.trim();

        if ('payosClientId' in body) row.payosClientId = body.payosClientId ? String(body.payosClientId).trim() : null;
        if ('paypalClientId' in body) row.paypalClientId = body.paypalClientId ? String(body.paypalClientId).trim() : null;
        if ('paypalMode' in body) row.paypalMode = body.paypalMode === 'live' ? 'live' : 'sandbox';
        if ('cryptoWalletBtc' in body) row.cryptoWalletBtc = body.cryptoWalletBtc ? String(body.cryptoWalletBtc).trim() : null;
        if ('cryptoWalletEth' in body) row.cryptoWalletEth = body.cryptoWalletEth ? String(body.cryptoWalletEth).trim() : null;
        if ('cryptoWalletUsdt' in body) row.cryptoWalletUsdt = body.cryptoWalletUsdt ? String(body.cryptoWalletUsdt).trim() : null;

        await row.save();
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message || 'failed to save payment gateway config' });
    }
});

module.exports = router;
