
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/**
 * Singleton-style table (always the row with id: 1) storing the bot's runtime configuration as
 * edited from the Owner Admin Panel (owner-admin/), instead of hand-editing the .env file from a
 * web request. Any field left null falls back to the equivalent process.env value - see
 * src/bot/index.js's resolveRuntimeConfig().
 */
class BotRuntimeConfig extends BaseModel {
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false, defaultValue: 1 },
                botToken: { type: DataTypes.TEXT, allowNull: true, comment: 'Overrides BOT_TOKEN env var when set; never returned in full to the frontend' },
                clientId: { type: DataTypes.STRING, allowNull: true, comment: 'Overrides CLIENT_ID env var when set' },
                clientSecret: { type: DataTypes.TEXT, allowNull: true, comment: 'Discord application client secret; never returned in full to the frontend' },
                ownerId: { type: DataTypes.STRING, allowNull: true, comment: 'Overrides OWNER_ID env var when set' },
                prefix: { type: DataTypes.STRING, allowNull: true, comment: 'Overrides PREFIX env var when set' },
                statusText: { type: DataTypes.STRING, allowNull: true, comment: 'Presence/activity text shown under the bot user' },
                enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, comment: 'Whether the bot should be logged in to Discord' },
            },
            {
                sequelize,
                modelName: 'BotRuntimeConfig',
                tableName: 'bot_runtime_config',
                timestamps: true,
            }
        );
        return this;
    }
}

module.exports = BotRuntimeConfig;
