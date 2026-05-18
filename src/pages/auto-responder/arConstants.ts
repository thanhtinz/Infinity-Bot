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
  exact: { label: "Exact", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", helper: "Matches the entire message content.", icon: Zap },
  contains: { label: "Contains", color: "bg-blue-500/15 text-blue-600 border-blue-500/30", helper: "Message contains this keyword.", icon: Type },
  startswith: { label: "Starts with", color: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30", helper: "Message starts with this keyword.", icon: ArrowUpRight },
  endswith: { label: "Ends with", color: "bg-teal-500/15 text-teal-600 border-teal-500/30", helper: "Message ends with this keyword.", icon: ArrowUpRight },
  regex: { label: "Regex", color: "bg-purple-500/15 text-purple-600 border-purple-500/30", helper: "Use a regular expression (regex).", icon: Regex },
  wildcard: { label: "Wildcard", color: "bg-orange-500/15 text-orange-600 border-orange-500/30", helper: "Use * for wildcard. E.g.: hello*world", icon: Asterisk },
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
    label: "User",
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
      { key: "{server.member_count}", desc: "Member count" },
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
    label: "Time",
    icon: Clock,
    vars: [
      { key: "{date}", desc: "Date (DD/MM/YYYY)" },
      { key: "{time}", desc: "Time (HH:MM)" },
    ],
  },
  {
    label: "Other",
    icon: Sparkles,
    vars: [
      { key: "{message}", desc: "Message content" },
      { key: "{random:1:100}", desc: "Random number" },
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
  return new Date(s).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
