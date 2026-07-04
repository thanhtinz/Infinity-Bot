'use strict';

const express = require('express');
const { StarboardConfig } = require('../lib/models');

const router = express.Router({ mergeParams: true });

const FIELDS = ['channelId', 'emoji', 'threshold', 'enabled'];

function serialize(row) {
    if (!row) return { channelId: null, emoji: '⭐', threshold: 3, enabled: false };
    return row.get({ plain: true });
}

router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const config = await StarboardConfig.findOne({ where: { guildId } });
    res.json({ config: serialize(config) });
});

router.put('/', async (req, res) => {
    const { guildId } = req.params;
    const body = req.body || {};

    if (body.threshold !== undefined && (!Number.isInteger(body.threshold) || body.threshold < 1)) {
        return res.status(400).json({ error: 'threshold must be a positive integer' });
    }
    if (body.emoji !== undefined && !body.emoji) {
        return res.status(400).json({ error: 'emoji is required' });
    }

    const [config] = await StarboardConfig.findOrCreate({ where: { guildId }, defaults: { guildId } });
    for (const field of FIELDS) if (body[field] !== undefined) config[field] = body[field];
    await config.save();

    res.json({ config: serialize(config) });
});

module.exports = router;
