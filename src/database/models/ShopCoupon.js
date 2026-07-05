
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/**
 * A discount code redeemable at checkout. `code` is unique per-guild (not globally), so two
 * different servers can each have their own "SALE10" coupon. `discountType` is 'percent' or
 * 'fixed' (checked in application code, not a DB enum, matching this codebase's convention of
 * plain STRING status/type columns - see Ticket.status).
 */
class ShopCoupon extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                code: { type: DataTypes.STRING, allowNull: false },
                discountType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'percent', comment: "'percent' | 'fixed'" },
                discountValue: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
                maxUses: { type: DataTypes.INTEGER, allowNull: true, comment: 'null = unlimited uses' },
                usesCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
                expiresAt: { type: DataTypes.DATE, allowNull: true },
                active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            },
            {
                sequelize,
                modelName: 'ShopCoupon',
                tableName: 'shop_coupons',
                timestamps: true,
                indexes: [
                    { fields: ['guildId'] },
                    { unique: true, fields: ['guildId', 'code'] },
                ],
            }
        );
        return this;
    }
}

module.exports = ShopCoupon;
