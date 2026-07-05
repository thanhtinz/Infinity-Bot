
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/** A purchasable item in a guild's in-game `/store` (spent using economy currency, not real money). */
class EconomyItem extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                name: { type: DataTypes.STRING, allowNull: false },
                description: { type: DataTypes.TEXT, allowNull: true },
                price: { type: DataTypes.INTEGER, allowNull: false },
                roleId: { type: DataTypes.STRING, allowNull: true, comment: 'Discord role granted on purchase, if any' },
                roleDurationSeconds: { type: DataTypes.INTEGER, allowNull: true, comment: 'If set, the granted role is removed this many seconds after purchase' },
                stock: { type: DataTypes.INTEGER, allowNull: true, comment: 'null = unlimited stock' },
                active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            },
            {
                sequelize,
                modelName: 'EconomyItem',
                tableName: 'economy_items',
                timestamps: true,
                indexes: [
                    { fields: ['guildId'] },
                    { fields: ['guildId', 'active'] },
                ],
            }
        );
        return this;
    }

    static associate(models) {
        this.hasMany(models.EconomyInventory, { foreignKey: 'itemId', as: 'inventoryRows', onDelete: 'CASCADE' });
    }
}

module.exports = EconomyItem;
