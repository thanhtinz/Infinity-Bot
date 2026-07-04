
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

class StarboardPost extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                originalMessageId: { type: DataTypes.STRING, allowNull: false, unique: true, comment: 'ID of the message that got starred' },
                originalChannelId: { type: DataTypes.STRING, allowNull: false, comment: 'Channel the original message is in' },
                starboardMessageId: { type: DataTypes.STRING, allowNull: false, comment: 'ID of the cross-posted starboard message' },
                starCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, comment: 'Latest known reaction count' },
            },
            {
                sequelize,
                modelName: 'StarboardPost',
                tableName: 'starboard_posts',
                timestamps: true,
                indexes: [
                    { unique: true, fields: ['originalMessageId'] },
                    { fields: ['guildId'] },
                ],
            }
        );
        return this;
    }
}

module.exports = StarboardPost;
