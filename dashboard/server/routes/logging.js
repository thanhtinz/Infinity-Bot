'use strict';

const express = require('express');
const { LoggingConfig, GuildConfig } = require('../lib/models');

const router = express.Router({ mergeParams: true });

const FIELDS = ['messageLogsChannelId', 'memberLogsChannelId', 'moderationLogsChannelId', 'serverLogsChannelId', 'voiceLogsChannelId'];

router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const [config, guildConfig] = await Promise.all([
        LoggingConfig.findOne({ where: { guildId } }),
        GuildConfig.findOne({ where: { guildId } })
    ]);
    const plain = config ? config.get({ plain: true }) : {};
    res.json({
        config: Object.fromEntries(FIELDS.map((field) => [field, plain[field] ?? null])),
        loggingEnabled: guildConfig?.loggingEnabled ?? false
    });
});

router.put('/', async (req, res) => {
    const { guildId } = req.params;
    const body = req.body || {};

    const [config] = await LoggingConfig.findOrCreate({ where: { guildId }, defaults: { guildId } });
    const [guildConfig] = await GuildConfig.findOrCreate({ where: { guildId }, defaults: { guildId } });

    for (const field of FIELDS) if (body[field] !== undefined) config[field] = body[field];
    if (body.loggingEnabled !== undefined) guildConfig.loggingEnabled = !!body.loggingEnabled;
    await Promise.all([config.save(), guildConfig.save()]);

    const plain = config.get({ plain: true });
    res.json({
        config: Object.fromEntries(FIELDS.map((field) => [field, plain[field] ?? null])),
        loggingEnabled: guildConfig.loggingEnabled
    });
});

module.exports = router;
