
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/** Per-guild, per-game enable/disable + bet-limit config for the Infinity Economy's games. */
class EconomyGameSettings extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                game: { type: DataTypes.STRING, allowNull: false, comment: "'blackjack' | 'slot' | 'coinflip' | 'daily' | 'rob' | 'marry'" },
                enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
                minBet: { type: DataTypes.INTEGER, allowNull: true },
                maxBet: { type: DataTypes.INTEGER, allowNull: true },
            },
            {
                sequelize,
                modelName: 'EconomyGameSettings',
                tableName: 'economy_game_settings',
                timestamps: true,
                indexes: [
                    { fields: ['guildId'] },
                    { unique: true, fields: ['guildId', 'game'] },
                ],
            }
        );
        return this;
    }
}

module.exports = EconomyGameSettings;
