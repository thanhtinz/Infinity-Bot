export interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  text: string;
}

export interface GenerateImageResult {
  buffer: Buffer;
  mime: string;
}

export interface AiProvider {
  name: string;
  supportsImages: boolean;
  chat(args: { apiKey: string; model?: string | null; messages: ChatMessageInput[]; systemPrompt?: string }): Promise<ChatResult>;
  generateImage?(args: { apiKey: string; prompt: string; model?: string | null }): Promise<GenerateImageResult>;
}
