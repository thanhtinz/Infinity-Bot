'use strict';

const botApi = require('../lib/botApi');
const { hasManageGuildPermission } = require('../lib/permissions');

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated && req.isAuthenticated() && req.user) return next();
    return res.status(401).json({ error: 'not logged in' });
}

/**
 * Security-critical gate for every /api/guilds/:guildId/* route. A dashboard instance serves
 * every server the bot is in, so we must independently verify (not just trust the OAuth-session
 * snapshot) that the logged-in user still has manage-guild access to *this specific* guild before
 * any read or write happens - by asking the bot (which has live member/role data) rather than
 * relying solely on the permission bitfield Discord handed us at login time.
 */
async function ensureGuildAccess(req, res, next) {
    const guildId = req.params.guildId;
    if (!guildId) return res.status(400).json({ error: 'guild id is required' });

    const sessionGuild = (req.user.guilds || []).find((g) => g.id === guildId);
    if (!sessionGuild) {
        return res.status(403).json({ error: 'you do not manage this server' });
    }
    if (!sessionGuild.owner && !hasManageGuildPermission(sessionGuild.permissions)) {
        return res.status(403).json({ error: 'you do not have manage-server permission here' });
    }

    let botGuild;
    let member;
    try {
        botGuild = await botApi.getGuild(guildId);
        if (!botGuild) return res.status(404).json({ error: 'Infinity Bot is not in this server' });

        member = await botApi.getMember(guildId, req.user.id);
    } catch (error) {
        return res.status(502).json({ error: 'could not reach the bot status API' });
    }

    if (!member || !member.inGuild) {
        return res.status(403).json({ error: 'you are not currently a member of this server' });
    }
    if (!member.isOwner && !hasManageGuildPermission(member.permissions)) {
        return res.status(403).json({ error: 'your live server permissions no longer allow dashboard access' });
    }

    req.botGuild = botGuild;
    req.botMember = member;
    next();
}

module.exports = { ensureAuthenticated, ensureGuildAccess };
