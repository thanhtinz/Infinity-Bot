'use strict';

const express = require('express');
const { BotRuntimeConfig } = require('../../../src/database/models');

const router = express.Router();

async function getSingletonRow() {
    let row = await BotRuntimeConfig.findByPk(1);
    if (!row) {
        // First read ever: seed sensible defaults from the current .env values, per the spec - the
        // row only overrides the bot's startup once an admin actually edits and saves something.
        row = await BotRuntimeConfig.create({
            id: 1,
            botToken: null,
            clientId: null,
            clientSecret: null,
            ownerId: null,
            prefix: null,
            statusText: null,
            enabled: true
        });
    }
    return row;
}

// Never send a secret value back to the browser in full - only the last 4 characters, so the admin
// can tell "is this the token I think it is" without the full secret ever leaving the server after
// it's saved.
function maskSecret(value) {
    if (!value) return null;
    const last4 = value.slice(-4);
    return value.length <= 4 ? '*'.repeat(value.length) : `${'*'.repeat(Math.min(value.length - 4, 12))}${last4}`;
}

router.get('/', async (req, res) => {
    try {
        const row = await getSingletonRow();

        const effectiveToken = row.botToken || process.env.BOT_TOKEN || null;
        const effectiveClientSecret = row.clientSecret || process.env.DISCORD_CLIENT_SECRET || null;

        res.json({
            botTokenMasked: maskSecret(effectiveToken),
            botTokenSource: row.botToken ? 'database' : (process.env.BOT_TOKEN ? 'env' : 'unset'),
            clientId: row.clientId || process.env.CLIENT_ID || '',
            clientSecretMasked: maskSecret(effectiveClientSecret),
            clientSecretSource: row.clientSecret ? 'database' : (process.env.DISCORD_CLIENT_SECRET ? 'env' : 'unset'),
            ownerId: row.ownerId || process.env.OWNER_ID || '',
            prefix: row.prefix || process.env.PREFIX || ',',
            statusText: row.statusText || '',
            enabled: row.enabled !== false
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'failed to read bot runtime config' });
    }
});

router.put('/', async (req, res) => {
    try {
        const row = await getSingletonRow();
        const body = req.body || {};

        // botToken/clientSecret: only overwrite when a non-empty value is actually submitted. The
        // frontend always sends these fields blank (it never round-trips the masked value back),
        // so an untouched field means "keep the current secret", not "clear it".
        if (typeof body.botToken === 'string' && body.botToken.trim().length > 0) {
            row.botToken = body.botToken.trim();
        }
        if (typeof body.clientSecret === 'string' && body.clientSecret.trim().length > 0) {
            row.clientSecret = body.clientSecret.trim();
        }

        if ('clientId' in body) row.clientId = body.clientId ? String(body.clientId).trim() : null;
        if ('ownerId' in body) row.ownerId = body.ownerId ? String(body.ownerId).trim() : null;
        if ('prefix' in body) row.prefix = body.prefix ? String(body.prefix) : null;
        if ('statusText' in body) row.statusText = body.statusText ? String(body.statusText).trim() : null;
        if ('enabled' in body) row.enabled = !!body.enabled;

        await row.save();
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message || 'failed to save bot runtime config' });
    }
});

module.exports = router;
