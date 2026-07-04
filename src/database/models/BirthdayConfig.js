
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

class BirthdayConfig extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, unique: true, comment: 'Discord Guild ID' },
                channelId: { type: DataTypes.STRING, allowNull: true, comment: 'Channel where birthday announcements are posted' },
                roleId: { type: DataTypes.STRING, allowNull: true, comment: 'Role given to the user on their birthday, removed after' },
                message: { type: DataTypes.TEXT, allowNull: true, defaultValue: 'Happy Birthday, {user}! 🎉', comment: 'Announcement message template with a {user} placeholder' },
            },
            {
                sequelize,
                modelName: 'BirthdayConfig',
                tableName: 'birthday_config',
                timestamps: true,
                indexes: [
                    { unique: true, fields: ['guildId'] },
                ],
            }
        );
        return this;
    }
}

module.exports = BirthdayConfig;
