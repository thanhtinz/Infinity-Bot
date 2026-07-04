'use strict';

const express = require('express');
const { TicketConfig, TicketCategory, Ticket } = require('../lib/models');

const router = express.Router({ mergeParams: true });

const CONFIG_FIELDS = [
    'setupType', 'panelChannelId', 'supportRoleId', 'defaultCategoryId', 'logChannelId',
    'panelTitle', 'panelDescription', 'panelImage', 'panelThumbnail'
];

function serializeTicketConfig(row) {
    if (!row) return null;
    const plain = row.get({ plain: true });
    let additionalRoleIds = [];
    try { additionalRoleIds = JSON.parse(plain.additionalRoleIds || '[]'); } catch { additionalRoleIds = []; }
    return { ...plain, additionalRoleIds };
}

router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const [config, categories, tickets] = await Promise.all([
        TicketConfig.findOne({ where: { guildId } }),
        TicketCategory.findAll({ where: { guildId }, order: [['categoryName', 'ASC']] }),
        Ticket.findAll({ where: { guildId }, order: [['createdAt', 'DESC']], limit: 100 })
    ]);
    res.json({ config: serializeTicketConfig(config), categories, tickets });
});

router.put('/config', async (req, res) => {
    const { guildId } = req.params;
    const body = req.body || {};

    if (body.setupType !== undefined && !['single', 'multi'].includes(body.setupType)) {
        return res.status(400).json({ error: 'setupType must be single or multi' });
    }

    const existing = await TicketConfig.findOne({ where: { guildId } });
    if (!existing) {
        const required = ['panelChannelId', 'supportRoleId', 'defaultCategoryId', 'logChannelId'];
        const missing = required.filter((field) => !body[field]);
        if (missing.length) {
            return res.status(400).json({ error: `${missing.join(', ')} required to set up tickets` });
        }
    }

    const config = existing || TicketConfig.build({ guildId });
    for (const field of CONFIG_FIELDS) {
        if (body[field] === undefined) continue;
        config[field] = body[field];
    }
    if (Array.isArray(body.additionalRoleIds)) {
        config.additionalRoleIds = JSON.stringify(body.additionalRoleIds);
    }
    await config.save();
    res.json({ config: serializeTicketConfig(config) });
});

router.post('/categories', async (req, res) => {
    const { guildId } = req.params;
    const { categoryName, categoryId, emoji, description } = req.body || {};
    if (!categoryName) return res.status(400).json({ error: 'categoryName is required' });

    const category = await TicketCategory.create({
        guildId, categoryName, categoryId: categoryId || null, emoji: emoji || null, description: description || null
    });
    res.status(201).json(category);
});

router.put('/categories/:categoryId', async (req, res) => {
    const { guildId, categoryId } = req.params;
    const category = await TicketCategory.findOne({ where: { id: categoryId, guildId } });
    if (!category) return res.status(404).json({ error: 'category not found' });

    for (const field of ['categoryName', 'categoryId', 'emoji', 'description']) {
        if (req.body?.[field] !== undefined) category[field] = req.body[field];
    }
    await category.save();
    res.json(category);
});

router.delete('/categories/:categoryId', async (req, res) => {
    const { guildId, categoryId } = req.params;
    const deleted = await TicketCategory.destroy({ where: { id: categoryId, guildId } });
    if (!deleted) return res.status(404).json({ error: 'category not found' });
    res.json({ ok: true });
});

module.exports = router;
