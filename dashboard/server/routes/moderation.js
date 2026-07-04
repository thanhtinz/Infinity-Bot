'use strict';

const express = require('express');
const { ModLog, WarnPunishConfig } = require('../lib/models');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
    const { guildId } = req.params;
    const [cases, punishConfig] = await Promise.all([
        ModLog.findAll({ where: { guildId }, order: [['createdAt', 'DESC']], limit: 200 }),
        WarnPunishConfig.findAll({ where: { guildId }, order: [['warnCount', 'ASC']] })
    ]);
    res.json({ cases, punishConfig });
});

router.put('/punish-config', async (req, res) => {
    const { guildId } = req.params;
    const rules = Array.isArray(req.body?.rules) ? req.body.rules : [];

    for (const rule of rules) {
        if (!Number.isInteger(rule.warnCount) || rule.warnCount < 1) {
            return res.status(400).json({ error: 'warnCount must be a positive integer' });
        }
        if (!['mute', 'kick', 'ban'].includes(rule.action)) {
            return res.status(400).json({ error: 'action must be mute, kick, or ban' });
        }
    }

    await WarnPunishConfig.destroy({ where: { guildId } });
    if (rules.length) {
        await WarnPunishConfig.bulkCreate(rules.map((rule) => ({
            guildId,
            warnCount: rule.warnCount,
            action: rule.action,
            duration: rule.action === 'mute' ? (rule.duration || null) : null
        })));
    }

    const punishConfig = await WarnPunishConfig.findAll({ where: { guildId }, order: [['warnCount', 'ASC']] });
    res.json({ punishConfig });
});

router.delete('/cases/:caseId', async (req, res) => {
    const { guildId, caseId } = req.params;
    const deleted = await ModLog.destroy({ where: { id: caseId, guildId } });
    if (!deleted) return res.status(404).json({ error: 'case not found' });
    res.json({ ok: true });
});

module.exports = router;
