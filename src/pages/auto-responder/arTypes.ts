// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface ResponseEmbed {
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

export interface AutoResponderRule {
  id: number;
  name: string;
  trigger_type: "exact" | "contains" | "startswith" | "endswith" | "regex" | "wildcard";
  trigger_text: string;
  ignore_case: boolean;
  response_type: "text" | "embed" | "react" | "text+react" | "embed+react";
  response_text: string | null;
  response_embed: ResponseEmbed | null;
  reaction_emojis: string[];
  reply_to_message: boolean;
  delete_trigger: boolean;
  send_dm: boolean;
  cooldown: number;
  cooldown_type: "per_user" | "per_channel" | "global";
  allowed_channels: string[];
  blocked_channels: string[];
  allowed_roles: string[];
  blocked_roles: string[];
  ignore_bots: boolean;
  enabled: boolean;
  priority: number;
  created_at: string | null;
}

export interface RuleForm {
  name: string;
  trigger_type: AutoResponderRule["trigger_type"];
  trigger_text: string;
  ignore_case: boolean;
  response_type: AutoResponderRule["response_type"];
  response_text: string;
  response_embed: ResponseEmbed;
  reaction_emojis: string[];
  reply_to_message: boolean;
  delete_trigger: boolean;
  send_dm: boolean;
  cooldown: number;
  cooldown_type: AutoResponderRule["cooldown_type"];
  allowed_channels: string[];
  blocked_channels: string[];
  allowed_roles: string[];
  blocked_roles: string[];
  ignore_bots: boolean;
  enabled: boolean;
  priority: number;
}
