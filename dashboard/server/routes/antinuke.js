'use strict';

const express = require('express');
const { AntinukeConfig, AntinukeWhitelist } = require('../lib/models');

const router = express.Router({ mergeParams: true });

const DEFAULT_ANTINUKE = {
    enabled: false, logChannelId: null, punishment: 'stripall', threshold: 3, timeframe: 60,
    antiBan: true, antiKick: true, antiChannelCreate: true, antiChannelDelete: true,
    antiRoleCreate: true, antiRoleDelete: true, antiRoleUpdate: true, antiWebhook: true, antiBot: true,
    antiGuildUpdate: false, antiEmoji: false, antiChannelEdit: false
};

const PUNISHMENTS = ['stripall', 'kick', 'ban'];
const EDITABLE_FIELDS = Object.keys(DEFAULT_ANTINUKE);

function serializeConfig(row) {
    if (!row) return { ...DEFAULT_ANTINUKE };
    return { ...DEFAULT_ANTINUKE, ...row.get({ plain: true }) };
}

router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const [config, whitelist] = await Promise.all([
        AntinukeConfig.findOne({ where: { guildId } }),
        AntinukeWhitelist.findAll({ where: { guildId } })
    ]);
    res.json({
        config: serializeConfig(config),
        whitelist: whitelist.map((w) => ({ id: w.id, userId: w.userId, addedBy: w.addedBy, events: w.events }))
    });
});

router.put('/', async (req, res) => {
    const { guildId } = req.params;
    const body = req.body || {};

    if (body.punishment !== undefined && !PUNISHMENTS.includes(body.punishment)) {
        return res.status(400).json({ error: `punishment must be one of ${PUNISHMENTS.join(', ')}` });
    }

    const [config] = await AntinukeConfig.findOrCreate({ where: { guildId }, defaults: { guildId } });
    for (const field of EDITABLE_FIELDS) {
        if (body[field] !== undefined) config[field] = body[field];
    }
    if (body.logChannelId !== undefined) config.logChannelId = body.logChannelId;
    await config.save();
    res.json({ config: serializeConfig(config) });
});

router.post('/whitelist', async (req, res) => {
    const { guildId } = req.params;
    const { userId, events } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        const entry = await AntinukeWhitelist.create({
            guildId, userId, addedBy: req.user.id, events: events ?? null
        });
        res.status(201).json({ id: entry.id, userId: entry.userId, addedBy: entry.addedBy, events: entry.events });
    } catch {
        res.status(409).json({ error: 'this user is already whitelisted' });
    }
});

router.delete('/whitelist/:entryId', async (req, res) => {
    const { guildId, entryId } = req.params;
    const deleted = await AntinukeWhitelist.destroy({ where: { id: entryId, guildId } });
    if (!deleted) return res.status(404).json({ error: 'entry not found' });
    res.json({ ok: true });
});

module.exports = router;
