'use strict';

const express = require('express');
const { VerificationConfig } = require('../lib/models');
const botApi = require('../lib/botApi');

const router = express.Router({ mergeParams: true });

const FIELDS = ['enabled', 'channelId', 'unverifiedRoleId', 'verifiedRoleId', 'message'];

function serialize(row) {
    if (!row) {
        return {
            enabled: false, channelId: null, unverifiedRoleId: null, verifiedRoleId: null,
            message: null, panelMessageId: null
        };
    }
    return row.get({ plain: true });
}

router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const config = await VerificationConfig.findOne({ where: { guildId } });
    res.json({ config: serialize(config) });
});

router.put('/', async (req, res) => {
    const { guildId } = req.params;
    const body = req.body || {};

    const [config] = await VerificationConfig.findOrCreate({ where: { guildId }, defaults: { guildId } });
    for (const field of FIELDS) if (body[field] !== undefined) config[field] = body[field];

    if (config.enabled && (!config.channelId || !config.verifiedRoleId)) {
        return res.status(400).json({ error: 'a channel and verified role are required before enabling verification' });
    }

    await config.save();

    res.json({ config: serialize(config) });
});

router.post('/panel', async (req, res) => {
    const { guildId } = req.params;
    try {
        const result = await botApi.postVerificationPanel(guildId);
        res.json(result || { ok: true });
    } catch (error) {
        res.status(502).json({ error: error.message || 'failed to post the verification panel' });
    }
});

module.exports = router;
