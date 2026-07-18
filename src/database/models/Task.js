const { DataTypes } = require('sequelize');
const BaseModel = require('../BaseModel');

class Task extends BaseModel {
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                userId: { type: DataTypes.STRING, allowNull: false },
                title: { type: DataTypes.STRING, allowNull: false },
                description: { type: DataTypes.TEXT, allowNull: true },
                dueDate: { type: DataTypes.DATE, allowNull: true },
                status: { type: DataTypes.ENUM('pending', 'done'), allowNull: false, defaultValue: 'pending' },
                priority: { type: DataTypes.ENUM('low', 'medium', 'high'), allowNull: false, defaultValue: 'medium' },
            },
            {
                sequelize,
                modelName: 'Task',
                tableName: 'tasks',
                timestamps: true,
            }
        );
        return this;
    }
}

module.exports = Task;
