'use strict';

/**
 * Periodically revokes Discord roles granted by timed `/store` purchases (EconomyItem.roleId +
 * roleDurationSeconds) once their EconomyInventory.expiresAt has passed. Mirrors the
 * setInterval-driven pattern used by utils/giveawayUtils.js's checkGiveaways, called the same way
 * from src/bot/index.js.
 */

const { Op } = require('sequelize');

async function checkEconomyRoleExpiry(client) {
    const { EconomyInventory, EconomyItem } = require('../../database/models');

    let expired;
    try {
        expired = await EconomyInventory.findAll({
            where: { roleRevoked: false, expiresAt: { [Op.ne]: null, [Op.lte]: new Date() } },
            include: [{ model: EconomyItem, as: 'item' }],
            limit: 100
        });
    } catch (error) {
        console.error('[Economy] Failed to query expired inventory rows:', error.message || error);
        return;
    }

    for (const row of expired) {
        try {
            const item = row.item;
            if (item?.roleId && client.isReady()) {
                const guild = client.guilds.cache.get(row.guildId);
                const member = guild ? await guild.members.fetch(row.userId).catch(() => null) : null;
                if (member && member.roles.cache.has(item.roleId)) {
                    await member.roles.remove(item.roleId, 'Infinity Economy timed item expired').catch(() => {});
                }
            }
            row.roleRevoked = true;
            await row.save();
        } catch (error) {
            console.error('[Economy] Failed to revoke expired role for inventory row', row.id, error.message || error);
        }
    }
}

module.exports = { checkEconomyRoleExpiry };
