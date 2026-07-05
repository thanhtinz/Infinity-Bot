'use strict';

/**
 * Shared pricing/fulfillment helpers for the /shop command family and the shop webhook/fulfillment
 * routes (dashboard/server/routes/webhooks.js -> src/bot/dashboardApi.js POST /shop/fulfill-order).
 */

const { Op } = require('sequelize');

class CouponError extends Error {
    constructor(reasonCode) {
        super(reasonCode);
        this.reasonCode = reasonCode; // 'not_found' | 'inactive' | 'expired' | 'exhausted'
    }
}

async function getActiveFlashSale(productId) {
    const { ShopFlashSale } = require('../../database/models');
    const now = new Date();
    return ShopFlashSale.findOne({
        where: {
            productId,
            active: true,
            startsAt: { [Op.lte]: now },
            endsAt: { [Op.gte]: now }
        }
    });
}

/**
 * Returns the effective price for a product after any active flash sale discount is applied.
 * @returns {Promise<{ priceVnd: number|null, priceUsd: number|null, discountPercent: number }>}
 */
async function getEffectivePrice(product) {
    const sale = await getActiveFlashSale(product.id);
    const basePriceVnd = product.priceVnd != null ? Number(product.priceVnd) : null;
    const basePriceUsd = product.priceUsd != null ? Number(product.priceUsd) : null;

    if (!sale) return { priceVnd: basePriceVnd, priceUsd: basePriceUsd, discountPercent: 0 };

    const pct = Number(sale.discountPercent) || 0;
    return {
        priceVnd: basePriceVnd != null ? Math.round(basePriceVnd * (1 - pct / 100)) : null,
        priceUsd: basePriceUsd != null ? Number((basePriceUsd * (1 - pct / 100)).toFixed(2)) : null,
        discountPercent: pct
    };
}

/** Validates a coupon code for a guild. Throws CouponError with a reasonCode on any invalid state. */
async function validateCoupon(guildId, code) {
    const { ShopCoupon } = require('../../database/models');
    // Coupon codes are always stored upper-cased (see hybrid/shop/subcommands/coupon.js and
    // dashboard/server/routes/shop.js), so normalize the lookup the same way regardless of how the
    // caller typed it.
    const coupon = await ShopCoupon.findOne({ where: { guildId, code: String(code || '').trim().toUpperCase() } });
    if (!coupon) throw new CouponError('not_found');
    if (!coupon.active) throw new CouponError('inactive');
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) throw new CouponError('expired');
    if (coupon.maxUses != null && coupon.usesCount >= coupon.maxUses) throw new CouponError('exhausted');
    return coupon;
}

/** Computes the discount amount (in the same unit as `subtotal`) a coupon grants. */
function computeCouponDiscount(coupon, subtotal) {
    if (!coupon) return 0;
    if (coupon.discountType === 'fixed') return Math.min(Number(coupon.discountValue), subtotal);
    return Number((subtotal * (Number(coupon.discountValue) / 100)).toFixed(2));
}

/** Grants the product's configured role to the buyer and records/refreshes a PremiumSubscription row. */
async function fulfillOrderRewards(guild, order, product) {
    const { PremiumSubscription } = require('../../database/models');

    if (product?.roleId && guild) {
        try {
            const member = await guild.members.fetch(order.userId).catch(() => null);
            if (member && !member.roles.cache.has(product.roleId)) {
                await member.roles.add(product.roleId).catch(() => {});
            }
        } catch {
            // best-effort - the order is still marked paid even if the role grant fails (e.g. bot
            // missing permissions); an admin can grant the role manually from the dashboard.
        }

        await PremiumSubscription.create({
            guildId: order.guildId,
            userId: order.userId,
            productId: product.id,
            roleId: product.roleId,
            expiresAt: null
        });
    }
}

module.exports = {
    CouponError,
    getActiveFlashSale,
    getEffectivePrice,
    validateCoupon,
    computeCouponDiscount,
    fulfillOrderRewards
};
