const { DataTypes } = require('sequelize');
const BaseModel = require('../BaseModel');

class WarnPunishConfig extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, comment: 'Discord Guild ID' },
                warnCount: { type: DataTypes.INTEGER, allowNull: false, comment: 'Number of warns that trigger this punishment' },
                action: { type: DataTypes.STRING, allowNull: false, comment: 'mute, kick, or ban' },
                duration: { type: DataTypes.STRING, allowNull: true, comment: 'Mute duration, e.g. "1h", "30m" (mute only)' },
            },
            {
                sequelize,
                modelName: 'WarnPunishConfig',
                tableName: 'warn_punish_config',
                timestamps: true,
                indexes: [
                    {
                        unique: true,
                        fields: ['guildId', 'warnCount'],
                    },
                ],
            }
        );
        return this;
    }
}

module.exports = WarnPunishConfig;
