
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

class StickyNickname extends BaseModel {
    static CACHE_KEYS = [['guildId', 'userId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                userId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord User ID' },
                nickname: { type: DataTypes.STRING, allowNull: false, comment: 'The nickname to enforce' },
                setById: { type: DataTypes.STRING, allowNull: true, comment: 'Moderator who set the sticky nickname' },
            },
            {
                sequelize,
                modelName: 'StickyNickname',
                tableName: 'sticky_nicknames',
                timestamps: true,
                indexes: [
                    {
                        unique: true,
                        fields: ['guildId', 'userId'],
                    },
                ],
            }
        );
        return this;
    }
}

module.exports = StickyNickname;
