
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { Op } = require('sequelize');
const { ShopFlashSale, ShopProduct } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');

function reply(ctx, text) {
    const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
}

function hasPermission(interactionOrMessage) {
    return interactionOrMessage.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}

function formatDate(d) {
    return new Date(d).toISOString().slice(0, 16).replace('T', ' ');
}

function saleStatus(sale) {
    if (!sale.active) return 'inactive';
    const now = Date.now();
    if (now < new Date(sale.startsAt).getTime()) return 'upcoming';
    if (now > new Date(sale.endsAt).getTime()) return 'ended';
    return 'live';
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
            if (!isSlash) return reply(interactionOrMessage, 'Please use the slash command `/shop flashsale add` for this action.');
            const opts = interactionOrMessage.options;
            const productName = opts.getString('product');
            const product = await ShopProduct.findOne({ where: { guildId, name: { [Op.iLike]: productName } } });
            if (!product) return reply(interactionOrMessage, await tg(guildId, 'shop.product.notFound'));

            const durationHours = opts.getInteger('duration_hours');
            const startsAt = new Date();
            const endsAt = new Date(Date.now() + durationHours * 3_600_000);
            const sale = await ShopFlashSale.create({
                guildId, productId: product.id,
                discountPercent: opts.getNumber('discount_percent'),
                startsAt, endsAt, active: true
            });
            return reply(interactionOrMessage, await tg(guildId, 'shop.flashsale.added', { product: product.name, percent: sale.discountPercent, ends: formatDate(endsAt) }));
        }

        if (action === 'remove') {
            const id = isSlash ? interactionOrMessage.options.getInteger('id') : parseInt(args[1], 10);
            const sale = await ShopFlashSale.findOne({ where: { id, guildId } });
            if (!sale) return reply(interactionOrMessage, await tg(guildId, 'shop.flashsale.notFound'));
            await sale.destroy();
            return reply(interactionOrMessage, await tg(guildId, 'shop.flashsale.removed', { id }));
        }

        if (action === 'list') {
            const sales = await ShopFlashSale.findAll({ where: { guildId }, order: [['createdAt', 'DESC']], include: [{ model: ShopProduct, as: 'product' }] });
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'shop.flashsale.listTitle')}`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

            if (sales.length === 0) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.flashsale.listEmpty')));
            } else {
                for (const s of sales) {
                    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.flashsale.listRow', {
                        id: s.id, product: s.product?.name || `#${s.productId}`, percent: Number(s.discountPercent),
                        starts: formatDate(s.startsAt), ends: formatDate(s.endsAt), status: saleStatus(s)
                    })));
                }
            }
            return interactionOrMessage.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }

        return reply(interactionOrMessage, 'Usage: `/shop flashsale add|remove|list`');
    }
};
