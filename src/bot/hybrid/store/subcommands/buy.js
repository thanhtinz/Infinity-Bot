
const { Op } = require('sequelize');
const { tg } = require('../../../utils/i18n');
const { reply, getOrCreateBalance, formatAmount, resolveUserId, isSlashCtx } = require('../../../utils/economyUtils');

module.exports = {
    async execute(interactionOrMessage, args, config) {
        const guild = interactionOrMessage.guild;
        const guildId = guild.id;
        const isSlash = isSlashCtx(interactionOrMessage);
        const { EconomyItem, EconomyInventory } = require('../../../../database/models');

        const itemName = isSlash ? interactionOrMessage.options.getString('item') : args.join(' ');
        if (!itemName) return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.store.itemNotFound'), true);

        const item = await EconomyItem.findOne({ where: { guildId, active: true, name: { [Op.iLike]: itemName } } });
        if (!item) return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.store.itemNotFound'), true);
        if (item.stock != null && item.stock <= 0) return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.store.outOfStock'), true);

        const userId = resolveUserId(interactionOrMessage);
        const balance = await getOrCreateBalance(guildId, userId, config);
        if (balance.wallet < item.price) {
            return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.common.insufficientFunds'), true);
        }

        balance.wallet -= item.price;
        await balance.save();

        if (item.stock != null) {
            item.stock = Math.max(0, item.stock - 1);
            await item.save();
        }

        let expiresAt = null;
        if (item.roleId && item.roleDurationSeconds) {
            expiresAt = new Date(Date.now() + item.roleDurationSeconds * 1000);
        }

        if (item.roleId) {
            // Role-granting items always get their own inventory row so each purchase's expiry is
            // tracked independently by the background sweep (utils/economyExpiry.js).
            await EconomyInventory.create({ guildId, userId, itemId: item.id, quantity: 1, expiresAt, roleRevoked: false });
            try {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member && !member.roles.cache.has(item.roleId)) {
                    await member.roles.add(item.roleId, 'Infinity Economy store purchase').catch(() => {});
                }
            } catch {
                // best-effort - the purchase still succeeds even if the role grant fails (missing perms).
            }
        } else {
            const [row] = await EconomyInventory.findOrCreate({
                where: { guildId, userId, itemId: item.id },
                defaults: { guildId, userId, itemId: item.id, quantity: 0 }
            });
            row.quantity += 1;
            await row.save();
        }

        return reply(interactionOrMessage, await tg(guildId, 'economy.store.buyTitle'), await tg(guildId, 'economy.store.buySuccess', {
            item: item.name,
            price: formatAmount(config, item.price)
        }));
    }
};
