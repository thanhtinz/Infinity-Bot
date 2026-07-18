const { DataTypes } = require('sequelize');
const BaseModel = require('../BaseModel');

class ChatChannel extends BaseModel {
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false },
                channelId: { type: DataTypes.STRING, allowNull: false, unique: true },
                enabledBy: { type: DataTypes.STRING, allowNull: true },
            },
            {
                sequelize,
                modelName: 'ChatChannel',
                tableName: 'chat_channels',
                timestamps: true,
            }
        );
        return this;
    }
}

module.exports = ChatChannel;
