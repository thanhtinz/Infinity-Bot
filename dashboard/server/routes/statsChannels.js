'use strict';

const express = require('express');
const { StatsChannelConfig } = require('../lib/models');
const { VALID_TYPES, defaultTemplate } = require('../../../src/bot/utils/statsChannelUtils');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const rows = await StatsChannelConfig.findAll({ where: { guildId }, order: [['createdAt', 'ASC']] });
    res.json(rows);
});

router.post('/', async (req, res) => {
    const { guildId } = req.params;
    const { type, channelId, roleId, nameTemplate } = req.body || {};

    if (!channelId) return res.status(400).json({ error: 'channelId is required' });
    if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }
    if (type === 'roleCount' && !roleId) {
        return res.status(400).json({ error: 'roleId is required for the roleCount type' });
    }
    if (nameTemplate && !nameTemplate.includes('{count}')) {
        return res.status(400).json({ error: 'nameTemplate must contain a {count} placeholder' });
    }

    const existing = await StatsChannelConfig.findOne({ where: { channelId } });
    if (existing) return res.status(409).json({ error: 'that channel is already a stats channel' });

    const row = await StatsChannelConfig.create({
        guildId,
        channelId,
        type,
        roleId: type === 'roleCount' ? roleId : null,
        nameTemplate: nameTemplate || defaultTemplate(type)
    });
    res.status(201).json(row);
});

router.delete('/:id', async (req, res) => {
    const { guildId, id } = req.params;
    const deleted = await StatsChannelConfig.destroy({ where: { id, guildId } });
    if (!deleted) return res.status(404).json({ error: 'stats channel not found' });
    res.json({ ok: true });
});

module.exports = router;
