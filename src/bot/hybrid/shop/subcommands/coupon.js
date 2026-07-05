
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { ShopCoupon } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');

function reply(ctx, text) {
    const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
}

function hasPermission(interactionOrMessage) {
    return interactionOrMessage.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}

function formatDiscount(coupon) {
    return coupon.discountType === 'percent' ? `${Number(coupon.discountValue)}%` : `${Number(coupon.discountValue)}`;
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
            if (!isSlash) return reply(interactionOrMessage, 'Please use the slash command `/shop coupon add` for this action.');
            const opts = interactionOrMessage.options;
            const code = opts.getString('code').trim().toUpperCase();

            const existing = await ShopCoupon.findOne({ where: { guildId, code } });
            if (existing) return reply(interactionOrMessage, await tg(guildId, 'shop.coupon.duplicate'));

            const maxUses = opts.getInteger('max_uses');
            const expiresDays = opts.getInteger('expires_days');
            const coupon = await ShopCoupon.create({
                guildId, code,
                discountType: opts.getString('type'),
                discountValue: opts.getNumber('value'),
                maxUses: maxUses ?? null,
                expiresAt: expiresDays ? new Date(Date.now() + expiresDays * 86_400_000) : null,
                active: true
            });
            return reply(interactionOrMessage, await tg(guildId, 'shop.coupon.added', { code: coupon.code }));
        }

        if (action === 'remove') {
            const code = (isSlash ? interactionOrMessage.options.getString('code') : args.slice(1).join(' ')).trim().toUpperCase();
            const coupon = await ShopCoupon.findOne({ where: { guildId, code } });
            if (!coupon) return reply(interactionOrMessage, await tg(guildId, 'shop.coupon.notFound'));
            await coupon.destroy();
            return reply(interactionOrMessage, await tg(guildId, 'shop.coupon.removed', { code: coupon.code }));
        }

        if (action === 'list') {
            const coupons = await ShopCoupon.findAll({ where: { guildId }, order: [['createdAt', 'DESC']] });
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'shop.coupon.listTitle')}`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

            if (coupons.length === 0) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.coupon.listEmpty')));
            } else {
                for (const c of coupons) {
                    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'shop.coupon.listRow', {
                        code: c.code, discount: formatDiscount(c), used: c.usesCount, max: c.maxUses != null ? `/${c.maxUses}` : '', status: c.active ? 'active' : 'inactive'
                    })));
                }
            }
            return interactionOrMessage.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }

        return reply(interactionOrMessage, 'Usage: `/shop coupon add|remove|list`');
    }
};
