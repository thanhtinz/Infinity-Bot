import type { EmbedField, ResponseEmbed, CommandForm } from "./ccTypes";
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
