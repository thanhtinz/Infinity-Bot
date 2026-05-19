import type { EmbedField, ResponseEmbed, CommandForm, TriggerMeta } from "./ccTypes";
import type { LucideIcon } from "lucide-react";
import {
  Variable, Hash, Clock, Sparkles,
  Terminal, Users, Rocket, Building2, MessageSquare, Smile, Mic, GitBranch,
  Calendar, Mic2, ShieldAlert, BarChart2, Mail, ClipboardList, Tag,
  User, Settings, SmilePlus,} from "lucide-react";

// ─── Variable Reference ──────────────────────────────────────────────────────

export const VARIABLE_GROUPS: { label: string; icon: typeof Variable; vars: { key: string; desc: string }[] }[] = [
  {
    label: "User",
    icon: Variable,
    vars: [
      { key: "{user}", desc: "Username (e.g. John#1234)" },
      { key: "{user.mention}", desc: "@mention" },
      { key: "{user.id}", desc: "User ID" },
      { key: "{user.name}", desc: "Username only" },
      { key: "{user.displayname}", desc: "Display name / Nickname" },
      { key: "{user.avatar}", desc: "Avatar URL" },
      { key: "{user.created_at}", desc: "Account creation date" },
      { key: "{user.joined_at}", desc: "Server join date" },
      { key: "{user.roles}", desc: "Role names" },
      { key: "{user.top_role}", desc: "Highest role" },
      { key: "{user.top_role.mention}", desc: "Mention highest role" },
    ],
  },
  {
    label: "Server",
    icon: Variable,
    vars: [
      { key: "{server}", desc: "Server name" },
      { key: "{server.id}", desc: "Server ID" },
      { key: "{server.icon}", desc: "Server icon URL" },
      { key: "{server.owner}", desc: "Server owner" },
      { key: "{member_count}", desc: "Member count" },
      { key: "{server.boost_count}", desc: "Boost count" },
      { key: "{server.boost_level}", desc: "Boost tier" },
    ],
  },
  {
    label: "Channel",
    icon: Hash,
    vars: [
      { key: "{channel}", desc: "Channel mention" },
      { key: "{channel.name}", desc: "Channel name" },
      { key: "{channel.id}", desc: "Channel ID" },
      { key: "{channel.topic}", desc: "Channel topic" },
    ],
  },
  {
    label: "Time",
    icon: Clock,
    vars: [
      { key: "{date}", desc: "Current date (dd/mm/yyyy)" },
      { key: "{time}", desc: "Current time (HH:MM)" },
      { key: "{datetime}", desc: "Date + time" },
      { key: "{timestamp}", desc: "Discord timestamp" },
    ],
  },
  {
    label: "Other",
    icon: Sparkles,
    vars: [
      { key: "{nl}", desc: "New line" },
      { key: "{random_member}", desc: "Random member mention" },
      { key: "{&role}", desc: "Mention role by name" },
      { key: "{#channel}", desc: "Link channel by name" },
      { key: "{everyone}", desc: "Ping @everyone" },
      { key: "{here}", desc: "Ping @here" },
      { key: "$1", desc: "Argument 1" },
      { key: "$2", desc: "Argument 2" },
      { key: "$1+", desc: "All arguments from 1" },
      { key: "{choose:opt1;opt2;opt3}", desc: "Random choice" },
      { key: "{choice}", desc: "Chosen value" },
      { key: "{noeveryone}", desc: "Disable @everyone" },
      { key: "{delete}", desc: "Delete trigger message" },
      { key: "{silent}", desc: "Execute only, no response" },
      { key: "{dm}", desc: "DM response to user" },
      { key: "{prefix}", desc: "Bot prefix" },
      { key: "{respond:#channel}", desc: "Override response channel" },
    ],
  },
];

// ─── Constants ───────────────────────────────────────────────────────────────

export const PRESET_COLORS = [
  "#5865F2",
  "#57f287",
  "#fee75c",
  "#ed4245",
  "#eb459e",
  "#2b2d31",
];

export const DEFAULT_COLOR = "#5865F2";

export const emptyEmbed = (): ResponseEmbed => ({
  title: "",
  description: "",
  color: DEFAULT_COLOR,
  fields: [],
  footer: "",
  thumbnail_url: "",
  image_url: "",
  author: "",
});

export const emptyField = (): EmbedField => ({
  name: "",
  value: "",
  inline: false,
});

export const emptyForm = (): CommandForm => ({
  name: "",
  description: "",
  response_type: "text",
  response_text: "",
  response_embed: emptyEmbed(),
  ephemeral: false,
  required_roles: [],
  enabled: true,
  aliases: [],
  cooldown: 0,
  allowed_channels: [],
  delete_trigger: false,
  auto_react: "",
  silent: false,
  dm_response: false,
  no_everyone: false,
  allowed_roles: [],
  ignored_roles: [],
  ignored_channels: [],
  response_channel_id: "",
  delete_after: 0,
  required_args: 0,
  additional_responses: [],
  // Phase 4
  event_trigger: "prefix_command",
  trigger_config: {},
  actions: [],
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatDate(s?: string) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── Phase 4: Trigger metadata ─────────────────────────────────────────────

export const TRIGGER_GROUPS: { group: string; icon: LucideIcon; triggers: TriggerMeta[] }[] = [
  {
    group: "Command",
    icon: Terminal,
    triggers: [
      { type: "prefix_command", label: "Prefix command (!cmd)", group: "Command", icon: "⌨️", hasConfig: false },
      { type: "keyword", label: "Keyword in message", group: "Command", icon: "🔍", hasConfig: true,
        configFields: [
          { key: "keyword", label: "Keyword", type: "text", placeholder: "e.g. hello" },
          { key: "match_type", label: "Match type", type: "select", options: [
            { value: "contains", label: "Contains" },
            { value: "exact", label: "Exact" },
            { value: "startswith", label: "Starts with" },
            { value: "endswith", label: "Ends with" },
            { value: "regex", label: "Regex" },
          ]},
        ]},
    ],
  },
  {
    group: "Member",
    icon: Users,
    triggers: [
      { type: "member_join", label: "Member joins", group: "Member", icon: "📥", hasConfig: false },
      { type: "member_leave", label: "Member leaves", group: "Member", icon: "📤", hasConfig: false },
      { type: "member_ban", label: "Member banned", group: "Member", icon: "🔨", hasConfig: false },
      { type: "member_unban", label: "Member unbanned", group: "Member", icon: "✅", hasConfig: false },
      { type: "member_role_add", label: "Role added to member", group: "Member", icon: "➕", hasConfig: true,
        configFields: [{ key: "role_filter", label: "Filter by role (blank = any)", type: "role_picker" }] },
      { type: "member_role_remove", label: "Role removed from member", group: "Member", icon: "➖", hasConfig: true,
        configFields: [{ key: "role_filter", label: "Filter by role (blank = any)", type: "role_picker" }] },
      { type: "member_nick_change", label: "Nickname changed", group: "Member", icon: "✏️", hasConfig: false },
      { type: "member_update", label: "Member updated", group: "Member", icon: "🔄", hasConfig: false },
      { type: "member_screening_pass", label: "Passed membership screening", group: "Member", icon: "🛡️", hasConfig: false },
      { type: "member_status_change", label: "Status changed", group: "Member", icon: "🟢", hasConfig: true,
        configFields: [{ key: "status", label: "Status", type: "select", options: [
          { value: "", label: "Any" },
          { value: "online", label: "Online" },
          { value: "idle", label: "Idle" },
          { value: "dnd", label: "Do Not Disturb" },
          { value: "offline", label: "Offline" },
        ]}] },
    ],
  },
  {
    group: "Server Boost",
    icon: Rocket,
    triggers: [
      { type: "member_boost", label: "Member boosts server", group: "Server Boost", icon: "🚀", hasConfig: false },
      { type: "member_unboost", label: "Member stops boosting", group: "Server Boost", icon: "📉", hasConfig: false },
      { type: "boost_level_up", label: "Boost tier increased", group: "Server Boost", icon: "⬆️", hasConfig: false },
      { type: "boost_level_down", label: "Boost tier decreased", group: "Server Boost", icon: "⬇️", hasConfig: false },
    ],
  },
  {
    group: "Server",
    icon: Building2,
    triggers: [
      { type: "guild_update", label: "Server updated", group: "Server", icon: "🔧", hasConfig: false },
      { type: "guild_name_change", label: "Server name changed", group: "Server", icon: "✏️", hasConfig: false },
      { type: "guild_owner_change", label: "Server owner changed", group: "Server", icon: "👑", hasConfig: false },
      { type: "guild_partnered", label: "Server partnered", group: "Server", icon: "🤝", hasConfig: false },
      { type: "guild_unpartnered", label: "Server partnership removed", group: "Server", icon: "💔", hasConfig: false },
      { type: "guild_features_update", label: "Server features changed", group: "Server", icon: "⚙️", hasConfig: false },
      { type: "guild_afk_set", label: "AFK channel set", group: "Server", icon: "😴", hasConfig: false },
      { type: "guild_afk_remove", label: "AFK channel removed", group: "Server", icon: "😴", hasConfig: false },
      { type: "guild_banner_add", label: "Server banner added", group: "Server", icon: "🖼️", hasConfig: false },
      { type: "guild_banner_remove", label: "Server banner removed", group: "Server", icon: "🖼️", hasConfig: false },
      { type: "guild_integrations_update", label: "Integrations updated", group: "Server", icon: "🔌", hasConfig: false },
      { type: "bot_join_guild", label: "Bot joined server", group: "Server", icon: "🤖", hasConfig: false },
    ],
  },
  {
    group: "Channel",
    icon: Hash,
    triggers: [
      { type: "channel_create", label: "Channel created", group: "Channel", icon: "➕", hasConfig: false },
      { type: "channel_update", label: "Channel updated", group: "Channel", icon: "🔧", hasConfig: false },
      { type: "channel_delete", label: "Channel deleted", group: "Channel", icon: "🗑️", hasConfig: false },
      { type: "channel_perms_update", label: "Channel permissions changed", group: "Channel", icon: "🔒", hasConfig: false },
      { type: "channel_topic_update", label: "Channel topic changed", group: "Channel", icon: "📝", hasConfig: false },
      { type: "channel_pins_update", label: "Channel pins changed", group: "Channel", icon: "📌", hasConfig: false },
      { type: "message_pin", label: "Message pinned", group: "Channel", icon: "📌", hasConfig: false },
    ],
  },
  {
    group: "Message",
    icon: MessageSquare,
    triggers: [
      { type: "message_delete", label: "Message deleted", group: "Message", icon: "🗑️", hasConfig: false },
      { type: "message_edit", label: "Message edited", group: "Message", icon: "✏️", hasConfig: false },
      { type: "typing_start", label: "User starts typing", group: "Message", icon: "⌨️", hasConfig: false },
    ],
  },
  {
    group: "Reaction",
    icon: Smile,
    triggers: [
      { type: "reaction_add", label: "Reaction added", group: "Reaction", icon: "➕", hasConfig: true,
        configFields: [{ key: "emoji", label: "Emoji (blank = any)", type: "text", placeholder: "⭐" }] },
      { type: "reaction_remove", label: "Reaction removed", group: "Reaction", icon: "➖", hasConfig: true,
        configFields: [{ key: "emoji", label: "Emoji (blank = any)", type: "text", placeholder: "⭐" }] },
      { type: "reaction_clear", label: "All reactions cleared", group: "Reaction", icon: "🧹", hasConfig: false },
      { type: "reaction_clear_emoji", label: "Emoji reactions cleared", group: "Reaction", icon: "🧹", hasConfig: false },
    ],
  },
  {
    group: "Voice",
    icon: Mic,
    triggers: [
      { type: "voice_join", label: "Joined voice channel", group: "Voice", icon: "🔊", hasConfig: true,
        configFields: [{ key: "channel_filter", label: "Filter channel (blank = any)", type: "channel_picker" }] },
      { type: "voice_leave", label: "Left voice channel", group: "Voice", icon: "🔇", hasConfig: true,
        configFields: [{ key: "channel_filter", label: "Filter channel (blank = any)", type: "channel_picker" }] },
      { type: "voice_switch", label: "Switched voice channel", group: "Voice", icon: "🔀", hasConfig: false },
      { type: "voice_stream_start", label: "Started streaming", group: "Voice", icon: "🎥", hasConfig: false },
      { type: "voice_stream_stop", label: "Stopped streaming", group: "Voice", icon: "🎥", hasConfig: false },
      { type: "voice_camera_on", label: "Camera turned on", group: "Voice", icon: "📷", hasConfig: false },
      { type: "voice_camera_off", label: "Camera turned off", group: "Voice", icon: "📷", hasConfig: false },
      { type: "voice_self_mute", label: "Self muted", group: "Voice", icon: "🔕", hasConfig: false },
      { type: "voice_self_deafen", label: "Self deafened", group: "Voice", icon: "🔕", hasConfig: false },
      { type: "voice_server_mute", label: "Server muted member", group: "Voice", icon: "🔇", hasConfig: false },
      { type: "voice_server_deafen", label: "Server deafened member", group: "Voice", icon: "🔇", hasConfig: false },
    ],
  },
  {
    group: "Role",
    icon: Tag,
    triggers: [
      { type: "role_create", label: "Role created", group: "Role", icon: "➕", hasConfig: false },
      { type: "role_update", label: "Role updated", group: "Role", icon: "🔧", hasConfig: false },
      { type: "role_delete", label: "Role deleted", group: "Role", icon: "🗑️", hasConfig: false },
    ],
  },
  {
    group: "Thread",
    icon: GitBranch,
    triggers: [
      { type: "thread_create", label: "Thread created", group: "Thread", icon: "➕", hasConfig: false },
      { type: "thread_update", label: "Thread updated", group: "Thread", icon: "🔧", hasConfig: false },
      { type: "thread_delete", label: "Thread deleted", group: "Thread", icon: "🗑️", hasConfig: false },
      { type: "thread_members_update", label: "Thread members changed", group: "Thread", icon: "👥", hasConfig: false },
    ],
  },
  {
    group: "Scheduled Event",
    icon: Calendar,
    triggers: [
      { type: "scheduled_event_create", label: "Event created", group: "Scheduled Event", icon: "📅", hasConfig: false },
      { type: "scheduled_event_update", label: "Event updated", group: "Scheduled Event", icon: "🔧", hasConfig: false },
      { type: "scheduled_event_delete", label: "Event deleted", group: "Scheduled Event", icon: "🗑️", hasConfig: false },
      { type: "scheduled_event_user_add", label: "User RSVP'd to event", group: "Scheduled Event", icon: "✅", hasConfig: false },
      { type: "scheduled_event_user_remove", label: "User cancelled RSVP", group: "Scheduled Event", icon: "❌", hasConfig: false },
    ],
  },
  {
    group: "Stage",
    icon: Mic2,
    triggers: [
      { type: "stage_create", label: "Stage created", group: "Stage", icon: "🎤", hasConfig: false },
      { type: "stage_update", label: "Stage updated", group: "Stage", icon: "🔧", hasConfig: false },
      { type: "stage_delete", label: "Stage deleted", group: "Stage", icon: "🗑️", hasConfig: false },
    ],
  },
  {
    group: "AutoMod",
    icon: ShieldAlert,
    triggers: [
      { type: "automod_action", label: "AutoMod action triggered", group: "AutoMod", icon: "⚡", hasConfig: false },
      { type: "automod_rule_create", label: "AutoMod rule created", group: "AutoMod", icon: "➕", hasConfig: false },
      { type: "automod_rule_update", label: "AutoMod rule updated", group: "AutoMod", icon: "🔧", hasConfig: false },
      { type: "automod_rule_delete", label: "AutoMod rule deleted", group: "AutoMod", icon: "🗑️", hasConfig: false },
    ],
  },
  {
    group: "Sticker",
    icon: Sparkles,
    triggers: [
      { type: "sticker_create", label: "Sticker added", group: "Sticker", icon: "➕", hasConfig: false },
      { type: "sticker_update", label: "Sticker updated", group: "Sticker", icon: "🔧", hasConfig: false },
      { type: "sticker_delete", label: "Sticker deleted", group: "Sticker", icon: "🗑️", hasConfig: false },
    ],
  },
  {
    group: "Poll",
    icon: BarChart2,
    triggers: [
      { type: "poll_vote_add", label: "Poll vote added", group: "Poll", icon: "✅", hasConfig: false },
      { type: "poll_vote_remove", label: "Poll vote removed", group: "Poll", icon: "❌", hasConfig: false },
    ],
  },
  {
    group: "Invite",
    icon: Mail,
    triggers: [
      { type: "invite_create", label: "Invite created", group: "Invite", icon: "📨", hasConfig: false },
      { type: "invite_delete", label: "Invite deleted", group: "Invite", icon: "🗑️", hasConfig: false },
    ],
  },
  {
    group: "Audit & App",
    icon: ClipboardList,
    triggers: [
      { type: "audit_log_entry", label: "Audit log entry", group: "Audit & App", icon: "📋", hasConfig: true,
        configFields: [{ key: "action_type", label: "Filter by action type (blank = any)", type: "text", placeholder: "e.g. kick, ban" }] },
      { type: "app_cmd_perms_update", label: "App command permissions changed", group: "Audit & App", icon: "⚙️", hasConfig: false },
    ],
  },
];

// Flat map for quick lookup
export const TRIGGER_BY_TYPE: Record<string, TriggerMeta> = Object.fromEntries(
  TRIGGER_GROUPS.flatMap((g) => g.triggers.map((t) => [t.type, t]))
);


// ── Phase 4: Action metadata ──────────────────────────────────────────────

export const ACTION_GROUPS: { group: string; icon: LucideIcon; actions: { type: string; label: string; fields: { key: string; label: string; type: string; placeholder?: string; options?: {value: string; label: string}[] }[] }[] }[] = [
  {
    group: "Role",
    icon: Tag,
    actions: [
      { type: "add_role", label: "Add role", fields: [{ key: "role_id", label: "Role", type: "role_picker" }] },
      { type: "remove_role", label: "Remove role", fields: [{ key: "role_id", label: "Role", type: "role_picker" }] },
      { type: "toggle_role", label: "Toggle role", fields: [{ key: "role_id", label: "Role", type: "role_picker" }] },
    ],
  },
  {
    group: "Moderation",
    icon: ShieldAlert,
    actions: [
      { type: "warn", label: "Warn", fields: [{ key: "reason", label: "Reason", type: "text", placeholder: "Rule violation" }] },
      { type: "kick", label: "Kick", fields: [{ key: "reason", label: "Reason", type: "text", placeholder: "" }] },
      { type: "ban", label: "Ban", fields: [{ key: "reason", label: "Reason", type: "text" }, { key: "delete_days", label: "Delete messages (days)", type: "text", placeholder: "0" }] },
      { type: "timeout", label: "Timeout", fields: [{ key: "duration_seconds", label: "Duration (seconds)", type: "text", placeholder: "300" }, { key: "reason", label: "Reason", type: "text" }] },
      { type: "remove_timeout", label: "Remove timeout", fields: [] },
      { type: "softban", label: "Softban", fields: [{ key: "reason", label: "Reason", type: "text" }] },
    ],
  },
  {
    group: "Member",
    icon: User,
    actions: [
      { type: "set_nickname", label: "Set nickname", fields: [{ key: "nickname", label: "Nickname (supports vars)", type: "text", placeholder: "{user.name}" }] },
      { type: "reset_nickname", label: "Reset nickname", fields: [] },
      { type: "send_dm", label: "Send DM", fields: [{ key: "content", label: "Content", type: "text" }] },
    ],
  },
  {
    group: "Channel",
    icon: Hash,
    actions: [
      { type: "send_to_channel", label: "Send to channel", fields: [{ key: "channel_id", label: "Channel", type: "channel_picker" }, { key: "content", label: "Content", type: "text" }] },
      { type: "delete_message", label: "Delete trigger message", fields: [] },
      { type: "pin_message", label: "Pin trigger message", fields: [] },
      { type: "lock_channel", label: "Lock channel", fields: [{ key: "channel_id", label: "Channel (blank = current)", type: "channel_picker" }] },
      { type: "unlock_channel", label: "Unlock channel", fields: [{ key: "channel_id", label: "Channel", type: "channel_picker" }] },
      { type: "slowmode", label: "Set slowmode", fields: [{ key: "seconds", label: "Seconds (0 = off)", type: "text", placeholder: "5" }, { key: "channel_id", label: "Channel (optional)", type: "channel_picker" }] },
    ],
  },
  {
    group: "Thread",
    icon: GitBranch,
    actions: [
      { type: "create_thread", label: "Create thread", fields: [{ key: "name", label: "Thread name", type: "text" }, { key: "channel_id", label: "Parent channel (optional)", type: "channel_picker" }] },
      { type: "lock_thread", label: "Lock current thread", fields: [] },
      { type: "archive_thread", label: "Archive current thread", fields: [] },
    ],
  },
  {
    group: "Reaction",
    icon: SmilePlus,
    actions: [
      { type: "add_reaction", label: "Add reaction", fields: [{ key: "emoji", label: "Emoji", type: "text", placeholder: "⭐" }] },
      { type: "remove_reaction", label: "Remove reaction", fields: [{ key: "emoji", label: "Emoji", type: "text" }] },
    ],
  },
  {
    group: "System",
    icon: Settings,
    actions: [
      { type: "wait", label: "Wait (max 10s)", fields: [{ key: "seconds", label: "Seconds", type: "text", placeholder: "1" }] },
      { type: "set_variable", label: "Set variable", fields: [{ key: "name", label: "Variable name", type: "text", placeholder: "myvar" }, { key: "value", label: "Value", type: "text" }] },
    ],
  },
];
