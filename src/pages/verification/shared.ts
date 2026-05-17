import { apiFetch } from "@/hooks/useApi";

// ── Types ──────────────────────────────────────────────────────────────────

export interface VerifiedMember {
  id: number;
  discord_id: string;
  username: string;
  avatar: string | null;
  email: string | null;
  ip_address: string | null;
  roles: string[];
  verified_at: string;
  last_seen: string;
  is_blacklisted: boolean;
  risk_score: number;
}

export interface MembersResponse {
  total: number;
  page: number;
  per_page: number;
  members: VerifiedMember[];
}

export interface VerificationConfig {
  enabled: boolean;
  verified_role_id: string;
  unverified_role_id: string;
  verify_channel_id: string;
  log_channel_id: string;
  page_title: string;
  page_description: string;
  page_color: string;
  page_logo_url: string;
  page_background_url: string;
  button_text: string;
  success_message: string;
  captcha_enabled: boolean;
  captcha_type: "none" | "button" | "emoji" | "math" | "slider";
  captcha_difficulty: "easy" | "medium" | "hard";
  min_account_age_days: number;
  block_vpn: boolean;
  kick_on_deauth: boolean;
  close_page_after_verify: boolean;
  page_footer_text: string;
  page_theme: string;
  custom_css: string;
  redirect_url: string;
  terms_url: string;
  // Advanced customization
  banner_url: string;
  cursor_url: string;
  font_family: string;
  bg_effect: string;
  bg_color: string;
  text_color: string;
  btn_color: string;
  btn_border_color: string;
  card_border_color: string;
  card_bg_color: string;
  typewriter_effect: boolean;
  glow_effect: boolean;
  tilt_effect: boolean;
  bio_description: string;
  socials: Record<string, string>;
  // Protection
  block_mobile: boolean;
  block_scammers: boolean;
  deny_alt_role: boolean;
  auto_ban_alts: boolean;
  no_save_ip: boolean;
  // OAuth Permissions
  guild_join_enabled: boolean;
  force_all_permissions: boolean;
  // Notifications
  notify_success_role_id: string;
  notify_blocked_role_id: string;
  // Gateway
  gateway_guild_id: string;
  // Passwords
  verify_passwords: { password: string; label: string }[];
  // VPN config (per-guild)
  vpn_api_key: string;
  vpn_api_provider: string;
  custom_domain: string;
  music_url: string;
  pull_cooldown_hours: number;
}

export interface VerificationStats {
  total: number;
  today: number;
  this_week: number;
  blacklisted: number;
  pullable: number;
  deauthorized: number;
}

export interface MemberPullStatus {
  active: boolean;
  id: number | null;
  status: string;
  total_members: number;
  pulled_members: number;
  failed_members: number;
  restore_roles: boolean;
  started_at: string | null;
  completed_at: string | null;
  log: PullLogEntry[];
}

export interface PullLogEntry {
  discord_id: string;
  username: string;
  status: string;
  error?: string;
  timestamp: string;
}

export interface PullHistoryItem {
  id: number;
  status: string;
  total_members: number;
  pulled_members: number;
  failed_members: number;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function riskBadge(score: number): { cls: string; label: string } {
  if (score >= 80) return { cls: "bg-red-500/15 text-red-600 border-red-500/30", label: "High" };
  if (score >= 40) return { cls: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30", label: "Medium" };
  return { cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", label: "Low" };
}

// ── API ────────────────────────────────────────────────────────────────────

export async function fetchMembers(
  page: number,
  perPage: number,
  search: string,
  blacklisted?: boolean
): Promise<MembersResponse> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    search,
  });
  if (blacklisted !== undefined) params.set("blacklisted", String(blacklisted));
  const res = await apiFetch(`/api/verification/members?${params}`);
  if (!res.ok) throw new Error("Failed to load members");
  return res.json();
}

export async function blacklistMember(id: number, blacklisted: boolean): Promise<void> {
  const res = await apiFetch(`/api/verification/members/${id}/blacklist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blacklisted }),
  });
  if (!res.ok) throw new Error("Failed to update blacklist");
}

export async function deleteMember(id: number): Promise<void> {
  const res = await apiFetch(`/api/verification/members/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete member");
}

export async function deleteUnauthorized(): Promise<{ deleted: number }> {
  const res = await apiFetch("/api/verification/delete-unauthorized", { method: "POST" });
  if (!res.ok) throw new Error("Failed to delete unauthorized");
  return res.json();
}

export async function transferMembers(sourceGuildId: string): Promise<{ transferred: number; skipped: number }> {
  const res = await apiFetch("/api/verification/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_guild_id: sourceGuildId }),
  });
  if (!res.ok) throw new Error("Failed to transfer members");
  return res.json();
}

export async function fetchConfig(): Promise<VerificationConfig> {
  const res = await apiFetch("/api/verification/config");
  if (!res.ok) throw new Error("Failed to load config");
  return res.json();
}

export async function updateConfig(data: VerificationConfig): Promise<VerificationConfig> {
  const res = await apiFetch("/api/verification/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save config");
  return res.json();
}

export async function fetchStats(): Promise<VerificationStats> {
  const res = await apiFetch("/api/verification/stats");
  if (!res.ok) throw new Error("Failed to load stats");

export async function fetchGuildBot(): Promise<GuildBotConfig> {
  const res = await apiFetch("/api/verification/guild-bot");
  if (!res.ok) throw new Error("Failed to load guild bot config");
  return res.json();
}

export async function updateGuildBot(data: {
  client_id?: string;
  bot_token?: string;
  client_secret?: string;
  bot_name?: string;
  bot_avatar_url?: string;
}): Promise<{ ok: boolean }> {
  const res = await apiFetch("/api/verification/guild-bot", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save guild bot config");
  return res.json();
}

export async function validateGuildBot(): Promise<{ ok: boolean; bot_name?: string; bot_avatar_url?: string }> {
  const res = await apiFetch("/api/verification/guild-bot/validate", {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to validate guild bot");
  return res.json();
}

export async function deleteGuildBot(): Promise<{ ok: boolean }> {
  const res = await apiFetch("/api/verification/guild-bot", {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete guild bot");
  return res.json();
}


export async function fetchGuildBot(): Promise<GuildBotConfig> {
  const res = await apiFetch("/api/verification/guild-bot");
  if (!res.ok) throw new Error("Failed to load guild bot config");
  return res.json();
}

export async function updateGuildBot(data: { client_id?: string; bot_token?: string; client_secret?: string; bot_name?: string; bot_avatar_url?: string }): Promise<{ ok: boolean }> {
  const res = await apiFetch("/api/verification/guild-bot", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save guild bot config");
  return res.json();
}

export async function validateGuildBot(): Promise<{ ok: boolean; bot_name?: string; bot_avatar_url?: string }> {
  const res = await apiFetch("/api/verification/guild-bot/validate", { method: "POST" });
  if (!res.ok) throw new Error("Failed to validate guild bot token");
  return res.json();
}

export async function deleteGuildBot(): Promise<{ ok: boolean }> {
  const res = await apiFetch("/api/verification/guild-bot", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete guild bot config");
  return res.json();
}

  return res.json();
}

export async function startPull(data: { restore_roles: boolean; join_delay_seconds: number }): Promise<void> {
  const res = await apiFetch("/api/member-pull/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to start pull");
}

export async function stopPull(): Promise<void> {
  const res = await apiFetch("/api/member-pull/stop", { method: "POST" });
  if (!res.ok) throw new Error("Failed to stop pull");
}

export async function fetchPullStatus(): Promise<MemberPullStatus> {
  const res = await apiFetch("/api/member-pull/status");
  if (!res.ok) throw new Error("Failed to load pull status");
  return res.json();
}

export async function fetchPullHistory(): Promise<PullHistoryItem[]> {
  const res = await apiFetch("/api/member-pull/history");
  if (!res.ok) throw new Error("Failed to load pull history");
  return res.json();
}
