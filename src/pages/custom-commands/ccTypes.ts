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

// ── Phase 4: Triggers ──────────────────────────────────────────────────────

export type TriggerType =
  | "prefix_command" | "keyword"
  | "member_join" | "member_leave" | "member_ban" | "member_unban"
  | "member_role_add" | "member_role_remove" | "member_update"
  | "member_nick_change" | "member_screening_pass"
  | "member_boost" | "member_unboost" | "member_status_change"
  | "boost_level_up" | "boost_level_down"
  | "guild_update" | "guild_features_update" | "guild_owner_change"
  | "guild_partnered" | "guild_unpartnered" | "guild_name_change"
  | "guild_afk_set" | "guild_afk_remove" | "guild_banner_add" | "guild_banner_remove"
  | "guild_integrations_update"
  | "bot_join_guild"
  | "channel_create" | "channel_update" | "channel_delete"
  | "channel_perms_update" | "channel_topic_update" | "channel_pins_update"
  | "invite_create" | "invite_delete"
  | "message_delete" | "message_edit" | "typing_start" | "message_pin"
  | "reaction_add" | "reaction_remove" | "reaction_clear" | "reaction_clear_emoji"
  | "role_create" | "role_update" | "role_delete"
  | "voice_join" | "voice_leave" | "voice_switch"
  | "voice_stream_start" | "voice_stream_stop"
  | "voice_camera_on" | "voice_camera_off"
  | "voice_self_mute" | "voice_self_deafen"
  | "voice_server_mute" | "voice_server_deafen"
  | "thread_create" | "thread_update" | "thread_delete" | "thread_members_update"
  | "scheduled_event_create" | "scheduled_event_update" | "scheduled_event_delete"
  | "scheduled_event_user_add" | "scheduled_event_user_remove"
  | "stage_create" | "stage_update" | "stage_delete"
  | "automod_action" | "automod_rule_create" | "automod_rule_delete" | "automod_rule_update"
  | "sticker_create" | "sticker_update" | "sticker_delete"
  | "poll_vote_add" | "poll_vote_remove"
  | "audit_log_entry"
  | "app_cmd_perms_update";

export interface TriggerMeta {
  type: TriggerType;
  label: string;
  group: string;
  icon: string;          // emoji icon for quick display
  hasConfig: boolean;    // whether this trigger has extra config options
  configFields?: TriggerConfigField[];
}

export interface TriggerConfigField {
  key: string;
  label: string;
  type: "text" | "channel_picker" | "role_picker" | "select" | "toggle";
  options?: { value: string; label: string }[];  // for select
  placeholder?: string;
}

// ── Phase 4: Actions ──────────────────────────────────────────────────────

export type ActionType =
  | "add_role" | "remove_role" | "toggle_role" | "add_roles" | "remove_roles"
  | "warn" | "kick" | "ban" | "unban" | "timeout" | "remove_timeout" | "softban"
  | "set_nickname" | "reset_nickname" | "send_dm"
  | "send_to_channel" | "delete_message" | "pin_message" | "unpin_message"
  | "lock_channel" | "unlock_channel" | "slowmode"
  | "create_thread" | "lock_thread" | "archive_thread"
  | "add_reaction" | "remove_reaction"
  | "give_xp" | "remove_xp" | "set_level"
  | "give_balance"
  | "wait" | "set_variable";

export interface CommandAction {
  type: ActionType;
  config: Record<string, string | number | boolean | string[]>;
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
  // Phase 4
  event_trigger: TriggerType;
  trigger_config: Record<string, unknown>;
  actions: CommandAction[];
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
  // Phase 4
  event_trigger: TriggerType;
  trigger_config: Record<string, unknown>;
  actions: CommandAction[];
}
