import { useState } from "react";
import type { ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import {
  Server,
  Clock,
  Calendar,
  Download,
  RotateCcw,
  Trash2,
  Plus,
  HardDrive,
  FolderOpen,
  Drama,
  Users,
  Settings2,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  History,
  ShieldCheck,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface ServerBackupItem {
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

interface CreateBackupResponse {
  id: number;
  status: string;
  config_count: number;
  member_count: number;
  size_bytes: number;
}

interface RestoreResponse {
  ok: boolean;
  restored: Record<string, number>;
  errors: Record<string, string>;
}

interface BackupSchedule {
  enabled: boolean;
  interval_hours: number;
  max_backups: number;
  include_messages: boolean;
  message_limit: number;
  include_bot_config: boolean;
  include_verified_members: boolean;
  last_backup_at: string | null;
  next_backup_at: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

const STATUS_BADGE: Record<string, { cls: string; icon: React.ReactNode }> = {
  completed: {
    cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  failed: {
    cls: "bg-red-500/15 text-red-600 border-red-500/30",
    icon: <XCircle className="h-3 w-3" />,
  },
  in_progress: {
    cls: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
};

// ── API ────────────────────────────────────────────────────────────────────

async function fetchBackups(): Promise<ServerBackupItem[]> {
  const res = await apiFetch("/api/server-backup");
  if (!res.ok) throw new Error("Failed to load backups");
  return res.json();
}

async function createBackup(data: {
  include_bot_config: boolean;
  include_verified_members: boolean;
}): Promise<CreateBackupResponse> {
  const res = await apiFetch("/api/server-backup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create backup");
  return res.json();
}

async function deleteBackup(id: number): Promise<void> {
  const res = await apiFetch(`/api/server-backup/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete backup");
}

async function restoreBackup(
  id: number,
  data: { restore_bot_config: boolean; restore_verified_members: boolean; restore_discord: boolean }
): Promise<RestoreResponse> {
  const res = await apiFetch(`/api/server-backup/${id}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Restore failed");
  return res.json();
}

async function downloadBackup(id: number): Promise<void> {
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

async function fetchSchedule(): Promise<BackupSchedule> {
  const res = await apiFetch("/api/server-backup/schedule");
  if (!res.ok) throw new Error("Failed to load schedule");
  return res.json();
}

async function updateSchedule(data: Partial<BackupSchedule>): Promise<BackupSchedule> {
  const res = await apiFetch("/api/server-backup/schedule", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update schedule");
  return res.json();
}

// ── Component ──────────────────────────────────────────────────────────────

export function ServerBackup() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Create dialog state ──
  const [createOpen, setCreateOpen] = useState(false);
  const [createIncludeBotConfig, setCreateIncludeBotConfig] = useState(true);
  const [createIncludeVerified, setCreateIncludeVerified] = useState(true);

  // ── Restore dialog state ──
  const [restoreTarget, setRestoreTarget] = useState<ServerBackupItem | null>(null);
  const [restoreBotConfig, setRestoreBotConfig] = useState(false);
  const [restoreVerified, setRestoreVerified] = useState(false);
  const [restoreDiscord, setRestoreDiscord] = useState(false);

  // ── Delete confirm ──
  const [deleteTarget, setDeleteTarget] = useState<ServerBackupItem | null>(null);

  // ── Schedule form ──
  const [scheduleForm, setScheduleForm] = useState<BackupSchedule | null>(null);

  // ── Queries ──
  const backupsQuery = useQuery({
    queryKey: ["server-backups"],
    queryFn: fetchBackups,
  });

  const scheduleQuery = useQuery({
    queryKey: ["server-backup-schedule"],
    queryFn: fetchSchedule,
  });

  // Initialize schedule form when data loads
  if (scheduleQuery.data && !scheduleForm) {
    setScheduleForm(scheduleQuery.data);
  }

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: createBackup,
    onSuccess: () => {
      toast({ title: "Backup created", description: "Server backup has been created successfully." });
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["server-backups"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBackup,
    onSuccess: () => {
      toast({ title: "Backup deleted" });
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["server-backups"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: (b: ServerBackupItem) =>
      restoreBackup(b.id, {
        restore_bot_config: restoreBotConfig,
        restore_verified_members: restoreVerified,
        restore_discord: restoreDiscord,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        const restored = Object.entries(result.restored)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        toast({ title: "Restore completed", description: restored || "All items restored." });
      } else {
        const errs = Object.entries(result.errors)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        toast({ title: "Restore completed with errors", description: errs, variant: "destructive" });
      }
      setRestoreTarget(null);
      qc.invalidateQueries({ queryKey: ["server-backups"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const scheduleMutation = useMutation({
    mutationFn: updateSchedule,
    onSuccess: () => {
      toast({ title: "Schedule saved", description: "Backup schedule has been updated." });
      qc.invalidateQueries({ queryKey: ["server-backup-schedule"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Handlers ──
  function handleSaveSchedule() {
    if (!scheduleForm) return;
    scheduleMutation.mutate(scheduleForm);
  }

  function openRestoreDialog(b: ServerBackupItem) {
    setRestoreTarget(b);
    setRestoreBotConfig(false);
    setRestoreVerified(false);
    setRestoreDiscord(false);
  }

  // ── Render ──
  return (
    <div className="space-y-6">
      <Tabs defaultValue="backups" className="space-y-4">
        <TabsList>
          <TabsTrigger value="backups" className="gap-1.5">
            <Server className="h-4 w-4" />
            Backups
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            Restore History
          </TabsTrigger>
        </TabsList>

        {/* ── Backups Tab ── */}
        <TabsContent value="backups" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Server Backup</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Create and manage full server backups including channels, roles, members, and configuration.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create Backup
            </Button>
          </div>

          {backupsQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          ) : !backupsQuery.data?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <HardDrive className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No backups yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Create your first server backup to protect your server's channels, roles, members, and configuration.
                </p>
                <Button className="mt-4 gap-1.5" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create Backup
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {backupsQuery.data.map((b) => {
                const statusInfo = STATUS_BADGE[b.status] ?? STATUS_BADGE.completed;
                return (
                  <Card key={b.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Header row */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium">
                              {formatDate(b.created_at)}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                b.backup_type === "manual"
                                  ? "bg-blue-500/15 text-blue-600 border-blue-500/30"
                                  : "bg-purple-500/15 text-purple-600 border-purple-500/30"
                              }
                            >
                              {b.backup_type === "manual" ? "Manual" : "Scheduled"}
                            </Badge>
                            <Badge variant="outline" className={statusInfo.cls}>
                              {statusInfo.icon}
                              <span className="ml-1 capitalize">{b.status.replace("_", " ")}</span>
                            </Badge>
                          </div>

                          {/* Stats row */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <FolderOpen className="h-3.5 w-3.5" /> {b.channel_count} Channels
                            </span>
                            <span className="flex items-center gap-1">
                              <Drama className="h-3.5 w-3.5" /> {b.role_count} Roles
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" /> {b.member_count} Members
                            </span>
                            <span className="flex items-center gap-1">
                              <Settings2 className="h-3.5 w-3.5" /> {b.config_count} Configs
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3.5 w-3.5" /> {b.message_count} Messages
                            </span>
                          </div>

                          {/* Error message */}
                          {b.error && (
                            <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> {b.error}
                            </p>
                          )}
                        </div>

                        {/* Size + Actions */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className="text-sm font-medium text-muted-foreground">
                            {formatBytes(b.size_bytes)}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => openRestoreDialog(b)}
                              disabled={b.status !== "completed"}
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Restore
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => downloadBackup(b.id)}
                              disabled={b.status !== "completed"}
                            >
                              <Download className="h-3.5 w-3.5" /> Download
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(b)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Schedule Tab ── */}
        <TabsContent value="schedule" className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Backup Schedule</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Configure automatic backup schedules to keep your server data safe.
            </p>
          </div>

          {scheduleQuery.isLoading || !scheduleForm ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 space-y-6">
                {/* Enable toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Enable Scheduled Backups</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically create backups at regular intervals
                    </p>
                  </div>
                  <Switch
                    checked={scheduleForm.enabled}
                    onCheckedChange={(v) =>
                      setScheduleForm({ ...scheduleForm, enabled: v })
                    }
                  />
                </div>

                <Separator />

                {/* Interval + Max backups */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Backup Interval</Label>
                    <Select
                      value={String(scheduleForm.interval_hours)}
                      onValueChange={(v) =>
                        setScheduleForm({ ...scheduleForm, interval_hours: Number(v) })
                      }
                      disabled={!scheduleForm.enabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6">Every 6 hours</SelectItem>
                        <SelectItem value="12">Every 12 hours</SelectItem>
                        <SelectItem value="24">Every 24 hours</SelectItem>
                        <SelectItem value="48">Every 48 hours</SelectItem>
                        <SelectItem value="72">Every 72 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Backups to Keep</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={scheduleForm.max_backups}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setScheduleForm({
                          ...scheduleForm,
                          max_backups: Number(e.target.value),
                        })
                      }
                      disabled={!scheduleForm.enabled}
                    />
                    <p className="text-xs text-muted-foreground">
                      Oldest backups will be automatically deleted when limit is reached
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Include options */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Include in Backup</Label>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Include Messages</Label>
                      <p className="text-xs text-muted-foreground">
                        Save recent messages from all channels
                      </p>
                    </div>
                    <Switch
                      checked={scheduleForm.include_messages}
                      onCheckedChange={(v) =>
                        setScheduleForm({ ...scheduleForm, include_messages: v })
                      }
                      disabled={!scheduleForm.enabled}
                    />
                  </div>

                  {scheduleForm.include_messages && (
                    <div className="ml-6 space-y-2">
                      <Label className="text-sm">Message Limit per Channel</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10000}
                        value={scheduleForm.message_limit}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setScheduleForm({
                            ...scheduleForm,
                            message_limit: Number(e.target.value),
                          })
                        }
                        disabled={!scheduleForm.enabled}
                        className="max-w-[200px]"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Include Bot Configuration</Label>
                      <p className="text-xs text-muted-foreground">
                        Save all bot settings and configurations
                      </p>
                    </div>
                    <Switch
                      checked={scheduleForm.include_bot_config}
                      onCheckedChange={(v) =>
                        setScheduleForm({ ...scheduleForm, include_bot_config: v })
                      }
                      disabled={!scheduleForm.enabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Include Verified Members</Label>
                      <p className="text-xs text-muted-foreground">
                        Save verified member data and verification records
                      </p>
                    </div>
                    <Switch
                      checked={scheduleForm.include_verified_members}
                      onCheckedChange={(v) =>
                        setScheduleForm({ ...scheduleForm, include_verified_members: v })
                      }
                      disabled={!scheduleForm.enabled}
                    />
                  </div>
                </div>

                <Separator />

                {/* Last / Next backup info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Last Backup</p>
                      <p className="text-sm font-medium">
                        {scheduleForm.last_backup_at
                          ? formatDate(scheduleForm.last_backup_at)
                          : "Never"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Next Backup</p>
                      <p className="text-sm font-medium">
                        {scheduleForm.next_backup_at
                          ? formatDate(scheduleForm.next_backup_at)
                          : "Not scheduled"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Save */}
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSaveSchedule}
                    disabled={scheduleMutation.isPending}
                    className="gap-1.5"
                  >
                    {scheduleMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Restore History Tab ── */}
        <TabsContent value="history" className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Restore History</h2>
            <p className="text-muted-foreground text-sm mt-1">
              View history of all restore operations performed on this server.
            </p>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ShieldCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No restore history</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Restore operations will appear here once you restore a backup.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Create Backup Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Server Backup</DialogTitle>
            <DialogDescription>
              Choose what to include in your backup. The backup will capture all channels, roles, and Discord structure by default.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Checkbox
                id="inc-bot-config"
                checked={createIncludeBotConfig}
                onCheckedChange={(v) => setCreateIncludeBotConfig(!!v)}
              />
              <div className="space-y-0.5">
                <Label htmlFor="inc-bot-config" className="text-sm font-medium cursor-pointer">
                  Include Bot Configuration
                </Label>
                <p className="text-xs text-muted-foreground">
                  All bot settings, feature configs, and custom commands
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="inc-verified"
                checked={createIncludeVerified}
                onCheckedChange={(v) => setCreateIncludeVerified(!!v)}
              />
              <div className="space-y-0.5">
                <Label htmlFor="inc-verified" className="text-sm font-medium cursor-pointer">
                  Include Verified Members
                </Label>
                <p className="text-xs text-muted-foreground">
                  Verified member records, emails, and verification metadata
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  include_bot_config: createIncludeBotConfig,
                  include_verified_members: createIncludeVerified,
                })
              }
              disabled={createMutation.isPending}
              className="gap-1.5"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Server className="h-4 w-4" />
              )}
              Create Backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Restore Dialog ── */}
      <Dialog
        open={!!restoreTarget}
        onOpenChange={(v) => { if (!v) setRestoreTarget(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Restore Backup
            </DialogTitle>
            <DialogDescription>
              Select what to restore from the backup created on{" "}
              {restoreTarget ? formatDate(restoreTarget.created_at) : ""}.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm text-destructive">
              <strong>Warning:</strong> Restoring will overwrite existing data. This action cannot be undone.
            </div>
          </div>

          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3">
              <Checkbox
                id="restore-discord"
                checked={restoreDiscord}
                onCheckedChange={(v) => setRestoreDiscord(!!v)}
              />
              <Label htmlFor="restore-discord" className="text-sm font-medium cursor-pointer">
                Discord Structure (Channels, Roles, Permissions)
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="restore-bot-config"
                checked={restoreBotConfig}
                onCheckedChange={(v) => setRestoreBotConfig(!!v)}
              />
              <Label htmlFor="restore-bot-config" className="text-sm font-medium cursor-pointer">
                Bot Configuration
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="restore-verified"
                checked={restoreVerified}
                onCheckedChange={(v) => setRestoreVerified(!!v)}
              />
              <Label htmlFor="restore-verified" className="text-sm font-medium cursor-pointer">
                Verified Members
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => restoreTarget && restoreMutation.mutate(restoreTarget)}
              disabled={
                restoreMutation.isPending ||
                (!restoreDiscord && !restoreBotConfig && !restoreVerified)
              }
              className="gap-1.5"
            >
              {restoreMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the backup from{" "}
              {deleteTarget ? formatDate(deleteTarget.created_at) : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
