'use strict';

const express = require('express');
const { EconomyConfig, EconomyGameSettings, EconomyItem } = require('../lib/models');

const router = express.Router({ mergeParams: true });

const CONFIG_FIELDS = ['currencyName', 'currencySymbol', 'startingBalance', 'dailyAmount', 'dailyStreakBonus', 'robSuccessRate', 'robMaxPercent', 'robCooldownMinutes'];
const GAMES = ['blackjack', 'slot', 'coinflip', 'daily', 'rob', 'marry'];

// GET / - the whole page's data in one call: unlock status + currency config + per-game settings +
// store items. `enabled` can ONLY be flipped true by a real-money Shop purchase (see
// shopUtils.unlockEconomy, called from src/bot/dashboardApi.js's /shop/fulfill-order) - this route
// never sets it, so the premium gate can't be bypassed from the dashboard.
router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const config = await EconomyConfig.findOne({ where: { guildId } });

    if (!config || !config.enabled) {
        return res.json({ enabled: false, config: null, games: [], items: [] });
    }

    const [games, items] = await Promise.all([
        EconomyGameSettings.findAll({ where: { guildId }, order: [['game', 'ASC']] }),
        EconomyItem.findAll({ where: { guildId }, order: [['name', 'ASC']] })
    ]);

    res.json({ enabled: true, config, games, items });
});

router.put('/config', async (req, res) => {
    const { guildId } = req.params;
    const config = await EconomyConfig.findOne({ where: { guildId } });
    if (!config || !config.enabled) return res.status(403).json({ error: 'economy is not unlocked for this server yet' });

    for (const field of CONFIG_FIELDS) {
        if (req.body?.[field] !== undefined) config[field] = req.body[field];
    }
    await config.save();
    res.json(config);
});

router.put('/games/:game', async (req, res) => {
    const { guildId, game } = req.params;
    if (!GAMES.includes(game)) return res.status(400).json({ error: 'unknown game' });

    const config = await EconomyConfig.findOne({ where: { guildId } });
    if (!config || !config.enabled) return res.status(403).json({ error: 'economy is not unlocked for this server yet' });

    const [settings] = await EconomyGameSettings.findOrCreate({ where: { guildId, game }, defaults: { guildId, game, enabled: true } });
    for (const field of ['enabled', 'minBet', 'maxBet']) {
        if (req.body?.[field] !== undefined) settings[field] = req.body[field];
    }
    await settings.save();
    res.json(settings);
});

// ---- Store items -----------------------------------------------------------------------------

router.post('/items', async (req, res) => {
    const { guildId } = req.params;
    const config = await EconomyConfig.findOne({ where: { guildId } });
    if (!config || !config.enabled) return res.status(403).json({ error: 'economy is not unlocked for this server yet' });

    const { name, description, price, roleId, roleDurationSeconds, stock, active } = req.body || {};
    if (!name || price === undefined) return res.status(400).json({ error: 'name and price are required' });

    const item = await EconomyItem.create({
        guildId, name, description: description || null, price,
        roleId: roleId || null, roleDurationSeconds: roleDurationSeconds ?? null,
        stock: stock ?? null, active: active !== false
    });
    res.status(201).json(item);
});

router.put('/items/:id', async (req, res) => {
    const { guildId, id } = req.params;
    const item = await EconomyItem.findOne({ where: { id, guildId } });
    if (!item) return res.status(404).json({ error: 'item not found' });
    for (const field of ['name', 'description', 'price', 'roleId', 'roleDurationSeconds', 'stock', 'active']) {
        if (req.body?.[field] !== undefined) item[field] = req.body[field];
    }
    await item.save();
    res.json(item);
});

router.delete('/items/:id', async (req, res) => {
    const { guildId, id } = req.params;
    const deleted = await EconomyItem.destroy({ where: { id, guildId } });
    if (!deleted) return res.status(404).json({ error: 'item not found' });
    res.json({ ok: true });
});

module.exports = router;
