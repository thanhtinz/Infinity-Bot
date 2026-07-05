
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/**
 * An accepted `/marry` pairing within a guild. The application layer (see hybrid/marry) enforces
 * that a user can only hold one active row per guild - there is intentionally no DB-level unique
 * constraint on a single user column since either side of the pair could be user1 or user2.
 */
class EconomyMarriage extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                user1Id: { type: DataTypes.STRING, allowNull: false },
                user2Id: { type: DataTypes.STRING, allowNull: false },
                marriedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
            },
            {
                sequelize,
                modelName: 'EconomyMarriage',
                tableName: 'economy_marriages',
                timestamps: true,
                indexes: [
                    { fields: ['guildId'] },
                    { fields: ['guildId', 'user1Id'] },
                    { fields: ['guildId', 'user2Id'] },
                ],
            }
        );
        return this;
    }
}

module.exports = EconomyMarriage;
