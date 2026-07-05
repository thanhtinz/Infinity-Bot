
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/**
 * Tracks a Discord role granted to a user via a shop purchase (or manually by an admin), so a
 * scheduled task can strip the role again once `expiresAt` passes. `expiresAt: null` means the
 * grant is permanent (e.g. a one-time purchase rather than a subscription).
 */
class PremiumSubscription extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                userId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord User ID' },
                productId: { type: DataTypes.INTEGER, allowNull: true, comment: 'FK -> shop_products.id, the product that granted this' },
                roleId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord role granted to the user' },
                expiresAt: { type: DataTypes.DATE, allowNull: true, comment: 'null = permanent' },
            },
            {
                sequelize,
                modelName: 'PremiumSubscription',
                tableName: 'premium_subscriptions',
                timestamps: true,
                indexes: [
                    { fields: ['guildId', 'userId'] },
                    { fields: ['expiresAt'] },
                ],
            }
        );
        return this;
    }

    static associate(models) {
        this.belongsTo(models.ShopProduct, { foreignKey: 'productId', as: 'product' });
    }
}

module.exports = PremiumSubscription;
