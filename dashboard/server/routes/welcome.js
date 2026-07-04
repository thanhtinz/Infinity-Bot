'use strict';

const express = require('express');
const { WelcomeConfig, FarewellConfig, GuildConfig } = require('../lib/models');

const router = express.Router({ mergeParams: true });

const MESSAGE_FIELDS = ['channelId', 'type', 'message', 'title', 'description', 'thumbnailUrl', 'imageUrl'];

function serialize(row) {
    if (!row) {
        return { channelId: null, type: 'simple', message: null, title: null, description: null, thumbnailUrl: null, imageUrl: null };
    }
    return row.get({ plain: true });
}

router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const [welcome, farewell, guildConfig] = await Promise.all([
        WelcomeConfig.findOne({ where: { guildId } }),
        FarewellConfig.findOne({ where: { guildId } }),
        GuildConfig.findOne({ where: { guildId } })
    ]);
    res.json({
        welcome: serialize(welcome),
        farewell: serialize(farewell),
        welcomeInOn: guildConfig?.welcomeInOn ?? false,
        welcomeOutOn: guildConfig?.welcomeOutOn ?? false
    });
});

router.put('/', async (req, res) => {
    const { guildId } = req.params;
    const body = req.body || {};

    if (body.welcome?.type !== undefined && !['simple', 'container'].includes(body.welcome.type)) {
        return res.status(400).json({ error: 'welcome.type must be simple or container' });
    }
    if (body.farewell?.type !== undefined && !['simple', 'container'].includes(body.farewell.type)) {
        return res.status(400).json({ error: 'farewell.type must be simple or container' });
    }

    const [welcome] = await WelcomeConfig.findOrCreate({ where: { guildId }, defaults: { guildId } });
    const [farewell] = await FarewellConfig.findOrCreate({ where: { guildId }, defaults: { guildId } });
    const [guildConfig] = await GuildConfig.findOrCreate({ where: { guildId }, defaults: { guildId } });

    if (body.welcome) {
        for (const field of MESSAGE_FIELDS) if (body.welcome[field] !== undefined) welcome[field] = body.welcome[field];
        await welcome.save();
    }
    if (body.farewell) {
        for (const field of MESSAGE_FIELDS) if (body.farewell[field] !== undefined) farewell[field] = body.farewell[field];
        await farewell.save();
    }
    if (body.welcomeInOn !== undefined) guildConfig.welcomeInOn = !!body.welcomeInOn;
    if (body.welcomeOutOn !== undefined) guildConfig.welcomeOutOn = !!body.welcomeOutOn;
    await guildConfig.save();

    res.json({
        welcome: serialize(welcome),
        farewell: serialize(farewell),
        welcomeInOn: guildConfig.welcomeInOn,
        welcomeOutOn: guildConfig.welcomeOutOn
    });
});

module.exports = router;
