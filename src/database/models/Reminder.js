const { DataTypes } = require('sequelize');
const BaseModel = require('../BaseModel');

class Reminder extends BaseModel {
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                userId: { type: DataTypes.STRING, allowNull: false },
                channelId: { type: DataTypes.STRING, allowNull: false },
                message: { type: DataTypes.TEXT, allowNull: false },
                remindAt: { type: DataTypes.DATE, allowNull: false },
                sent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
            },
            {
                sequelize,
                modelName: 'Reminder',
                tableName: 'reminders',
                timestamps: true,
            }
        );
        return this;
    }
}

module.exports = Reminder;
