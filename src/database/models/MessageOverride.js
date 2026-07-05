
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

/**
 * Owner-editable overrides for the bot's bilingual reply/embed templates. Rows here take priority
 * over the static `src/bot/i18n/en.json` / `vi.json` catalogs for the matching (key, language) pair
 * - see `tg()` in `src/bot/utils/i18n.js`, which is the only lookup path that consults this table.
 *
 * `key` is the same dot-separated path used in the JSON catalogs (e.g. "moderation.ban.success").
 * `template` follows the same `{placeholder}` interpolation convention as the static strings.
 */
const overrideCache = new Map();
const CACHE_TTL = 45000;

function cacheKey(key, language) {
    return `${key}:${language}`;
}

class MessageOverride extends BaseModel {
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                key: { type: DataTypes.STRING, allowNull: false },
                language: { type: DataTypes.STRING, allowNull: false },
                template: { type: DataTypes.TEXT, allowNull: false },
            },
            {
                sequelize,
                modelName: 'MessageOverride',
                tableName: 'message_overrides',
                timestamps: true,
                indexes: [
                    { unique: true, fields: ['key', 'language'], name: 'message_overrides_key_language' }
                ]
            }
        );

        return this;
    }

    /**
     * Returns the override template string for (key, language), or null if none exists.
     * Cached briefly so hot code paths (every `tg()` call) don't hit the DB each time.
     */
    static async getTemplate(key, language) {
        const ck = cacheKey(key, language);
        const cached = overrideCache.get(ck);
        if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.val;

        const record = await this.findOne({ where: { key, language } });
        const val = record ? record.template : null;
        overrideCache.set(ck, { val, ts: Date.now() });
        return val;
    }

    /**
     * Upserts the override for (key, language) and immediately invalidates the cache entry so the
     * new template is visible on the very next lookup, no TTL wait.
     */
    static async setTemplate(key, language, template) {
        const [record, created] = await this.findOrCreate({
            where: { key, language },
            defaults: { template }
        });

        if (!created) {
            record.template = template;
            await record.save();
        }

        overrideCache.set(cacheKey(key, language), { val: template, ts: Date.now() });
        return record;
    }

    /**
     * Removes the override for (key, language), reverting lookups to the static catalog default.
     */
    static async clearTemplate(key, language) {
        await this.destroy({ where: { key, language } });
        overrideCache.set(cacheKey(key, language), { val: null, ts: Date.now() });
    }

    static clearCache(key, language) {
        if (key && language) overrideCache.delete(cacheKey(key, language));
        else overrideCache.clear();
    }
}

module.exports = MessageOverride;
