export interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface ResponseEmbed {
  title: string;
  description: string;
  color: string;
  fields: EmbedField[];
  footer?: string;
  thumbnail_url?: string;
  image_url?: string;
  author?: string;
}

export interface AdditionalResponse {
  type: "text" | "embed";
  content?: string;
  embed?: ResponseEmbed;
}

export interface CustomCommand {
  id: number;
  name: string;
  description: string;
  response_type: "text" | "embed";
  response_text: string;
  response_embed: ResponseEmbed;
  ephemeral: boolean;
  required_roles: string[];
  enabled: boolean;
  aliases: string[];
  cooldown: number;
  allowed_channels: string[];
  delete_trigger: boolean;
  auto_react: string | null;
  created_at: string;
  silent: boolean;
  dm_response: boolean;
  no_everyone: boolean;
  allowed_roles: string[];
  ignored_roles: string[];
  ignored_channels: string[];
  response_channel_id: string;
  delete_after: number;
  required_args: number;
  additional_responses: AdditionalResponse[];
}

export interface CommandForm {
  name: string;
  description: string;
  response_type: "text" | "embed";
  response_text: string;
  response_embed: ResponseEmbed;
  ephemeral: boolean;
  required_roles: string[];
  enabled: boolean;
  aliases: string[];
  cooldown: number;
  allowed_channels: string[];
  delete_trigger: boolean;
  auto_react: string;
  silent: boolean;
  dm_response: boolean;
  no_everyone: boolean;
  allowed_roles: string[];
  ignored_roles: string[];
  ignored_channels: string[];
  response_channel_id: string;
  delete_after: number;
  required_args: number;
  additional_responses: AdditionalResponse[];
}
