'use strict';

/**
 * Lightweight, secret-protected, server-to-server status API for the Infinity Bot web dashboard.
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
const { VerificationConfig, BotRuntimeConfig, ShopOrder, ShopProduct, ShopCoupon } = require('../database/models');
const { postVerificationPanel } = require('./utils/verificationPanel');
const { fulfillOrderRewards } = require('./utils/shopUtils');

// Best-effort persistence of the "should the bot be running" intent, so that a Stop from the
// owner admin panel survives a process restart (the bot won't silently come back online on its
// own) and a Start/Restart clears that flag again. Never throws - this is a courtesy write, not a
// blocker for the actual login/logout action.
async function setEnabledFlag(enabled) {
    try {
        const [row] = await BotRuntimeConfig.findOrCreate({ where: { id: 1 }, defaults: { id: 1 } });
        row.enabled = enabled;
        await row.save();
    } catch (_) {
        // ignore - the in-memory client state is still authoritative for this process's lifetime
    }
}

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

// After calling client.login(), discord.js resolves the promise once the token is validated, but
// the `clientReady` event (guilds cached, presence usable) can fire a moment later. The owner
// admin panel's start/restart control actions wait briefly for that so they report an accurate
// online state instead of racing it.
function waitForReady(client, timeoutMs = 15000) {
    if (client.isReady()) return Promise.resolve(true);
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(client.isReady()), timeoutMs);
        client.once('clientReady', () => {
            clearTimeout(timer);
            resolve(true);
        });
    });
}

function serializeClientUser(client) {
    if (!client.isReady() || !client.user) return null;
    return {
        id: client.user.id,
        username: client.user.username,
        avatar: client.user.avatarURL ? client.user.avatarURL({ size: 256 }) : null
    };
}

async function applyPresence(client, statusText) {
    if (!client.isReady() || !client.user) return;
    try {
        client.user.setPresence({
            status: 'idle',
            activities: statusText ? [{ name: statusText, type: 2 /* ActivityType.Listening */ }] : []
        });
    } catch (_) {
        // presence is best-effort - never fail a control action because of it
    }
}

/**
 * @param {import('discord.js').Client} client
 * @param {{ secret?: string, resolveRuntimeConfig?: () => Promise<object> }} [options]
 *   resolveRuntimeConfig is the function from src/bot/index.js that reads BotRuntimeConfig (falling
 *   back to env vars) - passed in here so /control/restart and /control/start can pick up a token
 *   or prefix change the owner just saved in the admin panel without touching this module's own
 *   database imports.
 */
function createDashboardApi(client, { secret, resolveRuntimeConfig } = {}) {
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

    // Posts (or re-posts) the verify-button panel for a guild, mirroring `/verification panel`.
    // The dashboard only ever writes to VerificationConfig via its own DB access; this is the one
    // action that needs the live bot connection, since posting a message requires the gateway.
    app.post('/guilds/:id/verification/panel', async (req, res) => {
        if (!client.isReady()) return res.status(503).json({ error: 'bot is not ready yet' });

        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'bot is not in this guild' });

        try {
            const config = await VerificationConfig.findOne({ where: { guildId: guild.id } });
            if (!config || !config.enabled || !config.channelId) {
                return res.status(400).json({ error: 'verification is not configured for this server yet' });
            }

            const panelMsg = await postVerificationPanel(config, guild);
            if (!panelMsg) {
                return res.status(400).json({ error: 'the configured verification channel no longer exists' });
            }

            res.json({ ok: true, panelMessageId: panelMsg.id });
        } catch (error) {
            res.status(500).json({ error: error.message || 'failed to post the verification panel' });
        }
    });

    // ---- Owner Admin Panel control endpoints -----------------------------------------------
    // These let owner-admin/server proxy start/stop/restart actions and guild management, all
    // behind the same shared-secret gate above. No process exit is involved for any of these -
    // the discord.js client is destroyed and/or logged back in, in-process.

    app.get('/control/status', (req, res) => {
        const online = client.isReady();
        res.json({
            online,
            uptimeMs: online ? client.uptime : 0,
            guildCount: online ? client.guilds.cache.size : 0,
            ping: online ? client.ws.ping : null,
            user: serializeClientUser(client)
        });
    });

    app.post('/control/restart', async (req, res) => {
        try {
            if (client.isReady()) {
                await client.destroy();
            }

            const runtime = resolveRuntimeConfig ? await resolveRuntimeConfig() : null;
            const token = runtime?.token || process.env.BOT_TOKEN;
            if (!token) return res.status(400).json({ error: 'no bot token configured' });
            if (runtime) client.runtimeConfig = runtime;

            await client.login(token);
            const online = await waitForReady(client);
            if (online) await applyPresence(client, runtime?.statusText);
            await setEnabledFlag(true);

            res.json({ ok: true, online });
        } catch (error) {
            res.status(500).json({ error: error.message || 'failed to restart the bot' });
        }
    });

    app.post('/control/stop', async (req, res) => {
        try {
            if (client.isReady()) await client.destroy();
            await setEnabledFlag(false);
            res.json({ ok: true, online: client.isReady() });
        } catch (error) {
            res.status(500).json({ error: error.message || 'failed to stop the bot' });
        }
    });

    app.post('/control/start', async (req, res) => {
        try {
            if (client.isReady()) return res.json({ ok: true, online: true });

            const runtime = resolveRuntimeConfig ? await resolveRuntimeConfig() : null;
            const token = runtime?.token || process.env.BOT_TOKEN;
            if (!token) return res.status(400).json({ error: 'no bot token configured' });
            if (runtime) client.runtimeConfig = runtime;

            await client.login(token);
            const online = await waitForReady(client);
            if (online) await applyPresence(client, runtime?.statusText);
            await setEnabledFlag(true);

            res.json({ ok: true, online });
        } catch (error) {
            res.status(500).json({ error: error.message || 'failed to start the bot' });
        }
    });

    // Called by dashboard/server (dashboard/server/lib/botApi.js's fulfillOrder) once a PayOS
    // webhook, a PayPal return-capture, or a dashboard admin's manual crypto confirmation has
    // marked a ShopOrder 'paid' in the DB. This endpoint does the part that needs the live gateway
    // connection: granting the product's Discord role and recording a PremiumSubscription.
    app.post('/shop/fulfill-order', async (req, res) => {
        const { orderId } = req.body || {};
        if (!orderId) return res.status(400).json({ error: 'orderId is required' });

        try {
            const order = await ShopOrder.findByPk(orderId);
            if (!order) return res.status(404).json({ error: 'order not found' });

            const product = await ShopProduct.findByPk(order.productId);
            if (product) {
                const guild = client.isReady() ? client.guilds.cache.get(order.guildId) : null;
                await fulfillOrderRewards(guild, order, product);

                if (product.stock != null) {
                    product.stock = Math.max(0, product.stock - (order.quantity || 1));
                    await product.save();
                }
            }

            if (order.couponCode) {
                await ShopCoupon.increment('usesCount', { where: { guildId: order.guildId, code: order.couponCode } });
            }

            res.json({ ok: true });
        } catch (error) {
            res.status(500).json({ error: error.message || 'failed to fulfill order' });
        }
    });

    app.delete('/guilds/:id', async (req, res) => {
        if (!client.isReady()) return res.status(503).json({ error: 'bot is not ready yet' });

        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'bot is not in this guild' });

        try {
            await guild.leave();
            res.json({ ok: true });
        } catch (error) {
            res.status(500).json({ error: error.message || 'failed to leave the guild' });
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
