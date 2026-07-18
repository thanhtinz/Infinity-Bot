const axios = require('axios');

const DEFAULT_MODEL = 'gemini-2.0-flash';

async function chat({ apiKey, model, messages, systemPrompt }) {
    const useModel = model || DEFAULT_MODEL;
    const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));

    const body = { contents };
    if (systemPrompt) {
        body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const { data } = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
        body,
        { timeout: 30000 }
    );

    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    return { text, raw: data };
}

async function generateImage({ apiKey, prompt, model }) {
    const useModel = model || 'imagen-3.0-generate-002';
    const { data } = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:predict?key=${encodeURIComponent(apiKey)}`,
        { instances: [{ prompt }], parameters: { sampleCount: 1 } },
        { timeout: 60000 }
    );

    const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error('Gemini did not return image data');
    return { buffer: Buffer.from(b64, 'base64'), mime: 'image/png' };
}

module.exports = { name: 'gemini', chat, generateImage, supportsImages: true };
