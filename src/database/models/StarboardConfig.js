
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

class StarboardConfig extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, unique: true, comment: 'Discord Guild ID' },
                channelId: { type: DataTypes.STRING, allowNull: true, comment: 'Channel where starred messages are cross-posted' },
                emoji: { type: DataTypes.STRING, allowNull: false, defaultValue: '⭐', comment: 'Emoji that counts toward the star threshold' },
                threshold: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3, comment: 'Reaction count required to post to the starboard' },
                enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, comment: 'Whether the starboard is active' },
            },
            {
                sequelize,
                modelName: 'StarboardConfig',
                tableName: 'starboard_config',
                timestamps: true,
                indexes: [
                    { unique: true, fields: ['guildId'] },
                ],
            }
        );
        return this;
    }
}

module.exports = StarboardConfig;
