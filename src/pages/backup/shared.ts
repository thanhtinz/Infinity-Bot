// ── Shared types for Server Backup pages ──────────────────────────────────

export interface ServerBackupItem {
  id: number;
  backup_type: "manual" | "scheduled";
  status: "completed" | "failed" | "in_progress";
  channel_count: number;
  role_count: number;
  member_count: number;
  config_count: number;
  message_count: number;
  size_bytes: number;
  error: string | null;
  created_at: string;
}

export interface CreateBackupResponse {
  id: number;
  status: string;
  config_count: number;
  member_count: number;
  size_bytes: number;
}

export interface RestoreResponse {
  ok: boolean;
  restored: Record<string, number>;
  errors: Record<string, string>;
}

export interface BackupSchedule {
  enabled: boolean;
  interval_hours: number;
  max_backups: number;
  include_messages: boolean;
  message_limit: number;
  include_bot_config: boolean;
  last_backup_at: string | null;
  next_backup_at: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

// ── API ────────────────────────────────────────────────────────────────────

import { apiFetch } from "@/hooks/useApi";

export async function fetchBackups(): Promise<ServerBackupItem[]> {
  const res = await apiFetch("/api/server-backup");
  if (!res.ok) throw new Error("Failed to load backups");
  return res.json();
}

export async function createBackup(data: {
  include_bot_config: boolean;
}): Promise<CreateBackupResponse> {
  const res = await apiFetch("/api/server-backup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create backup");
  return res.json();
}

export async function deleteBackup(id: number): Promise<void> {
  const res = await apiFetch(`/api/server-backup/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete backup");
}

export async function restoreBackup(
  id: number,
  data: { restore_bot_config: boolean; restore_discord: boolean }
): Promise<RestoreResponse> {
  const res = await apiFetch(`/api/server-backup/${id}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Restore failed");
  return res.json();
}

export async function downloadBackup(id: number): Promise<void> {
  const res = await apiFetch(`/api/server-backup/${id}/download`);
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `server-backup-${id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchSchedule(): Promise<BackupSchedule> {
  const res = await apiFetch("/api/server-backup/schedule");
  if (!res.ok) throw new Error("Failed to load schedule");
  return res.json();
}

export async function updateSchedule(data: Partial<BackupSchedule>): Promise<BackupSchedule> {
  const res = await apiFetch("/api/server-backup/schedule", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update schedule");
  return res.json();
}
