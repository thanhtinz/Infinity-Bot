'use strict';

const express = require('express');
const { GuildPrefix, AutoReact, J2CConfig, GuildConfig } = require('../lib/models');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const [prefix, autoReacts, j2c, guildConfig] = await Promise.all([
        GuildPrefix.getPrefix(guildId),
        AutoReact.findAll({ where: { guildId } }),
        J2CConfig.findOne({ where: { guildId } }),
        GuildConfig.findOne({ where: { guildId } })
    ]);
    res.json({
        prefix,
        autoReacts,
        j2c: j2c ? { textChannelId: j2c.textChannelId, voiceChannelId: j2c.voiceChannelId, categoryId: j2c.categoryId } : null,
        autoreactEnabled: guildConfig?.autoreactEnabled ?? true,
        aiChannelIds: guildConfig?.aiChannelIds ?? []
    });
});

router.put('/prefix', async (req, res) => {
    const { guildId } = req.params;
    const prefix = String(req.body?.prefix || '').trim();
    if (!prefix || prefix.length > 5) return res.status(400).json({ error: 'prefix must be 1-5 characters' });
    await GuildPrefix.setPrefix(guildId, prefix);
    res.json({ prefix });
});

router.post('/autoreact', async (req, res) => {
    const { guildId } = req.params;
    const { trigger, emoji } = req.body || {};
    if (!trigger || !emoji) return res.status(400).json({ error: 'trigger and emoji are required' });
    const entry = await AutoReact.create({ guildId, trigger, emoji });
    res.status(201).json(entry);
});

router.delete('/autoreact/:entryId', async (req, res) => {
    const { guildId, entryId } = req.params;
    const deleted = await AutoReact.destroy({ where: { id: entryId, guildId } });
    if (!deleted) return res.status(404).json({ error: 'entry not found' });
    res.json({ ok: true });
});

router.put('/j2c', async (req, res) => {
    const { guildId } = req.params;
    const { textChannelId, voiceChannelId, categoryId } = req.body || {};
    if (!textChannelId || !voiceChannelId || !categoryId) {
        return res.status(400).json({ error: 'textChannelId, voiceChannelId, and categoryId are required' });
    }

    const [j2c] = await J2CConfig.findOrCreate({ where: { guildId }, defaults: { guildId, textChannelId, voiceChannelId, categoryId } });
    j2c.textChannelId = textChannelId;
    j2c.voiceChannelId = voiceChannelId;
    j2c.categoryId = categoryId;
    await j2c.save();
    res.json({ j2c: { textChannelId: j2c.textChannelId, voiceChannelId: j2c.voiceChannelId, categoryId: j2c.categoryId } });
});

router.put('/guild-config', async (req, res) => {
    const { guildId } = req.params;
    const { autoreactEnabled, aiChannelIds } = req.body || {};
    const [guildConfig] = await GuildConfig.findOrCreate({ where: { guildId }, defaults: { guildId } });
    if (autoreactEnabled !== undefined) guildConfig.autoreactEnabled = !!autoreactEnabled;
    if (Array.isArray(aiChannelIds)) guildConfig.aiChannelIds = aiChannelIds;
    await guildConfig.save();
    res.json({ autoreactEnabled: guildConfig.autoreactEnabled, aiChannelIds: guildConfig.aiChannelIds });
});

module.exports = router;
