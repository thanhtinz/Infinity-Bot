import type { PanelForm, ButtonForm, PanelGroupForm } from "./tpTypes";

// ─── Constants ───────────────────────────────────────────────────────────────

export const DISCORD_BG = "#2b2d31";
export const DISCORD_EMBED_BG = "#2b2d31";
export const DISCORD_TEXT = "#dbdee1";
export const DISCORD_MUTED = "#949ba4";

export const BUTTON_STYLES = [
  { key: "primary", label: "Primary", bg: "#5865F2", text: "#ffffff" },
  { key: "secondary", label: "Secondary", bg: "#4e5058", text: "#ffffff" },
  { key: "success", label: "Success", bg: "#57f287", text: "#000000" },
  { key: "danger", label: "Danger", bg: "#ed4245", text: "#ffffff" },
] as const;

export const STYLE_RING: Record<string, string> = {
  primary: "ring-[#5865F2]",
  secondary: "ring-[#4e5058]",
  success: "ring-[#57f287]",
  danger: "ring-[#ed4245]",
};

export const STYLE_CHECK: Record<string, string> = {
  primary: "text-[#5865F2]",
  secondary: "text-[#4e5058]",
  success: "text-[#57f287]",
  danger: "text-[#ed4245]",
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
export const MAX_BUTTONS = 5;

export const emptyPanelForm = (): PanelForm => ({
  name: "",
  title: "Tạo Ticket",
  description: "Nhấn nút bên dưới để tạo ticket hỗ trợ.",
  color: DEFAULT_COLOR,
  channel_id: "",
  buttons: [],
  naming_format: "",
  open_message_title: "",
  open_message_body: "",
  close_message_title: "",
  close_message_body: "",
  claim_message_title: "",
  claim_message_body: "",
});

export const emptyButtonForm = (): ButtonForm => ({
  label: "",
  emoji: "",
  style: "primary",
  category_id: "",
  form_id: "",
});

export const emptyPanelGroupForm = (): PanelGroupForm => ({
  name: "",
  title: "Hỗ trợ",
  description: "",
  color: DEFAULT_COLOR,
  channel_id: "",
  panel_ids: [],
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

export function getButtonStyle(key: string) {
  return BUTTON_STYLES.find((s) => s.key === key) ?? BUTTON_STYLES[0];
}
