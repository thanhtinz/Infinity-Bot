import type { AiProvider } from './types';

const DEFAULT_MODEL = 'gemini-2.0-flash';

export const gemini: AiProvider = {
  name: 'gemini',
  supportsImages: true,

  async chat({ apiKey, model, messages, systemPrompt }) {
    const useModel = model || DEFAULT_MODEL;
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = { contents };
    if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) }
    );

    if (!res.ok) throw new Error(`Gemini request failed (${res.status}): ${await res.text().catch(() => '')}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    return { text };
  },

  async generateImage({ apiKey, prompt, model }) {
    const useModel = model || 'imagen-3.0-generate-002';
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:predict?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1 } }),
        signal: AbortSignal.timeout(60000),
      }
    );

    if (!res.ok) throw new Error(`Gemini image request failed (${res.status}): ${await res.text().catch(() => '')}`);
    const data = await res.json();
    const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error('Gemini did not return image data');
    return { buffer: Buffer.from(b64, 'base64'), mime: 'image/png' };
  },
};
