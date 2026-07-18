const axios = require('axios');

const DEFAULT_MODEL = 'claude-sonnet-5';

async function chat({ apiKey, model, messages, systemPrompt }) {
    const { data } = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
            model: model || DEFAULT_MODEL,
            max_tokens: 4096,
            system: systemPrompt || undefined,
            messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        },
        {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            timeout: 30000,
        }
    );

    const text = data?.content?.map((block) => block.text || '').join('') || '';
    return { text, raw: data };
}

// Claude does not offer an image-generation endpoint.
module.exports = { name: 'claude', chat, generateImage: null, supportsImages: false };
