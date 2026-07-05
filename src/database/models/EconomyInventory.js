
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/**
 * A user's owned copy/copies of an `EconomyItem`. Role-granting items record `expiresAt` so a
 * background sweep (see utils/economyExpiry.js) can remove the role once it lapses.
 */
class EconomyInventory extends BaseModel {
    static CACHE_KEYS = [['guildId'], ['guildId', 'userId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                userId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord User ID' },
                itemId: { type: DataTypes.INTEGER, allowNull: false, comment: 'FK -> economy_items.id' },
                quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
                expiresAt: { type: DataTypes.DATE, allowNull: true, comment: 'For role-granting items with a roleDurationSeconds - when the role should be revoked' },
                roleRevoked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, comment: 'Set true once the background sweep has revoked the role for this row' },
            },
            {
                sequelize,
                modelName: 'EconomyInventory',
                tableName: 'economy_inventory',
                timestamps: true,
                indexes: [
                    { fields: ['guildId'] },
                    { fields: ['guildId', 'userId'] },
                    { fields: ['expiresAt'] },
                ],
            }
        );
        return this;
    }

    static associate(models) {
        this.belongsTo(models.EconomyItem, { foreignKey: 'itemId', as: 'item' });
    }
}

module.exports = EconomyInventory;
