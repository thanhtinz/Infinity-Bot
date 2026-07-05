
const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags
} = require('discord.js');
const { Op } = require('sequelize');
const { ShopProduct, ShopOrder, ShopCoupon } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');
const { getEffectivePrice, validateCoupon, computeCouponDiscount, CouponError } = require('../../../utils/shopUtils');
const payos = require('../../../utils/payments/payosClient');
const paypal = require('../../../utils/payments/paypalClient');
const cryptoClient = require('../../../utils/payments/cryptoClient');

function formatVnd(n) { return `${Math.round(Number(n)).toLocaleString('vi-VN')}`; }
function formatUsd(n) { return Number(n).toFixed(2); }

function simpleContainer(text) {
    return new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
}

async function send(ctx, container, ephemeral = true) {
    const opts = { components: [container], flags: MessageFlags.IsComponentsV2 };
    if (ctx.deferred || ctx.replied) return ctx.editReply(opts);
    return ctx.reply({ ...opts, ephemeral });
}

function publicBaseUrl() {
    return process.env.DASHBOARD_PUBLIC_URL || 'https://discord.com';
}

async function couponErrorMessage(guildId, err) {
    if (err instanceof CouponError) {
        const map = { not_found: 'shop.redeem.notFound', inactive: 'shop.redeem.inactive', expired: 'shop.redeem.expired', exhausted: 'shop.redeem.exhausted' };
        return tg(guildId, map[err.reasonCode] || 'shop.common.error');
    }
    return tg(guildId, 'shop.common.error');
}

async function findProductByName(guildId, name) {
    return ShopProduct.findOne({ where: { guildId, active: true, name: { [Op.iLike]: name } } });
}

/**
 * Runs the full pick-payment-method -> pay -> order-created flow for a single product. Exported so
 * browse.js's select-menu can reuse it after a user picks a product to view.
 */
async function startPurchaseFlow(ctx, guild, userId, product) {
    const guildId = guild.id;

    if (!product.active) return send(ctx, simpleContainer(await tg(guildId, 'shop.buy.productInactive')));
    if (product.stock != null && product.stock <= 0) return send(ctx, simpleContainer(await tg(guildId, 'shop.buy.outOfStock')));

    const priceInfo = await getEffectivePrice(product);
    const state = { coupon: null };

    const buildView = async () => {
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'shop.buy.choosePaymentTitle')}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

        const priceLines = [];
        if (priceInfo.priceVnd != null) priceLines.push(await tg(guildId, 'shop.browse.priceVnd', { amount: formatVnd(priceInfo.priceVnd) }));
        if (priceInfo.priceUsd != null) priceLines.push(await tg(guildId, 'shop.browse.priceUsd', { amount: formatUsd(priceInfo.priceUsd) }));
        if (priceInfo.discountPercent > 0) priceLines.push(await tg(guildId, 'shop.browse.onSale', { percent: priceInfo.discountPercent }));

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            await tg(guildId, 'shop.buy.choosePaymentBody', { name: product.name, description: product.description || '', price: priceLines.join(' · ') })
        ));

        if (state.coupon) {
            const discount = computeCouponDiscount(state.coupon, priceInfo.priceVnd ?? priceInfo.priceUsd ?? 0);
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.buy.couponApplied', { code: state.coupon.code, amount: discount })));
        }

        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

        const row = new ActionRowBuilder();
        if (priceInfo.priceVnd != null) row.addComponents(new ButtonBuilder().setCustomId('shop_pay_payos').setLabel(await tg(guildId, 'shop.buy.methodPayos')).setStyle(ButtonStyle.Primary));
        if (priceInfo.priceUsd != null) row.addComponents(new ButtonBuilder().setCustomId('shop_pay_paypal').setLabel(await tg(guildId, 'shop.buy.methodPaypal')).setStyle(ButtonStyle.Primary));
        if (priceInfo.priceUsd != null) row.addComponents(new ButtonBuilder().setCustomId('shop_pay_crypto').setLabel(await tg(guildId, 'shop.buy.methodCrypto')).setStyle(ButtonStyle.Secondary));
        container.addActionRowComponents(row);
        container.addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shop_apply_coupon').setLabel('Apply coupon').setEmoji('🏷️').setStyle(ButtonStyle.Secondary)
        ));

        return container;
    };

    await send(ctx, await buildView());
    const sentMsg = await ctx.fetchReply().catch(() => null);
    if (!sentMsg) return;

    const collector = sentMsg.createMessageComponentCollector({ filter: (i) => i.user.id === userId, time: 180000 });

    collector.on('collect', async (i) => {
        try {
            if (i.customId === 'shop_apply_coupon') {
                const modal = new ModalBuilder().setCustomId('shop_coupon_modal').setTitle('Apply Coupon');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('coupon_code').setLabel('Coupon code').setStyle(TextInputStyle.Short).setRequired(true)
                ));
                await i.showModal(modal);
                const m = await i.awaitModalSubmit({ time: 120000 }).catch(() => null);
                if (!m) return;
                const code = m.fields.getTextInputValue('coupon_code');
                try {
                    state.coupon = await validateCoupon(guildId, code);
                    await m.deferUpdate();
                    await sentMsg.edit({ components: [await buildView()], flags: MessageFlags.IsComponentsV2 });
                } catch (err) {
                    await m.reply({ content: await couponErrorMessage(guildId, err), ephemeral: true });
                }
                return;
            }

            if (i.customId === 'shop_pay_crypto') {
                const assets = await cryptoClient.listConfiguredAssets(await cryptoClient.resolveWallets());
                if (assets.length === 0) {
                    await i.reply({ content: await tg(guildId, 'shop.buy.cryptoNotConfigured'), ephemeral: true });
                    return;
                }
                const menu = new StringSelectMenuBuilder().setCustomId('shop_crypto_asset').setPlaceholder(await tg(guildId, 'shop.buy.selectAssetPlaceholder'))
                    .addOptions(assets.map((a) => new StringSelectMenuOptionBuilder().setLabel(a).setValue(a)));
                await i.reply({ components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
                return;
            }

            if (i.customId === 'shop_crypto_asset') {
                await i.deferUpdate();
                await finalizePurchase(i, guild, userId, product, priceInfo, state, 'crypto', i.values[0]);
                collector.stop();
                return;
            }

            if (i.customId === 'shop_pay_payos' || i.customId === 'shop_pay_paypal') {
                await i.deferUpdate();
                await finalizePurchase(i, guild, userId, product, priceInfo, state, i.customId.replace('shop_pay_', ''));
                collector.stop();
            }
        } catch (error) {
            console.error('Shop buy collector error:', error);
        }
    });
}

async function finalizePurchase(ctx, guild, userId, product, priceInfo, state, method, cryptoAsset) {
    const guildId = guild.id;

    if (method === 'payos' && priceInfo.priceVnd == null) return send(ctx, simpleContainer(await tg(guildId, 'shop.buy.noVndPrice')));
    if ((method === 'paypal' || method === 'crypto') && priceInfo.priceUsd == null) return send(ctx, simpleContainer(await tg(guildId, 'shop.buy.noUsdPrice')));

    const currency = method === 'payos' ? 'vnd' : (method === 'paypal' ? 'usd' : 'crypto');
    const subtotal = method === 'payos' ? priceInfo.priceVnd : priceInfo.priceUsd;
    const discount = state.coupon ? computeCouponDiscount(state.coupon, subtotal) : 0;
    const total = Math.max(subtotal - discount, 0);

    const order = await ShopOrder.create({
        guildId, userId, productId: product.id, quantity: 1,
        couponCode: state.coupon ? state.coupon.code : null,
        subtotal, discount, total, currency, paymentMethod: method, status: 'pending'
    });

    const returnUrl = `${publicBaseUrl()}/shop/return?orderId=${order.id}`;
    const cancelUrl = `${publicBaseUrl()}/shop/cancel?orderId=${order.id}`;

    try {
        if (method === 'payos') {
            const link = await payos.createPaymentLink({
                orderCode: order.id,
                amount: Math.round(total),
                description: `Order #${order.id}`,
                returnUrl, cancelUrl
            });
            order.paymentReference = String(link.orderCode);
            await order.save();

            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'shop.buy.payosCreatedTitle')}`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.buy.payosCreatedBody', { orderId: order.id, amount: formatVnd(total) })))
                .addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel(await tg(guildId, 'shop.buy.openCheckout')).setStyle(ButtonStyle.Link).setURL(link.checkoutUrl)
                ));
            return send(ctx, container);
        }

        if (method === 'paypal') {
            const created = await paypal.createOrder({
                amountUsd: formatUsd(total),
                referenceId: order.id,
                description: `Order #${order.id}`,
                returnUrl, cancelUrl
            });
            order.paymentReference = created.orderId;
            await order.save();

            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'shop.buy.paypalCreatedTitle')}`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.buy.paypalCreatedBody', { orderId: order.id, amount: formatUsd(total) })))
                .addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel(await tg(guildId, 'shop.buy.approveOnPaypal')).setStyle(ButtonStyle.Link).setURL(created.approveUrl || 'https://paypal.com')
                ));
            return send(ctx, container);
        }

        // crypto
        const instructions = await cryptoClient.buildDepositInstructions({ orderId: order.id, asset: cryptoAsset, amountUsd: formatUsd(total) });
        order.paymentReference = instructions.reference;
        await order.save();

        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'shop.buy.cryptoCreatedTitle')}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.buy.cryptoCreatedBody', {
                orderId: order.id, asset: instructions.asset, amount: instructions.amountUsd, address: instructions.address, reference: instructions.reference
            })));
        return send(ctx, container);
    } catch (error) {
        console.error('Shop payment creation error:', error);
        order.status = 'failed';
        await order.save().catch(() => {});

        const knownConfigErrors = { PAYOS_NOT_CONFIGURED: 'shop.buy.payosNotConfigured', PAYPAL_NOT_CONFIGURED: 'shop.buy.paypalNotConfigured', CRYPTO_NOT_CONFIGURED: 'shop.buy.cryptoNotConfigured' };
        const key = knownConfigErrors[error.code] || 'shop.buy.paymentFailed';
        return send(ctx, simpleContainer(await tg(guildId, key)));
    }
}

module.exports = {
    startPurchaseFlow,
    async execute(interactionOrMessage, args) {
        const guild = interactionOrMessage.guild;
        if (!guild) return interactionOrMessage.reply({ content: await tg(null, 'shop.common.guildOnly'), ephemeral: true });
        const guildId = guild.id;
        const isSlash = interactionOrMessage.isChatInputCommand?.();
        const userId = interactionOrMessage.user?.id || interactionOrMessage.author?.id;

        const productName = isSlash ? interactionOrMessage.options.getString('product') : args.join(' ');
        if (!productName) return interactionOrMessage.reply({ content: await tg(guildId, 'shop.buy.productNotFound'), ephemeral: true });

        const product = await findProductByName(guildId, productName);
        if (!product) return interactionOrMessage.reply({ content: await tg(guildId, 'shop.buy.productNotFound'), ephemeral: true });

        return startPurchaseFlow(interactionOrMessage, guild, userId, product);
    }
};
