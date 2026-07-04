'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });

// GET /api/guilds/:guildId/meta - live channel/role data used to populate pickers in every
// config form, sourced from the bot status API (already fetched by ensureGuildAccess).
router.get('/', (req, res) => {
    const guild = req.botGuild;
    res.json({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        memberCount: guild.memberCount,
        channels: guild.channels || [],
        roles: guild.roles || []
    });
});

module.exports = router;
