'use strict';

const express = require('express');
const { StickyNickname } = require('../lib/models');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const rows = await StickyNickname.findAll({ where: { guildId }, order: [['createdAt', 'DESC']] });
    res.json(rows);
});

router.post('/', async (req, res) => {
    const { guildId } = req.params;
    const { userId, nickname } = req.body || {};

    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!nickname || !nickname.trim()) return res.status(400).json({ error: 'nickname is required' });

    const [row] = await StickyNickname.upsert({
        guildId,
        userId,
        nickname: nickname.trim(),
        setById: req.user.id
    }, { returning: true });

    res.status(201).json(row);
});

router.delete('/:id', async (req, res) => {
    const { guildId, id } = req.params;
    const deleted = await StickyNickname.destroy({ where: { id, guildId } });
    if (!deleted) return res.status(404).json({ error: 'sticky nickname not found' });
    res.json({ ok: true });
});

module.exports = router;
