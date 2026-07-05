
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

const languageCache = new Map();
const CACHE_TTL = 30000;
const DEFAULT_LANGUAGE = 'en';
const SUPPORTED_LANGUAGES = ['en', 'vi'];

class GuildLanguage extends BaseModel {
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                guildId: { type: DataTypes.STRING, allowNull: false, unique: true },
                language: { type: DataTypes.STRING, allowNull: false, defaultValue: DEFAULT_LANGUAGE },
            },
            {
                sequelize,
                modelName: 'GuildLanguage',
                tableName: 'guild_language',
                timestamps: true,
            }
        );

        return this;
    }

    static async getLanguage(guildId) {
        if (!guildId) return DEFAULT_LANGUAGE;

        const cached = languageCache.get(guildId);
        if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.val;

        const record = await this.findOne({ where: { guildId } });
        const val = record && SUPPORTED_LANGUAGES.includes(record.language) ? record.language : DEFAULT_LANGUAGE;
        languageCache.set(guildId, { val, ts: Date.now() });
        return val;
    }

    static async setLanguage(guildId, language) {
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            throw new Error(`Unsupported language: ${language}`);
        }

        const [record, created] = await this.findOrCreate({
            where: { guildId },
            defaults: { language }
        });

        if (!created) {
            record.language = language;
            await record.save();
        }

        // Immediately update cache so the new language applies right away
        languageCache.set(guildId, { val: language, ts: Date.now() });

        return record;
    }

    static clearCache(guildId) {
        if (guildId) languageCache.delete(guildId);
        else languageCache.clear();
    }
}

GuildLanguage.DEFAULT_LANGUAGE = DEFAULT_LANGUAGE;
GuildLanguage.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;

module.exports = GuildLanguage;
