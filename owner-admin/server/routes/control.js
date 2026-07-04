'use strict';

const express = require('express');
const botApi = require('../lib/botApi');

const router = express.Router();

router.get('/status', async (req, res) => {
    try {
        const status = await botApi.getStatus();
        res.json(status || { online: false, uptimeMs: 0, guildCount: 0, ping: null, user: null });
    } catch (error) {
        res.status(502).json({ error: error.message || 'could not reach the bot control API' });
    }
});

router.post('/control/restart', async (req, res) => {
    try {
        const result = await botApi.restart();
        res.json(result || { ok: true });
    } catch (error) {
        res.status(502).json({ error: error.message || 'failed to restart the bot' });
    }
});

router.post('/control/stop', async (req, res) => {
    try {
        const result = await botApi.stop();
        res.json(result || { ok: true });
    } catch (error) {
        res.status(502).json({ error: error.message || 'failed to stop the bot' });
    }
});

router.post('/control/start', async (req, res) => {
    try {
        const result = await botApi.start();
        res.json(result || { ok: true });
    } catch (error) {
        res.status(502).json({ error: error.message || 'failed to start the bot' });
    }
});

router.get('/guilds', async (req, res) => {
    try {
        const guilds = await botApi.getGuilds();
        res.json(guilds);
    } catch (error) {
        res.status(502).json({ error: error.message || 'could not reach the bot control API' });
    }
});

router.delete('/guilds/:id', async (req, res) => {
    try {
        const result = await botApi.leaveGuild(req.params.id);
        res.json(result || { ok: true });
    } catch (error) {
        res.status(502).json({ error: error.message || 'failed to leave the guild' });
    }
});

module.exports = router;
