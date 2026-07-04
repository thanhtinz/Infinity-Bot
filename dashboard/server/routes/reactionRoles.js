'use strict';

const express = require('express');
const { ReactionRoles } = require('../lib/models');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const rows = await ReactionRoles.findAll({ where: { guildId }, order: [['createdAt', 'DESC']] });
    res.json(rows);
});

router.put('/:entryId', async (req, res) => {
    const { guildId, entryId } = req.params;
    const row = await ReactionRoles.findOne({ where: { id: entryId, guildId } });
    if (!row) return res.status(404).json({ error: 'reaction role message not found' });

    for (const field of ['embedTitle', 'embedDescription', 'embedColor', 'embedThumbnailUrl', 'emojiRolePairs', 'enabled']) {
        if (req.body?.[field] !== undefined) row[field] = req.body[field];
    }
    await row.save();
    res.json(row);
});

router.delete('/:entryId', async (req, res) => {
    const { guildId, entryId } = req.params;
    const deleted = await ReactionRoles.destroy({ where: { id: entryId, guildId } });
    if (!deleted) return res.status(404).json({ error: 'reaction role message not found' });
    res.json({ ok: true });
});

module.exports = router;
