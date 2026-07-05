
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { Op } = require('sequelize');
const { ShopCategory } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');

function reply(ctx, text) {
    const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
}

function hasPermission(interactionOrMessage) {
    const member = interactionOrMessage.member;
    return member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}

module.exports = {
    async execute(interactionOrMessage, args) {
        const guild = interactionOrMessage.guild;
        if (!guild) return interactionOrMessage.reply({ content: await tg(null, 'shop.common.guildOnly'), ephemeral: true });
        const guildId = guild.id;
        const isSlash = interactionOrMessage.isChatInputCommand?.();

        if (!hasPermission(interactionOrMessage)) return reply(interactionOrMessage, await tg(guildId, 'shop.common.noPermission'));

        const action = isSlash ? interactionOrMessage.options.getSubcommand() : (args[0] || '').toLowerCase();

        if (action === 'add') {
            if (!isSlash) return reply(interactionOrMessage, 'Please use the slash command `/shop category add` for this action.');
            const name = interactionOrMessage.options.getString('name');
            const description = interactionOrMessage.options.getString('description') || null;
            const position = interactionOrMessage.options.getInteger('position') ?? 0;
            const category = await ShopCategory.create({ guildId, name, description, position });
            return reply(interactionOrMessage, await tg(guildId, 'shop.category.added', { name: category.name }));
        }

        if (action === 'remove') {
            const name = isSlash ? interactionOrMessage.options.getString('name') : args.slice(1).join(' ');
            const category = await ShopCategory.findOne({ where: { guildId, name: { [Op.iLike]: name } } });
            if (!category) return reply(interactionOrMessage, await tg(guildId, 'shop.category.notFound'));
            await category.destroy();
            return reply(interactionOrMessage, await tg(guildId, 'shop.category.removed', { name: category.name }));
        }

        if (action === 'list') {
            const categories = await ShopCategory.findAll({ where: { guildId }, order: [['position', 'ASC']] });
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'shop.category.listTitle')}`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

            if (categories.length === 0) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.category.listEmpty')));
            } else {
                for (const c of categories) {
                    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.category.listRow', {
                        name: c.name, position: c.position, description: c.description ? ` - ${c.description}` : ''
                    })));
                }
            }
            return interactionOrMessage.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }

        return reply(interactionOrMessage, 'Usage: `/shop category add|remove|list`');
    }
};
