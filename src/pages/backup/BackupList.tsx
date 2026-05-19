import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Database,
  Server,

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
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/yuri";
import type { ServerBackupItem } from "./shared";
import {
  fetchBackups,
  createBackup,
  deleteBackup,
  restoreBackup,
  downloadBackup,
  formatBytes,
  formatDate,
} from "./shared";

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
    cls: "bg-primary/15 text-primary border-primary/30",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
};

export function BackupList() {
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

  // ── Queries ──
  const backupsQuery = useQuery({
    queryKey: ["server-backups"],
    queryFn: fetchBackups,
  });

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

  // ── Handlers ──
  function openRestoreDialog(b: ServerBackupItem) {
    setRestoreTarget(b);
    setRestoreBotConfig(false);
    setRestoreVerified(false);
    setRestoreDiscord(false);
  }

  return (
    <PageContainer>
      <PageHeader title="Server Backup" icon={Database} description="Create and manage full server backups including channels, roles, members, and configuration.">
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Create Backup
        </Button>
      </PageHeader>

      {/* Backup list */}
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
                              ? "bg-primary/15 text-primary border-primary/30"
                              : "bg-secondary/15 text-secondary border-purple-500/30"
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
    </PageContainer>
  );
}
