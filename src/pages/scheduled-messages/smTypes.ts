// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedData {
  title: string;
  description: string;
  color: string;
  footer: string;
  image_url: string;
  thumbnail_url: string;
  author_name: string;
  author_icon_url: string;
  fields: EmbedField[];
}

export interface ScheduledMessage {
  id: number;
  channel_id: string;
  content: string;
  embed_data: EmbedData | null;
  send_at: string;
  repeat_type: "none" | "hourly" | "daily" | "weekly" | "monthly";
  sent: boolean;
  last_sent_at: string | null;
  enabled: boolean;
  created_by: string;
  created_at: string;
}

export interface FormState {
  channel_id: string;
  content: string;
  add_embed: boolean;
  embed_data: EmbedData;
  send_at: string;
  repeat_type: "none" | "hourly" | "daily" | "weekly" | "monthly";
  enabled: boolean;
}
