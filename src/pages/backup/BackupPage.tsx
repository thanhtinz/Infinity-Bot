import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Database, Download, RotateCcw, Trash2, Plus, Settings2, Clock,
  CheckCircle2, XCircle, Loader2, Save, Calendar, HardDrive,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/infinity";
import { PremiumBadge, PremiumGate } from "@/components/ui/premium-gate";
import { useEntitlements } from "@/hooks/useEntitlements";
import type { ServerBackupItem, BackupSchedule as BackupScheduleType } from "./shared";
import {
  fetchBackups, createBackup, deleteBackup, restoreBackup, downloadBackup,
  fetchSchedule, updateSchedule, formatBytes, formatDate,
} from "./shared";

// ── Backup type options ────────────────────────────────────────────────────
type BackupType = "all" | "bot_config";

const BACKUP_TYPE_OPTIONS: { value: BackupType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "all",              label: "All",             icon: <Database className="h-4 w-4" />,  desc: "Bot config + Discord structure" },
  { value: "bot_config",       label: "Bot Config",      icon: <Settings2 className="h-4 w-4" />, desc: "Settings, embeds, channels" },
];

function typeToPayload(t: BackupType) {
  return {
    include_bot_config:       t === "all" || t === "bot_config",
  };
}

// ── Status badge ───────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
  completed:   { cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: <CheckCircle2 className="h-3 w-3" />, label: "Completed" },
  failed:      { cls: "bg-red-500/15 text-red-500 border-red-500/30",             icon: <XCircle className="h-3 w-3" />,      label: "Failed" },
  in_progress: { cls: "bg-primary/15 text-primary border-primary/30",          icon: <Loader2 className="h-3 w-3 animate-spin" />, label: "In progress" },
};

// ── Main BackupPage ────────────────────────────────────────────────────────
export function BackupPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { hasFeature, isLoading: entLoading } = useEntitlements();

  // ── Create dialog ──
  const [createOpen, setCreateOpen] = useState(false);
  const [backupType, setBackupType] = useState<BackupType>("all");

  // ── Restore dialog ──
  const [restoreTarget, setRestoreTarget] = useState<ServerBackupItem | null>(null);
  const [restoreType, setRestoreType] = useState<BackupType>("all");

  // ── Delete confirm ──
  const [deleteTarget, setDeleteTarget] = useState<ServerBackupItem | null>(null);

  // ── Schedule form state ──
  const [scheduleForm, setScheduleForm] = useState<BackupScheduleType | null>(null);

  // ── Queries ──
  const backupsQuery = useQuery({ queryKey: ["server-backups"], queryFn: fetchBackups });
  const scheduleQuery = useQuery({ queryKey: ["server-backup-schedule"], queryFn: fetchSchedule });

  if (scheduleQuery.data && !scheduleForm) setScheduleForm(scheduleQuery.data);

  // ── Mutations ──
  const createMut = useMutation({
    mutationFn: (type: BackupType) => createBackup(typeToPayload(type)),
    onSuccess: () => {
      toast({ title: "Backup created" });
      qc.invalidateQueries({ queryKey: ["server-backups"] });
      setCreateOpen(false);
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const restoreMut = useMutation({
    mutationFn: (item: ServerBackupItem) => restoreBackup(item.id, {
      restore_bot_config:       restoreType === "all" || restoreType === "bot_config",
      restore_discord:          restoreType === "all",
    }),
    onSuccess: () => {
      toast({ title: "Restore complete" });
      setRestoreTarget(null);
    },
    onError: (e) => toast({ title: "Restore failed", description: (e as Error).message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteBackup(id),
    onSuccess: () => {
      toast({ title: "Backup deleted" });
      qc.invalidateQueries({ queryKey: ["server-backups"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const scheduleMut = useMutation({
    mutationFn: updateSchedule,
    onSuccess: () => {
      toast({ title: "Schedule saved" });
      qc.invalidateQueries({ queryKey: ["server-backup-schedule"] });
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const backups = backupsQuery.data ?? [];

  return (
    <PageContainer>
      <PageHeader title="Backup & Restore" icon={Database}>
        <PremiumBadge />
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Backup
        </Button>
      </PageHeader>

      <PremiumGate feature="scheduled_backup" featureLabel="Backup & Restore" hasAccess={hasFeature("scheduled_backup")} isLoading={entLoading}>
        <div className="space-y-6">

          {/* ── Backup list ── */}
          <div className="rounded-xl border border-border bg-card">
            <div className="px-5 py-3 border-b flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Backups</span>
              <Badge variant="secondary" className="ml-auto">{backups.length}</Badge>
            </div>

            {backupsQuery.isLoading ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : backups.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No backups yet
              </div>
            ) : (
              <div className="divide-y divide-border">
                {backups.map((b) => {
                  const s = STATUS_BADGE[b.status] ?? STATUS_BADGE.completed;
                  return (
                    <div key={b.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{formatDate(b.created_at)}</span>
                          <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${s.cls}`}>
                            {s.icon}{s.label}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {b.backup_type === "scheduled" ? "Auto" : "Manual"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[
                            b.config_count > 0  && `${b.config_count} configs`,
                            b.member_count > 0  && `${b.member_count} members`,
                            b.channel_count > 0 && `${b.channel_count} channels`,
                            b.role_count > 0    && `${b.role_count} roles`,
                          ].filter(Boolean).join(" · ")} · {formatBytes(b.size_bytes)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Download"
                          onClick={() => downloadBackup(b.id).catch(e => toast({ title: "Error", description: e.message, variant: "destructive" }))}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Restore"
                          onClick={() => { setRestoreTarget(b); setRestoreType("all"); }}>
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete"
                          onClick={() => setDeleteTarget(b)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Auto Schedule ── */}
          <div className="rounded-xl border border-border bg-card">
            <div className="px-5 py-3 border-b flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Auto Schedule</span>
            </div>
            {scheduleQuery.isLoading || !scheduleForm ? (
              <div className="p-4 space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Switch id="sched-enabled" checked={scheduleForm.enabled}
                    onCheckedChange={v => setScheduleForm(f => f && ({ ...f, enabled: v }))} />
                  <Label htmlFor="sched-enabled" className="text-sm font-medium">Enable automatic backups</Label>
                </div>

                {scheduleForm.enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Interval</Label>
                      <Select value={String(scheduleForm.interval_hours)}
                        onValueChange={v => setScheduleForm(f => f && ({ ...f, interval_hours: Number(v) }))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[6,12,24,48,72,168].map(h => (
                            <SelectItem key={h} value={String(h)}>
                              {h < 24 ? `${h}h` : h === 168 ? "1 week" : `${h/24}d`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Keep max backups</Label>
                      <Input type="number" min={1} max={50} className="h-9"
                        value={scheduleForm.max_backups}
                        onChange={e => setScheduleForm(f => f && ({ ...f, max_backups: Number(e.target.value) }))} />
                    </div>
                  </div>
                )}

                {scheduleForm.last_backup_at && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Last: {formatDate(scheduleForm.last_backup_at)}
                    {scheduleForm.next_backup_at && ` · Next: ${formatDate(scheduleForm.next_backup_at)}`}
                  </p>
                )}

                <Button size="sm" className="gap-2" onClick={() => scheduleMut.mutate(scheduleForm)} disabled={scheduleMut.isPending}>
                  {scheduleMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Schedule
                </Button>
              </div>
            )}
          </div>

        </div>
      </PremiumGate>

      {/* ── Create Backup Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Backup</DialogTitle>
            <DialogDescription>Choose what to include in this backup.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {BACKUP_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setBackupType(opt.value)}
                className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  backupType === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent"
                }`}
              >
                <span className={backupType === opt.value ? "text-primary" : "text-muted-foreground"}>{opt.icon}</span>
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
                {backupType === opt.value && <CheckCircle2 className="h-4 w-4 ml-auto text-primary" />}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate(backupType)} disabled={createMut.isPending} className="gap-2">
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Create Backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Restore Dialog ── */}
      <Dialog open={!!restoreTarget} onOpenChange={v => { if (!v) setRestoreTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Restore Backup</DialogTitle>
            <DialogDescription>
              {restoreTarget ? `From ${formatDate(restoreTarget.created_at)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {BACKUP_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setRestoreType(opt.value)}
                className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  restoreType === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent"
                }`}
              >
                <span className={restoreType === opt.value ? "text-primary" : "text-muted-foreground"}>{opt.icon}</span>
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
                {restoreType === opt.value && <CheckCircle2 className="h-4 w-4 ml-auto text-primary" />}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => restoreTarget && restoreMut.mutate(restoreTarget)} disabled={restoreMut.isPending} className="gap-2">
              {restoreMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup</AlertDialogTitle>
            <AlertDialogDescription>
              Delete backup from {deleteTarget ? formatDate(deleteTarget.created_at) : ""}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
