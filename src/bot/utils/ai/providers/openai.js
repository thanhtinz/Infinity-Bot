const axios = require('axios');

const DEFAULT_MODEL = 'gpt-4o-mini';

async function chat({ apiKey, model, messages, systemPrompt }) {
    const fullMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;

    const { data } = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        { model: model || DEFAULT_MODEL, messages: fullMessages },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 30000 }
    );

    return { text: data?.choices?.[0]?.message?.content || '', raw: data };
}

async function generateImage({ apiKey, prompt, model }) {
    const { data } = await axios.post(
        'https://api.openai.com/v1/images/generations',
        { model: model || 'dall-e-3', prompt, n: 1, size: '1024x1024', response_format: 'b64_json' },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 60000 }
    );

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI did not return image data');
    return { buffer: Buffer.from(b64, 'base64'), mime: 'image/png' };
}

module.exports = { name: 'openai', chat, generateImage, supportsImages: true };
