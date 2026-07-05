
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/** A single user's wallet/bank balance within one guild's Infinity Economy. */
class EconomyBalance extends BaseModel {
    static CACHE_KEYS = [['guildId'], ['guildId', 'userId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                userId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord User ID' },
                wallet: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, comment: 'Spendable balance - the only balance /rob can steal from' },
                bank: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, comment: 'Safe-from-robbery stash' },
                lastDaily: { type: DataTypes.DATE, allowNull: true },
                dailyStreak: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
                lastRob: { type: DataTypes.DATE, allowNull: true, comment: 'Last time THIS user successfully or unsuccessfully attempted /rob (per-robber cooldown)' },
            },
            {
                sequelize,
                modelName: 'EconomyBalance',
                tableName: 'economy_balances',
                timestamps: true,
                indexes: [
                    { fields: ['guildId'] },
                    { unique: true, fields: ['guildId', 'userId'] },
                ],
            }
        );
        return this;
    }
}

module.exports = EconomyBalance;
