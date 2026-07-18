const { DataTypes } = require('sequelize');
const BaseModel = require('../BaseModel');
const { encrypt, decrypt, maskKey } = require('../../bot/utils/crypto');

const cache = new Map();
const CACHE_TTL = 30000;

class UserAIConfig extends BaseModel {
    static init(sequelize) {
        super.init(
            {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                userId: { type: DataTypes.STRING, allowNull: false, unique: true },
                provider: { type: DataTypes.STRING, allowNull: false, defaultValue: 'gemini' },
                encryptedKeys: { type: DataTypes.TEXT, allowNull: true, defaultValue: '{}' },
                preferredModel: { type: DataTypes.STRING, allowNull: true },
            },
            {
                sequelize,
                modelName: 'UserAIConfig',
                tableName: 'user_ai_config',
                timestamps: true,
            }
        );
        return this;
    }

    static clearCache(userId) {
        if (userId) cache.delete(userId);
        else cache.clear();
    }

    /** Store (or replace) a user's API key for a given provider, encrypted at rest. */
    static async setKey(userId, provider, apiKey) {
        const [record] = await this.findOrCreate({ where: { userId }, defaults: { provider } });
        const keys = JSON.parse(record.encryptedKeys || '{}');
        keys[provider] = encrypt(apiKey);
        record.encryptedKeys = JSON.stringify(keys);
        record.provider = provider;
        await record.save();
        this.clearCache(userId);
        return record;
    }

    static async removeKey(userId, provider) {
        const record = await this.findOne({ where: { userId } });
        if (!record) return false;
        const keys = JSON.parse(record.encryptedKeys || '{}');
        if (!(provider in keys)) return false;
        delete keys[provider];
        record.encryptedKeys = JSON.stringify(keys);
        await record.save();
        this.clearCache(userId);
        return true;
    }

    /** Returns { provider, apiKey (decrypted), preferredModel } for the user's active provider, or null. */
    static async getActiveKey(userId) {
        const cached = cache.get(userId);
        if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.val;

        const record = await this.findOne({ where: { userId } });
        let val = null;
        if (record) {
            const keys = JSON.parse(record.encryptedKeys || '{}');
            const encrypted = keys[record.provider];
            if (encrypted) {
                val = {
                    provider: record.provider,
                    apiKey: decrypt(encrypted),
                    preferredModel: record.preferredModel || null,
                };
            }
        }
        cache.set(userId, { val, ts: Date.now() });
        return val;
    }

    static async listConfiguredProviders(userId) {
        const record = await this.findOne({ where: { userId } });
        if (!record) return [];
        const keys = JSON.parse(record.encryptedKeys || '{}');
        return Object.keys(keys).map((provider) => ({
            provider,
            active: provider === record.provider,
            masked: maskKey(decrypt(keys[provider])),
        }));
    }

    static async setActiveProvider(userId, provider) {
        const record = await this.findOne({ where: { userId } });
        if (!record) return false;
        const keys = JSON.parse(record.encryptedKeys || '{}');
        if (!(provider in keys)) return false;
        record.provider = provider;
        await record.save();
        this.clearCache(userId);
        return true;
    }
}

module.exports = UserAIConfig;
