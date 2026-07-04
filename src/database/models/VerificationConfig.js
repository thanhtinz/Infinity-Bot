
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

class VerificationConfig extends BaseModel {
    static CACHE_KEYS = [['guildId']];
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, unique: true, comment: 'Discord Guild ID' },
                enabled: { type: DataTypes.BOOLEAN, defaultValue: false, comment: 'Whether the verification gate is active' },
                channelId: { type: DataTypes.STRING, allowNull: true, comment: 'Channel where the verify panel is posted' },
                unverifiedRoleId: { type: DataTypes.STRING, allowNull: true, comment: 'Role assigned to members on join, before verifying' },
                verifiedRoleId: { type: DataTypes.STRING, allowNull: true, comment: 'Role assigned once a member verifies' },
                message: { type: DataTypes.TEXT, allowNull: true, comment: 'Customizable verify panel text' },
                panelMessageId: { type: DataTypes.STRING, allowNull: true, comment: 'Message ID of the last posted verify panel' },
            },
            {
                sequelize,
                modelName: 'VerificationConfig',
                tableName: 'verification_config',
                timestamps: true,
                indexes: [
                    {
                        unique: true,
                        fields: ['guildId'],
                    },
                ],
            }
        );
        return this;
    }
}

module.exports = VerificationConfig;
