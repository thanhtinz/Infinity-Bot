import type { AutoResponderRule, EmbedField, ResponseEmbed, RuleForm } from "./arTypes";
import {
  Type,
  Clock,
  Hash,
  Variable,
  Sparkles,
  Zap,
  Regex,
  Asterisk,
  ArrowUpRight,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

export const TRIGGER_TYPE_CONFIG: Record<
  AutoResponderRule["trigger_type"],
  { label: string; color: string; helper: string; icon: typeof Zap }
> = {
  exact: { label: "Chính xác", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", helper: "Khớp toàn bộ nội dung tin nhắn.", icon: Zap },
  contains: { label: "Chứa", color: "bg-blue-500/15 text-blue-600 border-blue-500/30", helper: "Tin nhắn chứa từ khóa này.", icon: Type },
  startswith: { label: "Bắt đầu bằng", color: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30", helper: "Tin nhắn bắt đầu bằng từ khóa.", icon: ArrowUpRight },
  endswith: { label: "Kết thúc bằng", color: "bg-teal-500/15 text-teal-600 border-teal-500/30", helper: "Tin nhắn kết thúc bằng từ khóa.", icon: ArrowUpRight },
  regex: { label: "Regex", color: "bg-purple-500/15 text-purple-600 border-purple-500/30", helper: "Sử dụng biểu thức chính quy (regex).", icon: Regex },
  wildcard: { label: "Wildcard", color: "bg-orange-500/15 text-orange-600 border-orange-500/30", helper: "Dùng * cho wildcard. VD: hello*world", icon: Asterisk },
};

export const PRESET_COLORS = [
  "#5865F2",
  "#57f287",
  "#fee75c",
  "#ed4245",
  "#eb459e",
  "#2b2d31",
];

export const DEFAULT_COLOR = "#5865F2";

export const VARIABLE_GROUPS: { label: string; icon: typeof Variable; vars: { key: string; desc: string }[] }[] = [
  {
    label: "Người dùng",
    icon: Variable,
    vars: [
      { key: "{user}", desc: "Username" },
      { key: "{user.mention}", desc: "Mention" },
      { key: "{user.id}", desc: "User ID" },
      { key: "{user.name}", desc: "Display name" },
    ],
  },
  {
    label: "Server",
    icon: Variable,
    vars: [
      { key: "{server}", desc: "Server name" },
      { key: "{server.member_count}", desc: "Số thành viên" },
    ],
  },
  {
    label: "Channel",
    icon: Hash,
    vars: [
      { key: "{channel}", desc: "Channel mention" },
      { key: "{channel.name}", desc: "Channel name" },
    ],
  },
  {
    label: "Thời gian",
    icon: Clock,
    vars: [
      { key: "{date}", desc: "Ngày (DD/MM/YYYY)" },
      { key: "{time}", desc: "Giờ (HH:MM)" },
    ],
  },
  {
    label: "Khác",
    icon: Sparkles,
    vars: [
      { key: "{message}", desc: "Nội dung tin nhắn" },
      { key: "{random:1:100}", desc: "Số ngẫu nhiên" },
    ],
  },
];

export const emptyEmbed = (): ResponseEmbed => ({
  title: "",
  description: "",
  color: DEFAULT_COLOR,
  footer: "",
  image_url: "",
  thumbnail_url: "",
  author_name: "",
  author_icon_url: "",
  fields: [],
});

export const emptyField = (): EmbedField => ({
  name: "",
  value: "",
  inline: false,
});

export const emptyForm = (): RuleForm => ({
  name: "",
  trigger_type: "contains",
  trigger_text: "",
  ignore_case: true,
  response_type: "text",
  response_text: "",
  response_embed: emptyEmbed(),
  reaction_emojis: [],
  reply_to_message: false,
  delete_trigger: false,
  send_dm: false,
  cooldown: 0,
  cooldown_type: "per_user",
  allowed_channels: [],
  blocked_channels: [],
  allowed_roles: [],
  blocked_roles: [],
  ignore_bots: true,
  enabled: true,
  priority: 0,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatDate(s?: string | null) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
