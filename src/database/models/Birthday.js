
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

class Birthday extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                userId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord User ID' },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                day: { type: DataTypes.INTEGER, allowNull: false, comment: 'Birthday day (1-31)' },
                month: { type: DataTypes.INTEGER, allowNull: false, comment: 'Birthday month (1-12)' },
                year: { type: DataTypes.INTEGER, allowNull: true, comment: 'Birth year, optional' },
                lastAnnouncedYear: { type: DataTypes.INTEGER, allowNull: true, comment: 'Calendar year the birthday was last announced, to avoid duplicate posts' },
            },
            {
                sequelize,
                modelName: 'Birthday',
                tableName: 'birthdays',
                timestamps: true,
                indexes: [
                    { unique: true, fields: ['userId', 'guildId'] },
                    { fields: ['guildId'] },
                    { fields: ['day', 'month'] },
                ],
            }
        );
        return this;
    }
}

module.exports = Birthday;
