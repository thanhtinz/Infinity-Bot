
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

class StatsChannelConfig extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                channelId: { type: DataTypes.STRING, allowNull: false, unique: true, comment: 'Voice channel ID whose name gets updated' },
                type: { type: DataTypes.STRING, allowNull: false, comment: 'members, humans, bots, boosts, or roleCount' },
                roleId: { type: DataTypes.STRING, allowNull: true, comment: 'Role to count, only used for roleCount type' },
                nameTemplate: { type: DataTypes.STRING, allowNull: false, comment: 'Channel name template with a {count} placeholder' },
            },
            {
                sequelize,
                modelName: 'StatsChannelConfig',
                tableName: 'stats_channel_config',
                timestamps: true,
                indexes: [
                    { fields: ['guildId'] },
                    { unique: true, fields: ['channelId'] },
                ],
            }
        );
        return this;
    }
}

module.exports = StatsChannelConfig;
