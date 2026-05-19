import { Sparkles, Bot, Zap, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AIChatConfig {
  enabled: boolean;
  provider: string;
  model: string | null;
  api_key: string | null;
  api_key_set: boolean;
  system_prompt: string | null;
  listen_channels: string[];
  ai_manager_role: string | null;
  respond_to_mention: boolean;
  respond_prefix: string;
  ticket_auto_reply: boolean;
  ticket_category_ids: string[];
  ticket_reply_mode: string;
  image_gen_enabled: boolean;
  image_provider: string | null;
  image_api_key: string | null;
  image_api_key_set: boolean;
  max_history: number;
}

export interface TrainingDoc {
  id: number;
  title: string;
  doc_type: string;
  filename: string | null;
  enabled: boolean;
  content_preview: string;
  char_count: number;
  created_at: string | null;
}

export interface HistoryEntry {
  id: number;
  user_id: string;
  username: string | null;
  channel_id: string | null;
  role: "user" | "assistant";
  content: string;
  timestamp: string | null;
}

// ── Providers ─────────────────────────────────────────────────────────────────

export interface Provider {
  value: string;
  label: string;
  icon: LucideIcon;
}

export const PROVIDERS: Provider[] = [
  { value: "gemini", label: "Google Gemini", icon: Sparkles },
  { value: "openai", label: "OpenAI / ChatGPT", icon: Bot },
  { value: "groq", label: "Groq", icon: Zap },
  { value: "deepsearch", label: "DeepSearch (Perplexity)", icon: Search },
];

// ── Default config ────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: AIChatConfig = {
  enabled: false, provider: "gemini", model: null, api_key: null, api_key_set: false,
  system_prompt: null, listen_channels: [], ai_manager_role: null,
  respond_to_mention: true, respond_prefix: "?", ticket_auto_reply: false,
  ticket_category_ids: [], ticket_reply_mode: "first_msg",
  image_gen_enabled: false, image_provider: null, image_api_key: null,
  image_api_key_set: false, max_history: 10,
};
