import type { AiProvider } from './types';

const DEFAULT_MODEL = 'gpt-4o-mini';

export const openai: AiProvider = {
  name: 'openai',
  supportsImages: true,

  async chat({ apiKey, model, messages, systemPrompt }) {
    const fullMessages = systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || DEFAULT_MODEL, messages: fullMessages }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error(`OpenAI request failed (${res.status}): ${await res.text().catch(() => '')}`);
    const data = await res.json();
    return { text: data?.choices?.[0]?.message?.content || '' };
  },

  async generateImage({ apiKey, prompt, model }) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || 'dall-e-3', prompt, n: 1, size: '1024x1024', response_format: 'b64_json' }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) throw new Error(`OpenAI image request failed (${res.status}): ${await res.text().catch(() => '')}`);
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI did not return image data');
    return { buffer: Buffer.from(b64, 'base64'), mime: 'image/png' };
  },
};
