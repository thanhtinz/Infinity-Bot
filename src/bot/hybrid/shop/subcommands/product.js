
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { Op } = require('sequelize');
const { ShopProduct, ShopCategory } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');

function reply(ctx, text) {
    const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
}

function hasPermission(interactionOrMessage) {
    return interactionOrMessage.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}

function formatPrice(product) {
    const parts = [];
    if (product.priceVnd != null) parts.push(`${Math.round(Number(product.priceVnd)).toLocaleString('vi-VN')}₫`);
    if (product.priceUsd != null) parts.push(`$${Number(product.priceUsd).toFixed(2)}`);
    return parts.join(' · ') || '—';
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
            if (!isSlash) return reply(interactionOrMessage, 'Please use the slash command `/shop product add` for this action.');
            const opts = interactionOrMessage.options;
            const name = opts.getString('name');
            const description = opts.getString('description') || null;
            const categoryName = opts.getString('category');
            let categoryId = null;
            if (categoryName) {
                const category = await ShopCategory.findOne({ where: { guildId, name: { [Op.iLike]: categoryName } } });
                categoryId = category ? category.id : null;
            }
            const product = await ShopProduct.create({
                guildId, categoryId, name, description,
                priceVnd: opts.getInteger('price_vnd'),
                priceUsd: opts.getNumber('price_usd'),
                roleId: opts.getRole('role')?.id || null,
                stock: opts.getInteger('stock'),
                imageUrl: opts.getString('image_url') || null,
                active: true
            });
            return reply(interactionOrMessage, await tg(guildId, 'shop.product.added', { name: product.name }));
        }

        if (action === 'edit') {
            if (!isSlash) return reply(interactionOrMessage, 'Please use the slash command `/shop product edit` for this action.');
            const opts = interactionOrMessage.options;
            const name = opts.getString('name');
            const product = await ShopProduct.findOne({ where: { guildId, name: { [Op.iLike]: name } } });
            if (!product) return reply(interactionOrMessage, await tg(guildId, 'shop.product.notFound'));

            const priceVnd = opts.getInteger('price_vnd');
            const priceUsd = opts.getNumber('price_usd');
            const stock = opts.getInteger('stock');
            const active = opts.getBoolean('active');
            if (priceVnd !== null) product.priceVnd = priceVnd;
            if (priceUsd !== null) product.priceUsd = priceUsd;
            if (stock !== null) product.stock = stock;
            if (active !== null) product.active = active;
            await product.save();
            return reply(interactionOrMessage, await tg(guildId, 'shop.product.updated', { name: product.name }));
        }

        if (action === 'remove') {
            const name = isSlash ? interactionOrMessage.options.getString('name') : args.slice(1).join(' ');
            const product = await ShopProduct.findOne({ where: { guildId, name: { [Op.iLike]: name } } });
            if (!product) return reply(interactionOrMessage, await tg(guildId, 'shop.product.notFound'));
            await product.destroy();
            return reply(interactionOrMessage, await tg(guildId, 'shop.product.removed', { name: product.name }));
        }

        if (action === 'list') {
            const products = await ShopProduct.findAll({ where: { guildId }, order: [['name', 'ASC']] });
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'shop.product.listTitle')}`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

            if (products.length === 0) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.product.listEmpty')));
            } else {
                for (const p of products) {
                    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.product.listRow', {
                        name: p.name, price: formatPrice(p), status: p.active ? 'active' : 'inactive', stock: p.stock == null ? '∞' : p.stock
                    })));
                }
            }
            return interactionOrMessage.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }

        return reply(interactionOrMessage, 'Usage: `/shop product add|edit|remove|list`');
    }
};
