
const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { tg } = require('../../../utils/i18n');
const { validateCoupon, computeCouponDiscount, CouponError } = require('../../../utils/shopUtils');

function reply(ctx, text) {
    const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    return ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
}

module.exports = {
    async execute(interactionOrMessage, args) {
        const guild = interactionOrMessage.guild;
        if (!guild) return interactionOrMessage.reply({ content: await tg(null, 'shop.common.guildOnly'), ephemeral: true });
        const guildId = guild.id;
        const isSlash = interactionOrMessage.isChatInputCommand?.();
        const code = isSlash ? interactionOrMessage.options.getString('code') : args.join(' ');

        if (!code) return reply(interactionOrMessage, await tg(guildId, 'shop.redeem.usage'));

        try {
            const coupon = await validateCoupon(guildId, code);
            const discountLabel = coupon.discountType === 'percent' ? `${Number(coupon.discountValue)}%` : `${Number(coupon.discountValue)}`;
            return reply(interactionOrMessage, await tg(guildId, 'shop.redeem.valid', { code: coupon.code, discount: discountLabel }));
        } catch (error) {
            const map = { not_found: 'shop.redeem.notFound', inactive: 'shop.redeem.inactive', expired: 'shop.redeem.expired', exhausted: 'shop.redeem.exhausted' };
            const key = error instanceof CouponError ? (map[error.reasonCode] || 'shop.common.error') : 'shop.common.error';
            return reply(interactionOrMessage, await tg(guildId, key));
        }
    }
};
