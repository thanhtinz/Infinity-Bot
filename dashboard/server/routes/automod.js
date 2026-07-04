'use strict';

const express = require('express');
const { AutomodConfig, AutomodWhitelist } = require('../lib/models');

const router = express.Router({ mergeParams: true });

const DEFAULT_AUTOMOD = {
    enabled: false, logChannelId: null, punishment: 'delete', muteDuration: 300,
    antiSpamPunishment: 'delete', antiLinkPunishment: 'delete', antiInvitePunishment: 'delete',
    antiBadWordsPunishment: 'delete', antiMassMentionPunishment: 'delete', antiCapsPunishment: 'delete', antiPingPunishment: 'delete',
    antiSpam: true, antiLink: false, antiInvite: true, antiBadWords: false, antiMassMention: true, antiCaps: false, antiPing: false,
    spamThreshold: 5, spamInterval: 5, mentionLimit: 5, capsPercentage: 70, capsMinLength: 10
};

const PUNISHMENTS = ['delete', 'warn', 'mute', 'kick', 'ban'];
const PUNISHMENT_FIELDS = [
    'punishment', 'antiSpamPunishment', 'antiLinkPunishment', 'antiInvitePunishment',
    'antiBadWordsPunishment', 'antiMassMentionPunishment', 'antiCapsPunishment', 'antiPingPunishment'
];
const EDITABLE_FIELDS = Object.keys(DEFAULT_AUTOMOD);

function serializeConfig(row) {
    if (!row) return { ...DEFAULT_AUTOMOD, badWords: [] };
    const plain = row.get({ plain: true });
    return { ...DEFAULT_AUTOMOD, ...plain, badWords: row.getBadWords() };
}

router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const [config, whitelist] = await Promise.all([
        AutomodConfig.findOne({ where: { guildId } }),
        AutomodWhitelist.findAll({ where: { guildId } })
    ]);
    res.json({
        config: serializeConfig(config),
        whitelist: whitelist.map((w) => ({ id: w.id, targetId: w.targetId, targetType: w.targetType, modules: w.getModules() }))
    });
});

router.put('/', async (req, res) => {
    const { guildId } = req.params;
    const body = req.body || {};

    for (const field of PUNISHMENT_FIELDS) {
        if (body[field] !== undefined && !PUNISHMENTS.includes(body[field])) {
            return res.status(400).json({ error: `${field} must be one of ${PUNISHMENTS.join(', ')}` });
        }
    }

    const [config] = await AutomodConfig.findOrCreate({ where: { guildId }, defaults: { guildId } });
    for (const field of EDITABLE_FIELDS) {
        if (body[field] !== undefined) config[field] = body[field];
    }
    if (Array.isArray(body.badWords)) {
        config.badWords = JSON.stringify(body.badWords.map(String));
    }
    await config.save();
    res.json({ config: serializeConfig(config) });
});

router.post('/whitelist', async (req, res) => {
    const { guildId } = req.params;
    const { targetId, targetType, modules } = req.body || {};
    if (!targetId || !['user', 'role', 'channel'].includes(targetType)) {
        return res.status(400).json({ error: 'targetId and a valid targetType (user, role, channel) are required' });
    }

    try {
        const entry = await AutomodWhitelist.create({
            guildId, targetId, targetType,
            modules: JSON.stringify(Array.isArray(modules) ? modules : [])
        });
        res.status(201).json({ id: entry.id, targetId: entry.targetId, targetType: entry.targetType, modules: entry.getModules() });
    } catch {
        res.status(409).json({ error: 'this target is already whitelisted' });
    }
});

router.delete('/whitelist/:entryId', async (req, res) => {
    const { guildId, entryId } = req.params;
    const deleted = await AutomodWhitelist.destroy({ where: { id: entryId, guildId } });
    if (!deleted) return res.status(404).json({ error: 'entry not found' });
    res.json({ ok: true });
});

module.exports = router;
