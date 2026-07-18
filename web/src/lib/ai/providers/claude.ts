import type { AiProvider } from './types';

const DEFAULT_MODEL = 'claude-sonnet-5';

export const claude: AiProvider = {
  name: 'claude',
  supportsImages: false,

  async chat({ apiKey, model, messages, systemPrompt }) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: 4096,
        system: systemPrompt || undefined,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error(`Claude request failed (${res.status}): ${await res.text().catch(() => '')}`);
    const data = await res.json();
    const text = (data?.content || []).map((block: { text?: string }) => block.text || '').join('');
    return { text };
  },

  // Claude does not offer an image-generation endpoint.
  generateImage: undefined,
};
