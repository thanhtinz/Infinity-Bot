const { DataTypes } = require('sequelize');
const BaseModel = require('../BaseModel');

class Todo extends BaseModel {
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                userId: { type: DataTypes.STRING, allowNull: false },
                guildId: { type: DataTypes.STRING, allowNull: false },
                task: { type: DataTypes.STRING(500), allowNull: false },
                completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
            },
            {
                sequelize,
                modelName: 'Todo',
                tableName: 'todos',
                timestamps: true,
                indexes: [
                    { fields: ['guildId', 'userId', 'completed'] }
                ]
            }
        );

        return this;
    }
}

module.exports = Todo;
