const { UserAIConfig } = require('../../../database/models');

const PROVIDERS = {
    gemini: require('./providers/gemini'),
    openai: require('./providers/openai'),
    claude: require('./providers/claude'),
};

const SUPPORTED_PROVIDERS = Object.keys(PROVIDERS);

class NoActiveKeyError extends Error {
    constructor() {
        super('No AI API key configured for this user');
        this.code = 'NO_ACTIVE_KEY';
    }
}

async function getUserProviderClient(userId) {
    const active = await UserAIConfig.getActiveKey(userId);
    if (!active) throw new NoActiveKeyError();
    const client = PROVIDERS[active.provider];
    if (!client) throw new Error(`Unknown AI provider: ${active.provider}`);
    return { client, apiKey: active.apiKey, model: active.preferredModel };
}

async function chat(userId, messages, opts = {}) {
    const { client, apiKey, model } = await getUserProviderClient(userId);
    return client.chat({ apiKey, model, messages, systemPrompt: opts.systemPrompt });
}

async function generateImage(userId, prompt, opts = {}) {
    const { client, apiKey, model } = await getUserProviderClient(userId);
    if (!client.supportsImages) {
        const err = new Error(`${client.name} does not support image generation`);
        err.code = 'NO_IMAGE_SUPPORT';
        throw err;
    }
    return client.generateImage({ apiKey, prompt, model: opts.model || model });
}

module.exports = {
    SUPPORTED_PROVIDERS,
    NoActiveKeyError,
    getUserProviderClient,
    chat,
    generateImage,
};
