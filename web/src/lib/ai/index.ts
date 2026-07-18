import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { gemini } from './providers/gemini';
import { openai } from './providers/openai';
import { claude } from './providers/claude';
import type { AiProvider, ChatMessageInput, ChatResult, GenerateImageResult } from './providers/types';

const PROVIDERS: Record<string, AiProvider> = { gemini, openai, claude };

export const SUPPORTED_PROVIDERS = Object.keys(PROVIDERS);

export class NoActiveKeyError extends Error {
  code = 'NO_ACTIVE_KEY';
  constructor() {
    super('No AI API key configured for this user');
  }
}

export class NoImageSupportError extends Error {
  code = 'NO_IMAGE_SUPPORT';
  constructor(providerName: string) {
    super(`${providerName} does not support image generation`);
  }
}

export async function getUserProviderClient(userId: string) {
  const active = await prisma.userAIConfig.findFirst({ where: { userId, isActive: true } });
  if (!active) throw new NoActiveKeyError();
  const client = PROVIDERS[active.provider];
  if (!client) throw new Error(`Unknown AI provider: ${active.provider}`);
  return { client, apiKey: decrypt(active.encryptedKey), model: active.preferredModel };
}

export async function chat(
  userId: string,
  messages: ChatMessageInput[],
  opts: { systemPrompt?: string } = {}
): Promise<ChatResult> {
  const { client, apiKey, model } = await getUserProviderClient(userId);
  return client.chat({ apiKey, model, messages, systemPrompt: opts.systemPrompt });
}

export async function generateImage(
  userId: string,
  prompt: string,
  opts: { model?: string } = {}
): Promise<GenerateImageResult> {
  const { client, apiKey, model } = await getUserProviderClient(userId);
  if (!client.supportsImages || !client.generateImage) {
    throw new NoImageSupportError(client.name);
  }
  return client.generateImage({ apiKey, prompt, model: opts.model || model });
}
