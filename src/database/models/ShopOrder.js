
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/**
 * A single checkout attempt/purchase. Created as 'pending' the moment a user picks a payment
 * method in /shop buy, then transitioned to 'paid' (webhook/manual confirm), 'failed', 'cancelled'
 * or 'refunded'. `paymentReference` holds the gateway-side identifier (PayOS orderCode, PayPal
 * order id, or the crypto memo/reference) used to look the order back up from a webhook.
 */
class ShopOrder extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                userId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord User ID of the buyer' },
                productId: { type: DataTypes.INTEGER, allowNull: false, comment: 'FK -> shop_products.id' },
                quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
                couponCode: { type: DataTypes.STRING, allowNull: true },
                subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
                discount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
                total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
                currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'vnd', comment: "'vnd' | 'usd' | 'crypto'" },
                paymentMethod: { type: DataTypes.STRING, allowNull: false, comment: "'payos' | 'paypal' | 'crypto'" },
                paymentReference: { type: DataTypes.STRING, allowNull: true, comment: 'Gateway transaction/order id used to reconcile webhooks' },
                status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending', comment: "'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'" },
            },
            {
                sequelize,
                modelName: 'ShopOrder',
                tableName: 'shop_orders',
                timestamps: true,
                indexes: [
                    { fields: ['guildId'] },
                    { fields: ['guildId', 'userId'] },
                    { fields: ['paymentReference'] },
                    { fields: ['status'] },
                ],
            }
        );
        return this;
    }

    static associate(models) {
        this.belongsTo(models.ShopProduct, { foreignKey: 'productId', as: 'product' });
    }
}

module.exports = ShopOrder;
