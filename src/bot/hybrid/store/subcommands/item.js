
const { Op } = require('sequelize');
const { PermissionFlagsBits } = require('discord.js');
const { tg } = require('../../../utils/i18n');
const { reply, formatAmount, isSlashCtx } = require('../../../utils/economyUtils');

function hasPermission(ctx) {
    return ctx.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}

module.exports = {
    async execute(interactionOrMessage, args, config) {
        const guildId = interactionOrMessage.guild.id;
        const isSlash = isSlashCtx(interactionOrMessage);
        const { EconomyItem } = require('../../../../database/models');

        if (!hasPermission(interactionOrMessage)) {
            return reply(interactionOrMessage, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Manage Server' }), true);
        }

        const action = isSlash ? interactionOrMessage.options.getSubcommand() : (args[0] || '').toLowerCase();

        if (action === 'add') {
            if (!isSlash) return reply(interactionOrMessage, null, 'Please use the slash command `/store item add` for this action.', true);
            const opts = interactionOrMessage.options;
            const item = await EconomyItem.create({
                guildId,
                name: opts.getString('name'),
                description: opts.getString('description') || null,
                price: opts.getInteger('price'),
                roleId: opts.getRole('role')?.id || null,
                roleDurationSeconds: opts.getInteger('role_duration_seconds'),
                stock: opts.getInteger('stock'),
                active: true
            });
            return reply(interactionOrMessage, await tg(guildId, 'economy.store.item.addedTitle'), await tg(guildId, 'economy.store.item.added', { name: item.name }), true);
        }

        if (action === 'edit') {
            if (!isSlash) return reply(interactionOrMessage, null, 'Please use the slash command `/store item edit` for this action.', true);
            const opts = interactionOrMessage.options;
            const name = opts.getString('name');
            const item = await EconomyItem.findOne({ where: { guildId, name: { [Op.iLike]: name } } });
            if (!item) return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.store.itemNotFound'), true);

            const price = opts.getInteger('price');
            const stock = opts.getInteger('stock');
            const active = opts.getBoolean('active');
            if (price !== null) item.price = price;
            if (stock !== null) item.stock = stock;
            if (active !== null) item.active = active;
            await item.save();
            return reply(interactionOrMessage, await tg(guildId, 'economy.store.item.updatedTitle'), await tg(guildId, 'economy.store.item.updated', { name: item.name }), true);
        }

        if (action === 'remove') {
            const name = isSlash ? interactionOrMessage.options.getString('name') : args.slice(1).join(' ');
            const item = await EconomyItem.findOne({ where: { guildId, name: { [Op.iLike]: name } } });
            if (!item) return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.store.itemNotFound'), true);
            await item.destroy();
            return reply(interactionOrMessage, await tg(guildId, 'economy.store.item.removedTitle'), await tg(guildId, 'economy.store.item.removed', { name: item.name }), true);
        }

        if (action === 'list') {
            const items = await EconomyItem.findAll({ where: { guildId }, order: [['name', 'ASC']] });
            if (items.length === 0) {
                return reply(interactionOrMessage, await tg(guildId, 'economy.store.item.listTitle'), await tg(guildId, 'economy.store.item.listEmpty'), true);
            }
            const lines = items.map((i) => `**${i.name}** · ${formatAmount(config, i.price)} · ${i.active ? 'active' : 'inactive'} · stock: ${i.stock == null ? '∞' : i.stock}`);
            return reply(interactionOrMessage, await tg(guildId, 'economy.store.item.listTitle'), lines.join('\n'), true);
        }

        return reply(interactionOrMessage, null, 'Usage: `/store item add|edit|remove|list`', true);
    }
};
