import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { RotateCcw, Settings2, Users, MessageSquare, Loader2 } from "lucide-react";
import { BackupList } from "./BackupList";
import { BackupSchedule } from "./BackupSchedule";
import { BackupHistory } from "./BackupHistory";
import type { ServerBackupItem } from "./shared";
import { fetchBackups, formatDate, formatBytes } from "./shared";
import { PremiumBadge, PremiumGate } from "@/components/ui/premium-gate";
import { useEntitlements } from "@/hooks/useEntitlements";

// ── Restore API call ──────────────────────────────────────────────────────
async function restoreBackupApi(
  id: number,
  data: { restore_bot_config: boolean; restore_verified: boolean; restore_discord: boolean }
) {
  const res = await apiFetch(`/api/server-backup/${id}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Restore failed");
  return res.json();
}

// ── Valid tab values ──────────────────────────────────────────────────────
const VALID_TABS = ["backup", "restore", "schedule", "history"] as const;
type TabValue = (typeof VALID_TABS)[number];

function isValidTab(v: string | null): v is TabValue {
  return !!v && VALID_TABS.includes(v as TabValue);
}

// ── Restore Tab (inline) ─────────────────────────────────────────────────
function RestoreTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [confirmTarget, setConfirmTarget] = useState<ServerBackupItem | null>(null);
  const [restoreBotConfig, setRestoreBotConfig] = useState(true);
  const [restoreVerified, setRestoreVerified] = useState(true);
  const [restoreDiscord, setRestoreDiscord] = useState(true);

  const backupsQuery = useQuery({
    queryKey: ["server-backups"],
    queryFn: fetchBackups,
  });

  const restoreMutation = useMutation({
    mutationFn: (backup: ServerBackupItem) =>
      restoreBackupApi(backup.id, {
        restore_bot_config: restoreBotConfig,
        restore_verified: restoreVerified,
        restore_discord: restoreDiscord,
      }),
    onSuccess: () => {
      toast({ title: "Restore complete", description: "Backup has been restored successfully." });
      qc.invalidateQueries({ queryKey: ["server-backups"] });
      setConfirmTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Restore failed", description: err.message, variant: "destructive" });
    },
  });

  function openConfirm(backup: ServerBackupItem) {
    setRestoreBotConfig(true);
    setRestoreVerified(true);
    setRestoreDiscord(true);
    setConfirmTarget(backup);
  }

  const anyChecked = restoreBotConfig || restoreVerified || restoreDiscord;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <RotateCcw className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold tracking-tight">Restore</h2>
      </div>
      <p className="text-muted-foreground text-sm -mt-4">
        Restore a previous backup. Select which components to restore and confirm.
      </p>

      {/* Loading */}
      {backupsQuery.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty */}
      {backupsQuery.data && backupsQuery.data.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <RotateCcw className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No backups available</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Create a backup first, then you can restore it here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Backup cards */}
      {backupsQuery.data &&
        backupsQuery.data.map((backup) => (
          <Card key={backup.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {backup.backup_type === "manual" ? "Manual" : "Scheduled"} Backup
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {formatBytes(backup.size_bytes)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {formatDate(backup.created_at)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Stats */}
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Settings2 className="h-3.5 w-3.5" />
                    {backup.config_count} configs
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {backup.member_count} members
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {backup.message_count} messages
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => openConfirm(backup)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

      {/* ── Confirm AlertDialog ── */}
      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(v) => {
          if (!v) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Restore</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite current settings. Are you sure you want to restore the backup from{" "}
              {confirmTarget ? formatDate(confirmTarget.created_at) : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Restore options */}
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium">Select what to restore:</p>

            <div className="flex items-center gap-3">
              <Checkbox
                id="restore-bot-config"
                checked={restoreBotConfig}
                onCheckedChange={(v) => setRestoreBotConfig(!!v)}
              />
              <Label htmlFor="restore-bot-config" className="text-sm font-medium cursor-pointer">
                Bot Config
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

            <div className="flex items-center gap-3">
              <Checkbox
                id="restore-discord"
                checked={restoreDiscord}
                onCheckedChange={(v) => setRestoreDiscord(!!v)}
              />
              <Label htmlFor="restore-discord" className="text-sm font-medium cursor-pointer">
                Discord Settings
              </Label>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmTarget && restoreMutation.mutate(confirmTarget)}
              disabled={restoreMutation.isPending || !anyChecked}
            >
              {restoreMutation.isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Restoring…
                </span>
              ) : (
                "Restore"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Main BackupPage ───────────────────────────────────────────────────────
export function BackupPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasFeature, isLoading: entLoading } = useEntitlements();

  const tabParam = searchParams.get("tab");
  const activeTab: TabValue = isValidTab(tabParam) ? tabParam : "backup";

  function handleTabChange(value: string) {
    setSearchParams({ tab: value }, { replace: true });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Backup & Restore</h2>
        <PremiumBadge />
      </div>
      <PremiumGate
        feature="scheduled_backup"
        featureLabel="Backup & Restore"
        hasAccess={hasFeature("scheduled_backup")}
        isLoading={entLoading}
      >
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList>
            <TabsTrigger value="backup">Backup</TabsTrigger>
            <TabsTrigger value="restore">Restore</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="backup">
            <BackupList />
          </TabsContent>

          <TabsContent value="restore">
            <RestoreTab />
          </TabsContent>

          <TabsContent value="schedule">
            <BackupSchedule />
          </TabsContent>

          <TabsContent value="history">
            <BackupHistory />
          </TabsContent>
        </Tabs>
      </PremiumGate>
    </div>
  );
}
