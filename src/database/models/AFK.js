const { DataTypes } = require('sequelize');
const BaseModel = require('../BaseModel');

class AFK extends BaseModel {
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false },
                userId: { type: DataTypes.STRING, allowNull: false },
                reason: { type: DataTypes.STRING(500), allowNull: false, defaultValue: 'AFK' },
                time: { type: DataTypes.BIGINT, allowNull: false },
                dm: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
            },
            {
                sequelize,
                modelName: 'AFK',
                tableName: 'afk',
                timestamps: true,
                indexes: [
                    { unique: true, fields: ['guildId', 'userId'] }
                ]
            }
        );

        return this;
    }
}

module.exports = AFK;
