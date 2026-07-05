
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/**
 * Per-guild configuration for the "Infinity Economy" in-game currency system. A row for a given
 * guildId only exists (or has `enabled: true`) once the guild has purchased the "Server Economy
 * Unlock"-style product through the real-money Shop (see ShopProduct.unlocksEconomy and
 * shopUtils.js's fulfillOrderRewards). `/economy setup` lets an admin rename the currency once
 * already unlocked, but never flips `enabled` itself.
 */
class EconomyConfig extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, unique: true, comment: 'Discord Guild ID' },
                enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, comment: 'Premium unlock gate - set true by the Shop order-fulfillment path' },
                currencyName: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Coins' },
                currencySymbol: { type: DataTypes.STRING, allowNull: false, defaultValue: '🪙' },
                startingBalance: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100, comment: 'Wallet balance given to a brand new EconomyBalance row' },
                dailyAmount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
                dailyStreakBonus: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10, comment: 'Added per consecutive daily streak day (capped)' },
                robSuccessRate: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 40, comment: 'Percent chance a /rob succeeds' },
                robMaxPercent: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 20, comment: "Max % of the victim's WALLET (never bank) that can be stolen" },
                robCooldownMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
            },
            {
                sequelize,
                modelName: 'EconomyConfig',
                tableName: 'economy_config',
                timestamps: true,
                indexes: [
                    { unique: true, fields: ['guildId'] },
                ],
            }
        );
        return this;
    }
}

module.exports = EconomyConfig;
