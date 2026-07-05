
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/**
 * A time-boxed discount on a single product. `discountPercent` is applied on top of the product's
 * normal price whenever `active` is true and the current time falls within [startsAt, endsAt].
 */
class ShopFlashSale extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                productId: { type: DataTypes.INTEGER, allowNull: false, comment: 'FK -> shop_products.id' },
                discountPercent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
                startsAt: { type: DataTypes.DATE, allowNull: false },
                endsAt: { type: DataTypes.DATE, allowNull: false },
                active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            },
            {
                sequelize,
                modelName: 'ShopFlashSale',
                tableName: 'shop_flash_sales',
                timestamps: true,
                indexes: [
                    { fields: ['guildId'] },
                    { fields: ['productId'] },
                    { fields: ['active', 'startsAt', 'endsAt'] },
                ],
            }
        );
        return this;
    }

    static associate(models) {
        this.belongsTo(models.ShopProduct, { foreignKey: 'productId', as: 'product' });
    }
}

module.exports = ShopFlashSale;
