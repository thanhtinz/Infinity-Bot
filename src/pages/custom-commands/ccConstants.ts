import type { EmbedField, ResponseEmbed, CommandForm, TriggerMeta } from "./ccTypes";
import { Variable, Hash, Clock, Sparkles } from "lucide-react";

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

export const TRIGGER_GROUPS: { group: string; emoji: string; triggers: TriggerMeta[] }[] = [
  {
    group: "Lệnh",
    emoji: "⌨️",
    triggers: [
      { type: "prefix_command", label: "Lệnh prefix (!cmd)", group: "Lệnh", icon: "⌨️", hasConfig: false },
      { type: "keyword", label: "Từ khoá trong tin nhắn", group: "Lệnh", icon: "🔍", hasConfig: true,
        configFields: [
          { key: "keyword", label: "Từ khoá", type: "text", placeholder: "ví dụ: xin chào" },
          { key: "match_type", label: "Kiểu khớp", type: "select", options: [
            { value: "contains", label: "Chứa" },
            { value: "exact", label: "Chính xác" },
            { value: "startswith", label: "Bắt đầu bằng" },
            { value: "endswith", label: "Kết thúc bằng" },
            { value: "regex", label: "Regex" },
          ]},
        ]},
    ],
  },
  {
    group: "Thành viên",
    emoji: "👥",
    triggers: [
      { type: "member_join", label: "Thành viên tham gia", group: "Thành viên", icon: "📥", hasConfig: false },
      { type: "member_leave", label: "Thành viên rời đi", group: "Thành viên", icon: "📤", hasConfig: false },
      { type: "member_ban", label: "Thành viên bị ban", group: "Thành viên", icon: "🔨", hasConfig: false },
      { type: "member_unban", label: "Thành viên bị unban", group: "Thành viên", icon: "✅", hasConfig: false },
      { type: "member_role_add", label: "Thêm role cho thành viên", group: "Thành viên", icon: "➕", hasConfig: true,
        configFields: [{ key: "role_filter", label: "Lọc theo role (để trống = tất cả)", type: "role_picker" }] },
      { type: "member_role_remove", label: "Xóa role khỏi thành viên", group: "Thành viên", icon: "➖", hasConfig: true,
        configFields: [{ key: "role_filter", label: "Lọc theo role (để trống = tất cả)", type: "role_picker" }] },
      { type: "member_nick_change", label: "Đổi biệt danh", group: "Thành viên", icon: "✏️", hasConfig: false },
      { type: "member_update", label: "Cập nhật thành viên", group: "Thành viên", icon: "🔄", hasConfig: false },
      { type: "member_screening_pass", label: "Qua membership screening", group: "Thành viên", icon: "🛡️", hasConfig: false },
      { type: "member_status_change", label: "Đổi trạng thái online", group: "Thành viên", icon: "🟢", hasConfig: true,
        configFields: [{ key: "status", label: "Trạng thái", type: "select", options: [
          { value: "", label: "Bất kỳ" },
          { value: "online", label: "Online" },
          { value: "idle", label: "Idle" },
          { value: "dnd", label: "Do Not Disturb" },
          { value: "offline", label: "Offline" },
        ]}] },
    ],
  },
  {
    group: "Server Boost",
    emoji: "🚀",
    triggers: [
      { type: "member_boost", label: "Thành viên boost server", group: "Server Boost", icon: "🚀", hasConfig: false },
      { type: "member_unboost", label: "Thành viên ngừng boost", group: "Server Boost", icon: "📉", hasConfig: false },
      { type: "boost_level_up", label: "Server lên tier boost", group: "Server Boost", icon: "⬆️", hasConfig: false },
      { type: "boost_level_down", label: "Server xuống tier boost", group: "Server Boost", icon: "⬇️", hasConfig: false },
    ],
  },
  {
    group: "Server",
    emoji: "🏠",
    triggers: [
      { type: "guild_update", label: "Server được cập nhật", group: "Server", icon: "🔧", hasConfig: false },
      { type: "guild_name_change", label: "Tên server thay đổi", group: "Server", icon: "✏️", hasConfig: false },
      { type: "guild_owner_change", label: "Chủ server thay đổi", group: "Server", icon: "👑", hasConfig: false },
      { type: "guild_partnered", label: "Server được partner", group: "Server", icon: "🤝", hasConfig: false },
      { type: "guild_unpartnered", label: "Server mất partner", group: "Server", icon: "💔", hasConfig: false },
      { type: "guild_features_update", label: "Tính năng server thay đổi", group: "Server", icon: "⚙️", hasConfig: false },
      { type: "guild_afk_set", label: "Đặt AFK channel", group: "Server", icon: "😴", hasConfig: false },
      { type: "guild_afk_remove", label: "Xóa AFK channel", group: "Server", icon: "😴", hasConfig: false },
      { type: "guild_banner_add", label: "Thêm banner server", group: "Server", icon: "🖼️", hasConfig: false },
      { type: "guild_banner_remove", label: "Xóa banner server", group: "Server", icon: "🖼️", hasConfig: false },
      { type: "guild_integrations_update", label: "Tích hợp thay đổi", group: "Server", icon: "🔌", hasConfig: false },
      { type: "bot_join_guild", label: "Bot tham gia server", group: "Server", icon: "🤖", hasConfig: false },
    ],
  },
  {
    group: "Kênh",
    emoji: "#️⃣",
    triggers: [
      { type: "channel_create", label: "Kênh được tạo", group: "Kênh", icon: "➕", hasConfig: false },
      { type: "channel_update", label: "Kênh được cập nhật", group: "Kênh", icon: "🔧", hasConfig: false },
      { type: "channel_delete", label: "Kênh bị xóa", group: "Kênh", icon: "🗑️", hasConfig: false },
      { type: "channel_perms_update", label: "Quyền kênh thay đổi", group: "Kênh", icon: "🔒", hasConfig: false },
      { type: "channel_topic_update", label: "Chủ đề kênh thay đổi", group: "Kênh", icon: "📝", hasConfig: false },
      { type: "channel_pins_update", label: "Pin kênh thay đổi", group: "Kênh", icon: "📌", hasConfig: false },
      { type: "message_pin", label: "Tin nhắn được ghim", group: "Kênh", icon: "📌", hasConfig: false },
    ],
  },
  {
    group: "Tin nhắn",
    emoji: "💬",
    triggers: [
      { type: "message_delete", label: "Tin nhắn bị xóa", group: "Tin nhắn", icon: "🗑️", hasConfig: false },
      { type: "message_edit", label: "Tin nhắn được sửa", group: "Tin nhắn", icon: "✏️", hasConfig: false },
      { type: "typing_start", label: "Người dùng đang gõ", group: "Tin nhắn", icon: "⌨️", hasConfig: false },
    ],
  },
  {
    group: "Reaction",
    emoji: "😀",
    triggers: [
      { type: "reaction_add", label: "Thêm reaction", group: "Reaction", icon: "➕", hasConfig: true,
        configFields: [{ key: "emoji", label: "Emoji (để trống = tất cả)", type: "text", placeholder: "⭐" }] },
      { type: "reaction_remove", label: "Xóa reaction", group: "Reaction", icon: "➖", hasConfig: true,
        configFields: [{ key: "emoji", label: "Emoji (để trống = tất cả)", type: "text", placeholder: "⭐" }] },
      { type: "reaction_clear", label: "Xóa toàn bộ reaction", group: "Reaction", icon: "🧹", hasConfig: false },
      { type: "reaction_clear_emoji", label: "Xóa reaction theo emoji", group: "Reaction", icon: "🧹", hasConfig: false },
    ],
  },
  {
    group: "Voice",
    emoji: "🎙️",
    triggers: [
      { type: "voice_join", label: "Vào kênh voice", group: "Voice", icon: "🔊", hasConfig: true,
        configFields: [{ key: "channel_filter", label: "Lọc kênh (để trống = tất cả)", type: "channel_picker" }] },
      { type: "voice_leave", label: "Rời kênh voice", group: "Voice", icon: "🔇", hasConfig: true,
        configFields: [{ key: "channel_filter", label: "Lọc kênh", type: "channel_picker" }] },
      { type: "voice_switch", label: "Chuyển kênh voice", group: "Voice", icon: "🔀", hasConfig: false },
      { type: "voice_stream_start", label: "Bắt đầu stream", group: "Voice", icon: "🎥", hasConfig: false },
      { type: "voice_stream_stop", label: "Kết thúc stream", group: "Voice", icon: "🎥", hasConfig: false },
      { type: "voice_camera_on", label: "Bật camera", group: "Voice", icon: "📷", hasConfig: false },
      { type: "voice_camera_off", label: "Tắt camera", group: "Voice", icon: "📷", hasConfig: false },
      { type: "voice_self_mute", label: "Tự mute", group: "Voice", icon: "🔕", hasConfig: false },
      { type: "voice_self_deafen", label: "Tự deaf", group: "Voice", icon: "🔕", hasConfig: false },
      { type: "voice_server_mute", label: "Server mute thành viên", group: "Voice", icon: "🔇", hasConfig: false },
      { type: "voice_server_deafen", label: "Server deaf thành viên", group: "Voice", icon: "🔇", hasConfig: false },
    ],
  },
  {
    group: "Role",
    emoji: "🎭",
    triggers: [
      { type: "role_create", label: "Role được tạo", group: "Role", icon: "➕", hasConfig: false },
      { type: "role_update", label: "Role được cập nhật", group: "Role", icon: "🔧", hasConfig: false },
      { type: "role_delete", label: "Role bị xóa", group: "Role", icon: "🗑️", hasConfig: false },
    ],
  },
  {
    group: "Thread",
    emoji: "🧵",
    triggers: [
      { type: "thread_create", label: "Thread được tạo", group: "Thread", icon: "➕", hasConfig: false },
      { type: "thread_update", label: "Thread được cập nhật", group: "Thread", icon: "🔧", hasConfig: false },
      { type: "thread_delete", label: "Thread bị xóa", group: "Thread", icon: "🗑️", hasConfig: false },
      { type: "thread_members_update", label: "Thành viên thread thay đổi", group: "Thread", icon: "👥", hasConfig: false },
    ],
  },
  {
    group: "Sự kiện",
    emoji: "🗓️",
    triggers: [
      { type: "scheduled_event_create", label: "Tạo sự kiện", group: "Sự kiện", icon: "📅", hasConfig: false },
      { type: "scheduled_event_update", label: "Cập nhật sự kiện", group: "Sự kiện", icon: "🔧", hasConfig: false },
      { type: "scheduled_event_delete", label: "Xóa sự kiện", group: "Sự kiện", icon: "🗑️", hasConfig: false },
      { type: "scheduled_event_user_add", label: "Người dùng RSVP sự kiện", group: "Sự kiện", icon: "✅", hasConfig: false },
      { type: "scheduled_event_user_remove", label: "Người dùng hủy RSVP", group: "Sự kiện", icon: "❌", hasConfig: false },
    ],
  },
  {
    group: "Stage",
    emoji: "🎤",
    triggers: [
      { type: "stage_create", label: "Stage được tạo", group: "Stage", icon: "🎤", hasConfig: false },
      { type: "stage_update", label: "Stage được cập nhật", group: "Stage", icon: "🔧", hasConfig: false },
      { type: "stage_delete", label: "Stage bị xóa", group: "Stage", icon: "🗑️", hasConfig: false },
    ],
  },
  {
    group: "AutoMod",
    emoji: "🛡️",
    triggers: [
      { type: "automod_action", label: "AutoMod thực thi", group: "AutoMod", icon: "⚡", hasConfig: false },
      { type: "automod_rule_create", label: "Tạo quy tắc AutoMod", group: "AutoMod", icon: "➕", hasConfig: false },
      { type: "automod_rule_update", label: "Cập nhật quy tắc AutoMod", group: "AutoMod", icon: "🔧", hasConfig: false },
      { type: "automod_rule_delete", label: "Xóa quy tắc AutoMod", group: "AutoMod", icon: "🗑️", hasConfig: false },
    ],
  },
  {
    group: "Sticker",
    emoji: "🎨",
    triggers: [
      { type: "sticker_create", label: "Sticker được thêm", group: "Sticker", icon: "➕", hasConfig: false },
      { type: "sticker_update", label: "Sticker được cập nhật", group: "Sticker", icon: "🔧", hasConfig: false },
      { type: "sticker_delete", label: "Sticker bị xóa", group: "Sticker", icon: "🗑️", hasConfig: false },
    ],
  },
  {
    group: "Poll",
    emoji: "📊",
    triggers: [
      { type: "poll_vote_add", label: "Bình chọn thêm", group: "Poll", icon: "✅", hasConfig: false },
      { type: "poll_vote_remove", label: "Bình chọn bị rút", group: "Poll", icon: "❌", hasConfig: false },
    ],
  },
  {
    group: "Lời mời",
    emoji: "📨",
    triggers: [
      { type: "invite_create", label: "Tạo lời mời", group: "Lời mời", icon: "📨", hasConfig: false },
      { type: "invite_delete", label: "Xóa lời mời", group: "Lời mời", icon: "🗑️", hasConfig: false },
    ],
  },
  {
    group: "Audit & App",
    emoji: "📋",
    triggers: [
      { type: "audit_log_entry", label: "Audit log entry (cần intent)", group: "Audit & App", icon: "📋", hasConfig: true,
        configFields: [{ key: "action_type", label: "Lọc theo loại hành động (để trống = tất cả)", type: "text", placeholder: "e.g. kick, ban" }] },
      { type: "app_cmd_perms_update", label: "Quyền app command thay đổi", group: "Audit & App", icon: "⚙️", hasConfig: false },
    ],
  },
];

// Flat map for quick lookup
export const TRIGGER_BY_TYPE: Record<string, TriggerMeta> = Object.fromEntries(
  TRIGGER_GROUPS.flatMap((g) => g.triggers.map((t) => [t.type, t]))
);

// ── Phase 4: Action metadata ──────────────────────────────────────────────

export const ACTION_GROUPS: { group: string; emoji: string; actions: { type: string; label: string; fields: { key: string; label: string; type: string; placeholder?: string; options?: {value: string; label: string}[] }[] }[] }[] = [
  {
    group: "Role",
    emoji: "🎭",
    actions: [
      { type: "add_role", label: "Thêm role", fields: [{ key: "role_id", label: "Role", type: "role_picker" }] },
      { type: "remove_role", label: "Xóa role", fields: [{ key: "role_id", label: "Role", type: "role_picker" }] },
      { type: "toggle_role", label: "Toggle role", fields: [{ key: "role_id", label: "Role", type: "role_picker" }] },
    ],
  },
  {
    group: "Kiểm duyệt",
    emoji: "🛡️",
    actions: [
      { type: "warn", label: "Cảnh cáo", fields: [{ key: "reason", label: "Lý do", type: "text", placeholder: "Vi phạm nội quy" }] },
      { type: "kick", label: "Kick", fields: [{ key: "reason", label: "Lý do", type: "text", placeholder: "" }] },
      { type: "ban", label: "Ban", fields: [{ key: "reason", label: "Lý do", type: "text" }, { key: "delete_days", label: "Xóa tin nhắn (ngày)", type: "text", placeholder: "0" }] },
      { type: "timeout", label: "Timeout", fields: [{ key: "duration_seconds", label: "Thời gian (giây)", type: "text", placeholder: "300" }, { key: "reason", label: "Lý do", type: "text" }] },
      { type: "remove_timeout", label: "Xóa timeout", fields: [] },
      { type: "softban", label: "Softban", fields: [{ key: "reason", label: "Lý do", type: "text" }] },
    ],
  },
  {
    group: "Thành viên",
    emoji: "👤",
    actions: [
      { type: "set_nickname", label: "Đặt biệt danh", fields: [{ key: "nickname", label: "Biệt danh (hỗ trợ vars)", type: "text", placeholder: "{user.name}" }] },
      { type: "reset_nickname", label: "Xóa biệt danh", fields: [] },
      { type: "send_dm", label: "Gửi DM", fields: [{ key: "content", label: "Nội dung", type: "text" }] },
    ],
  },
  {
    group: "Kênh",
    emoji: "#️⃣",
    actions: [
      { type: "send_to_channel", label: "Gửi tin đến kênh", fields: [{ key: "channel_id", label: "Kênh", type: "channel_picker" }, { key: "content", label: "Nội dung", type: "text" }] },
      { type: "delete_message", label: "Xóa tin trigger", fields: [] },
      { type: "pin_message", label: "Ghim tin trigger", fields: [] },
      { type: "lock_channel", label: "Khóa kênh", fields: [{ key: "channel_id", label: "Kênh (để trống = kênh hiện tại)", type: "channel_picker" }] },
      { type: "unlock_channel", label: "Mở khóa kênh", fields: [{ key: "channel_id", label: "Kênh", type: "channel_picker" }] },
      { type: "slowmode", label: "Đặt slowmode", fields: [{ key: "seconds", label: "Giây (0 = tắt)", type: "text", placeholder: "5" }, { key: "channel_id", label: "Kênh (tùy chọn)", type: "channel_picker" }] },
    ],
  },
  {
    group: "Thread",
    emoji: "🧵",
    actions: [
      { type: "create_thread", label: "Tạo thread", fields: [{ key: "name", label: "Tên thread", type: "text" }, { key: "channel_id", label: "Kênh cha (tùy chọn)", type: "channel_picker" }] },
      { type: "lock_thread", label: "Khóa thread hiện tại", fields: [] },
      { type: "archive_thread", label: "Archive thread hiện tại", fields: [] },
    ],
  },
  {
    group: "Reaction",
    emoji: "😀",
    actions: [
      { type: "add_reaction", label: "Thêm reaction", fields: [{ key: "emoji", label: "Emoji", type: "text", placeholder: "⭐" }] },
      { type: "remove_reaction", label: "Xóa reaction", fields: [{ key: "emoji", label: "Emoji", type: "text" }] },
    ],
  },
  {
    group: "Leveling",
    emoji: "⬆️",
    actions: [
      { type: "give_xp", label: "Cộng XP", fields: [{ key: "amount", label: "Số XP", type: "text", placeholder: "100" }] },
      { type: "remove_xp", label: "Trừ XP", fields: [{ key: "amount", label: "Số XP", type: "text" }] },
      { type: "set_level", label: "Đặt level", fields: [{ key: "level", label: "Level", type: "text" }] },
    ],
  },
  {
    group: "Shop",
    emoji: "🛍️",
    actions: [
      { type: "give_balance", label: "Cộng số dư shop", fields: [{ key: "amount", label: "Số tiền", type: "text", placeholder: "1000" }] },
    ],
  },
  {
    group: "Hệ thống",
    emoji: "⚙️",
    actions: [
      { type: "wait", label: "Chờ (tối đa 10s)", fields: [{ key: "seconds", label: "Giây", type: "text", placeholder: "1" }] },
      { type: "set_variable", label: "Đặt biến", fields: [{ key: "name", label: "Tên biến", type: "text", placeholder: "myvar" }, { key: "value", label: "Giá trị", type: "text" }] },
    ],
  },
];
