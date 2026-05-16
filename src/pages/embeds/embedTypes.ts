import type { ReactNode } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedTemplate {
  id: number;
  name: string;
  event_type: string;
  title: string;
  description: string;
  color: string;
  author: string;
  author_icon_url: string;
  footer: string;
  thumbnail_url: string;
  image_url: string;
  fields: EmbedField[];
  enabled: boolean;
  response_mode?: "embed" | "text";
  text_template?: string;
}

export type FormState = Omit<EmbedTemplate, "id"> & { existingId?: number };

// ─── Event definitions ───────────────────────────────────────────────────────

export interface EmbedEventDef {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}

// ─── Custom Messages types ───────────────────────────────────────────────────

export interface CustomEmbed {
  id: number;
  name: string;
  channel_id: string;
  message_id: string;
  guild_id: string;
  content: string;
  webhook_username: string;
  webhook_avatar_url: string;
  thread_name: string;
  title: string;
  description: string;
  color: string;
  author: string;
  author_icon_url: string;
  footer: string;
  thumbnail_url: string;
  image_url: string;
  fields: EmbedField[];
  embeds: EmbedData[];
  components: ActionRow[];
  flags: MessageFlags;
  allowed_mentions: AllowedMentions;
  created_at: string;
  updated_at: string;
}

export interface EmbedData {
  title: string;
  description: string;
  color: string;
  author: string;
  author_icon_url: string;
  footer: string;
  thumbnail_url: string;
  image_url: string;
  fields: EmbedField[];
}

export interface CustomFormState {
  name: string;
  content: string;
  webhook_username: string;
  webhook_avatar_url: string;
  thread_name: string;
  embeds: EmbedData[];
  components: ActionRow[];
  flags: MessageFlags;
  allowed_mentions: AllowedMentions;
}

// ── Component (Button/Row) types ─────────────────────────────────────────────
export interface ComponentButton {
  type: 2;
  style: 1 | 2 | 3 | 4 | 5;   // Primary/Secondary/Success/Danger/Link
  label: string;
  emoji?: string;
  url?: string;                 // style=5 only
  custom_id?: string;           // style 1-4
  disabled?: boolean;
}
export interface ActionRow {
  type: 1;
  components: ComponentButton[];
}

// ── Message flags / mentions ──────────────────────────────────────────────────
export interface MessageFlags {
  suppress_embeds?: boolean;
}
export interface AllowedMentions {
  parse?: ("roles" | "users" | "everyone")[];
  roles?: string[];
  users?: string[];
  replied_user?: boolean;
}

// ── Per-embed collapsible state ──────────────────────────────────────────────
export interface EmbedOpenState {
  main: boolean;
  author: boolean;
  images: boolean;
  fields: boolean;
}

// ─── EmbedsManager props ─────────────────────────────────────────────────────

export interface EmbedsManagerProps {
  eventKeys?: string[];
  pageTitle?: string;
  pageDescription?: string;
}
