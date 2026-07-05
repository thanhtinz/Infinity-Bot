
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { ShopOrder, ShopProduct } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');

function formatDate(d) {
    return new Date(d).toISOString().slice(0, 16).replace('T', ' ');
}

function formatMoney(order) {
    if (order.currency === 'vnd') return `${Math.round(Number(order.total)).toLocaleString('vi-VN')}₫`;
    return `$${Number(order.total).toFixed(2)}`;
}

module.exports = {
    async execute(interactionOrMessage) {
        const guild = interactionOrMessage.guild;
        if (!guild) return interactionOrMessage.reply({ content: await tg(null, 'shop.common.guildOnly'), ephemeral: true });
        const guildId = guild.id;
        const userId = interactionOrMessage.user?.id || interactionOrMessage.author?.id;

        const orders = await ShopOrder.findAll({ where: { guildId, userId }, order: [['createdAt', 'DESC']], limit: 15, include: [{ model: ShopProduct, as: 'product' }] });

        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'shop.orders.title')}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

        if (orders.length === 0) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.orders.empty')));
        } else {
            for (const order of orders) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.orders.row', {
                    id: order.id,
                    product: order.product?.name || `#${order.productId}`,
                    total: formatMoney(order),
                    status: order.status,
                    date: formatDate(order.createdAt)
                })));
            }
        }

        return interactionOrMessage.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
    }
};
