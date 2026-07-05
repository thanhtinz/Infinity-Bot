
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/**
 * A named grouping of ShopProduct rows within a single guild's shop (e.g. "Roles", "Boosters").
 * `position` controls display order in both the bot's /shop browse UI and the dashboard.
 */
class ShopCategory extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                name: { type: DataTypes.STRING, allowNull: false },
                description: { type: DataTypes.STRING, allowNull: true },
                position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, comment: 'Lower shows first' },
            },
            {
                sequelize,
                modelName: 'ShopCategory',
                tableName: 'shop_categories',
                timestamps: true,
                indexes: [
                    { fields: ['guildId'] },
                    { fields: ['guildId', 'position'] },
                ],
            }
        );
        return this;
    }

    static associate(models) {
        this.hasMany(models.ShopProduct, { foreignKey: 'categoryId', as: 'products', onDelete: 'SET NULL' });
    }
}

module.exports = ShopCategory;
