'use strict';

const express = require('express');
const { Birthday, BirthdayConfig } = require('../lib/models');

const router = express.Router({ mergeParams: true });

const CONFIG_FIELDS = ['channelId', 'roleId', 'message'];

function serializeConfig(row) {
    if (!row) return { channelId: null, roleId: null, message: 'Happy Birthday, {user}! \u{1F389}' };
    return row.get({ plain: true });
}

router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const [config, birthdays] = await Promise.all([
        BirthdayConfig.findOne({ where: { guildId } }),
        Birthday.findAll({ where: { guildId }, order: [['month', 'ASC'], ['day', 'ASC']] })
    ]);
    res.json({ config: serializeConfig(config), birthdays });
});

router.put('/', async (req, res) => {
    const { guildId } = req.params;
    const body = req.body || {};

    if (body.message !== undefined && body.message !== null && !body.message.includes('{user}')) {
        return res.status(400).json({ error: 'message must contain a {user} placeholder' });
    }

    const [config] = await BirthdayConfig.findOrCreate({ where: { guildId }, defaults: { guildId } });
    for (const field of CONFIG_FIELDS) if (body[field] !== undefined) config[field] = body[field];
    await config.save();

    res.json({ config: serializeConfig(config) });
});

router.delete('/entries/:id', async (req, res) => {
    const { guildId, id } = req.params;
    const deleted = await Birthday.destroy({ where: { id, guildId } });
    if (!deleted) return res.status(404).json({ error: 'birthday entry not found' });
    res.json({ ok: true });
});

module.exports = router;
