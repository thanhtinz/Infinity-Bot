'use strict';

/**
 * Lightweight, secret-protected, server-to-server status API for the Main web dashboard.
 *
 * The dashboard's Express backend (dashboard/server) is a *separate* Node process from the bot
 * and never sees the bot token. Instead it calls this API (over plain HTTP on localhost, or a
 * private network) to answer questions like "which guilds is the bot in" and "what permissions
 * does this Discord user have in this guild". Every request must present the shared secret in the
 * `x-api-secret` header, checked against BOT_API_SECRET.
 *
 * This file is purely additive - it does not touch existing client/command/event wiring. It is
 * started from src/bot/index.js via `createDashboardApi(client).listen(...)`.
 */

const express = require('express');

const TEXT_LIKE_TYPES = new Set([0, 5, 15]); // GuildText, GuildAnnouncement, GuildForum

function serializeGuildSummary(guild) {
    return {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL ? guild.iconURL({ size: 256 }) : null,
        memberCount: guild.memberCount ?? null
    };
}

function serializeChannel(channel) {
    return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        parentId: channel.parentId ?? null,
        position: channel.rawPosition ?? channel.position ?? 0
    };
}

function serializeRole(role) {
    return {
        id: role.id,
        name: role.name,
        color: role.hexColor,
        position: role.position,
        permissions: role.permissions?.bitfield?.toString() ?? '0',
        managed: !!role.managed
    };
}

function createDashboardApi(client, { secret } = {}) {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.json());

    app.get('/health', (req, res) => {
        res.json({ ok: true, ready: client.isReady(), guildCount: client.isReady() ? client.guilds.cache.size : 0 });
    });

    // Everything below requires the shared secret.
    app.use((req, res, next) => {
        const configuredSecret = secret || process.env.BOT_API_SECRET;
        if (!configuredSecret) {
            return res.status(500).json({ error: 'BOT_API_SECRET is not configured on the bot process' });
        }
        if (req.headers['x-api-secret'] !== configuredSecret) {
            return res.status(401).json({ error: 'unauthorized' });
        }
        next();
    });

    app.get('/guilds', (req, res) => {
        if (!client.isReady()) return res.json([]);
        const guilds = client.guilds.cache.map(serializeGuildSummary);
        res.json(guilds);
    });

    app.get('/guilds/:id', async (req, res) => {
        if (!client.isReady()) return res.status(503).json({ error: 'bot is not ready yet' });

        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'bot is not in this guild' });

        try {
            const channels = [...guild.channels.cache.values()]
                .filter((c) => c.type !== 4 || true)
                .map(serializeChannel)
                .sort((a, b) => a.position - b.position);

            const roles = [...guild.roles.cache.values()]
                .map(serializeRole)
                .sort((a, b) => b.position - a.position);

            res.json({
                ...serializeGuildSummary(guild),
                ownerId: guild.ownerId,
                channels,
                textChannels: channels.filter((c) => TEXT_LIKE_TYPES.has(c.type)),
                voiceChannels: channels.filter((c) => c.type === 2),
                categories: channels.filter((c) => c.type === 4),
                roles
            });
        } catch (error) {
            res.status(500).json({ error: error.message || 'failed to read guild data' });
        }
    });

    app.get('/guilds/:id/member/:userId', async (req, res) => {
        if (!client.isReady()) return res.status(503).json({ error: 'bot is not ready yet' });

        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'bot is not in this guild', inGuild: false });

        try {
            let member = guild.members.cache.get(req.params.userId);
            if (!member) {
                member = await guild.members.fetch(req.params.userId).catch(() => null);
            }
            if (!member) return res.status(404).json({ error: 'member not found', inGuild: false });

            res.json({
                inGuild: true,
                isOwner: guild.ownerId === member.id,
                permissions: member.permissions?.bitfield?.toString() ?? '0',
                roles: [...member.roles.cache.keys()]
            });
        } catch (error) {
            res.status(500).json({ error: error.message || 'failed to read member data' });
        }
    });

    app.use((req, res) => res.status(404).json({ error: 'not found' }));

    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        console.error('[Dashboard Status API] Unhandled error:', err);
        if (res.headersSent) return;
        res.status(500).json({ error: 'internal error' });
    });

    return app;
}

module.exports = { createDashboardApi };
