import type { EmbedData, FormState } from "./smTypes";

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

export const REPEAT_LABELS: Record<FormState["repeat_type"], string> = {
  none: "No repeat",
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const emptyEmbed = (): EmbedData => ({
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

export const emptyForm = (): FormState => ({
  channel_id: "",
  content: "",
  add_embed: false,
  embed_data: emptyEmbed(),
  send_at: "",
  repeat_type: "none",
  enabled: true,
});

export function toDatetimeLocal(s: string) {
  if (!s) return "";
  const d = new Date(s);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
