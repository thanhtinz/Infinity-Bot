
const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags
} = require('discord.js');
const { ShopProduct, ShopCategory } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');
const { getEffectivePrice } = require('../../../utils/shopUtils');
const { startPurchaseFlow } = require('./buy');

function formatVnd(n) { return `${Math.round(Number(n)).toLocaleString('vi-VN')}`; }
function formatUsd(n) { return Number(n).toFixed(2); }

module.exports = {
    async execute(interactionOrMessage) {
        const guild = interactionOrMessage.guild;
        if (!guild) return interactionOrMessage.reply({ content: await tg(null, 'shop.common.guildOnly'), ephemeral: true });
        const guildId = guild.id;
        const userId = interactionOrMessage.user?.id || interactionOrMessage.author?.id;

        const products = await ShopProduct.findAll({ where: { guildId, active: true }, order: [['name', 'ASC']], limit: 25 });
        if (products.length === 0) {
            const empty = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.browse.empty')));
            return interactionOrMessage.reply({ components: [empty], flags: MessageFlags.IsComponentsV2 });
        }

        const categories = await ShopCategory.findAll({ where: { guildId }, order: [['position', 'ASC']] });
        const categoryById = new Map(categories.map((c) => [c.id, c]));

        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'shop.browse.title')}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

        const options = [];
        for (const product of products) {
            const priceInfo = await getEffectivePrice(product);
            const priceParts = [];
            if (priceInfo.priceVnd != null) priceParts.push(await tg(guildId, 'shop.browse.priceVnd', { amount: formatVnd(priceInfo.priceVnd) }));
            if (priceInfo.priceUsd != null) priceParts.push(await tg(guildId, 'shop.browse.priceUsd', { amount: formatUsd(priceInfo.priceUsd) }));
            const stockNote = product.stock != null && product.stock <= 0 ? ` (${await tg(guildId, 'shop.browse.outOfStock')})` : '';
            const saleNote = priceInfo.discountPercent > 0 ? ` 🔥-${priceInfo.discountPercent}%` : '';
            const categoryName = product.categoryId ? categoryById.get(product.categoryId)?.name : null;

            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `**${product.name}**${categoryName ? ` · ${categoryName}` : ''}\n${priceParts.join(' · ')}${saleNote}${stockNote}`
            ));

            options.push(new StringSelectMenuOptionBuilder()
                .setLabel(product.name.slice(0, 100))
                .setDescription((priceParts.join(' · ') || 'View details').slice(0, 100))
                .setValue(String(product.id)));
        }

        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.browse.footer')));

        const menu = new StringSelectMenuBuilder().setCustomId('shop_browse_select').setPlaceholder(await tg(guildId, 'shop.browse.placeholder')).addOptions(options);
        container.addActionRowComponents(new ActionRowBuilder().addComponents(menu));

        await interactionOrMessage.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        const sentMsg = await interactionOrMessage.fetchReply().catch(() => null);
        if (!sentMsg) return;

        const collector = sentMsg.createMessageComponentCollector({ filter: (i) => i.customId === 'shop_browse_select' && i.user.id === userId, time: 180000 });
        collector.on('collect', async (i) => {
            try {
                const product = await ShopProduct.findOne({ where: { id: i.values[0], guildId } });
                if (!product) return i.reply({ content: await tg(guildId, 'shop.buy.productNotFound'), ephemeral: true });
                await i.deferReply({ ephemeral: true });
                await startPurchaseFlow(i, guild, userId, product);
            } catch (error) {
                console.error('Shop browse selection error:', error);
            }
        });
    }
};
