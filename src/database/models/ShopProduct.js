
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/**
 * A purchasable item in a guild's shop. Prices are stored per-currency: `priceVnd` (integer VND,
 * used for PayOS QR payments) and `priceUsd` (decimal, used for PayPal/crypto) - either may be
 * null if the product is only sold in one currency, but at least one should be set by the admin
 * UI/commands.
 */
class ShopProduct extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                categoryId: { type: DataTypes.INTEGER, allowNull: true, comment: 'FK -> shop_categories.id' },
                name: { type: DataTypes.STRING, allowNull: false },
                description: { type: DataTypes.TEXT, allowNull: true },
                priceVnd: { type: DataTypes.INTEGER, allowNull: true, comment: 'Price in VND, used for PayOS' },
                priceUsd: { type: DataTypes.DECIMAL(10, 2), allowNull: true, comment: 'Price in USD, used for PayPal/crypto' },
                roleId: { type: DataTypes.STRING, allowNull: true, comment: 'Discord role granted on purchase (premium-style products)' },
                stock: { type: DataTypes.INTEGER, allowNull: true, comment: 'null = unlimited stock' },
                imageUrl: { type: DataTypes.STRING, allowNull: true },
                active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            },
            {
                sequelize,
                modelName: 'ShopProduct',
                tableName: 'shop_products',
                timestamps: true,
                indexes: [
                    { fields: ['guildId'] },
                    { fields: ['guildId', 'active'] },
                    { fields: ['categoryId'] },
                ],
            }
        );
        return this;
    }

    static associate(models) {
        this.belongsTo(models.ShopCategory, { foreignKey: 'categoryId', as: 'category' });
        this.hasMany(models.ShopOrder, { foreignKey: 'productId', as: 'orders', onDelete: 'CASCADE' });
        this.hasMany(models.ShopFlashSale, { foreignKey: 'productId', as: 'flashSales', onDelete: 'CASCADE' });
        this.hasMany(models.PremiumSubscription, { foreignKey: 'productId', as: 'subscriptions', onDelete: 'SET NULL' });
    }
}

module.exports = ShopProduct;
