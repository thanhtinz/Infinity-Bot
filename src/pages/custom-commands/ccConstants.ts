import type { EmbedField, ResponseEmbed, CommandForm } from "./ccTypes";
import { Variable, Hash, Clock, Sparkles } from "lucide-react";

// ─── Variable Reference ──────────────────────────────────────────────────────

export const VARIABLE_GROUPS: { label: string; icon: typeof Variable; vars: { key: string; desc: string }[] }[] = [
  {
    label: "Người dùng",
    icon: Variable,
    vars: [
      { key: "{user}", desc: "Username (VD: John#1234)" },
      { key: "{user.mention}", desc: "@mention" },
      { key: "{user.id}", desc: "User ID" },
      { key: "{user.name}", desc: "Username only" },
      { key: "{user.displayname}", desc: "Display name / Nickname" },
      { key: "{user.avatar}", desc: "Avatar URL" },
      { key: "{user.created_at}", desc: "Ngày tạo tài khoản" },
      { key: "{user.joined_at}", desc: "Ngày tham gia server" },
      { key: "{user.roles}", desc: "Tên các role" },
      { key: "{user.top_role}", desc: "Role cao nhất" },
      { key: "{user.top_role.mention}", desc: "Mention role cao nhất" },
    ],
  },
  {
    label: "Server",
    icon: Variable,
    vars: [
      { key: "{server}", desc: "Tên server" },
      { key: "{server.id}", desc: "Server ID" },
      { key: "{server.icon}", desc: "Server icon URL" },
      { key: "{server.owner}", desc: "Chủ server" },
      { key: "{member_count}", desc: "Số thành viên" },
      { key: "{server.boost_count}", desc: "Số boost" },
      { key: "{server.boost_level}", desc: "Boost tier" },
    ],
  },
  {
    label: "Channel",
    icon: Hash,
    vars: [
      { key: "{channel}", desc: "Channel mention" },
      { key: "{channel.name}", desc: "Tên channel" },
      { key: "{channel.id}", desc: "Channel ID" },
      { key: "{channel.topic}", desc: "Channel topic" },
    ],
  },
  {
    label: "Thời gian",
    icon: Clock,
    vars: [
      { key: "{date}", desc: "Ngày hiện tại (dd/mm/yyyy)" },
      { key: "{time}", desc: "Giờ hiện tại (HH:MM)" },
      { key: "{datetime}", desc: "Ngày + giờ" },
      { key: "{timestamp}", desc: "Discord timestamp" },
    ],
  },
  {
    label: "Khác",
    icon: Sparkles,
    vars: [
      { key: "{nl}", desc: "Xuống dòng mới" },
      { key: "{random_member}", desc: "Random member mention" },
      { key: "{&role}", desc: "Mention role theo tên" },
      { key: "{#channel}", desc: "Link channel theo tên" },
      { key: "{everyone}", desc: "Ping @everyone" },
      { key: "{here}", desc: "Ping @here" },
      { key: "$1", desc: "Argument 1" },
      { key: "$2", desc: "Argument 2" },
      { key: "$1+", desc: "Tất cả arguments từ 1" },
      { key: "{choose:opt1;opt2;opt3}", desc: "Chọn ngẫu nhiên" },
      { key: "{choice}", desc: "Giá trị đã chọn" },
      { key: "{noeveryone}", desc: "Vô hiệu hóa @everyone" },
      { key: "{delete}", desc: "Xóa tin nhắn trigger" },
      { key: "{silent}", desc: "Chỉ thực thi, không phản hồi" },
      { key: "{dm}", desc: "DM phản hồi cho user" },
      { key: "{prefix}", desc: "Prefix của bot" },
      { key: "{respond:#channel}", desc: "Override kênh phản hồi" },
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
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatDate(s?: string) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
