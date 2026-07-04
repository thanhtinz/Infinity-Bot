'use strict';

const express = require('express');
const config = require('../config');
const botApi = require('../lib/botApi');
const { hasManageGuildPermission, guildIconUrl } = require('../lib/permissions');

const router = express.Router();

function buildInviteUrl(guildId) {
    const params = new URLSearchParams({
        client_id: config.discordClientId,
        scope: 'bot applications.commands',
        permissions: '8',
        guild_id: guildId,
        disable_guild_select: 'true'
    });
    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

// GET /api/guilds - servers the logged-in user manages (owner or Administrator/Manage Server),
// enriched with live bot presence/name/icon/member-count where the bot is also present.
router.get('/', async (req, res) => {
    const managed = (req.user.guilds || []).filter((g) => g.owner || hasManageGuildPermission(g.permissions));

    let botGuilds = [];
    try {
        botGuilds = await botApi.getGuilds();
    } catch {
        botGuilds = [];
    }
    const botGuildMap = new Map(botGuilds.map((g) => [g.id, g]));

    const guilds = managed
        .map((g) => {
            const botGuild = botGuildMap.get(g.id);
            return {
                id: g.id,
                name: botGuild?.name || g.name,
                icon: botGuild?.icon ?? guildIconUrl(g.id, g.icon),
                hasBot: Boolean(botGuild),
                memberCount: botGuild?.memberCount ?? null,
                inviteUrl: botGuild ? null : buildInviteUrl(g.id)
            };
        })
        .sort((a, b) => {
            if (a.hasBot !== b.hasBot) return a.hasBot ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

    res.json(guilds);
});

module.exports = router;
