'use strict';

const express = require('express');
const { Giveaway, GiveawayEntry } = require('../lib/models');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const giveaways = await Giveaway.findAll({ where: { guildId }, order: [['createdAt', 'DESC']], limit: 100 });
    const withCounts = await Promise.all(giveaways.map(async (g) => ({
        ...g.get({ plain: true }),
        entryCount: await GiveawayEntry.count({ where: { giveawayId: g.id } })
    })));
    res.json(withCounts);
});

router.delete('/:giveawayId', async (req, res) => {
    const { guildId, giveawayId } = req.params;
    const giveaway = await Giveaway.findOne({ where: { id: giveawayId, guildId } });
    if (!giveaway) return res.status(404).json({ error: 'giveaway not found' });
    await GiveawayEntry.destroy({ where: { giveawayId: giveaway.id } });
    await giveaway.destroy();
    res.json({ ok: true });
});

module.exports = router;
