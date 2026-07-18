const { DataTypes } = require('sequelize');
const BaseModel = require('../BaseModel');

class Expense extends BaseModel {
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                userId: { type: DataTypes.STRING, allowNull: false },
                amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
                category: { type: DataTypes.STRING, allowNull: true },
                note: { type: DataTypes.TEXT, allowNull: true },
                spentAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
            },
            {
                sequelize,
                modelName: 'Expense',
                tableName: 'expenses',
                timestamps: true,
            }
        );
        return this;
    }
}

module.exports = Expense;
