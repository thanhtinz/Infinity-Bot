import { apiFetch } from "@/hooks/useApi";
import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { useT } from "@/i18n";
import { PageContainer, PageHeader } from "@/components/yuri";
import {
  Database,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileJson,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BackupPreview {
  [tableName: string]: number;
}

interface RestoreResult {
  ok: boolean;
  restored: Record<string, number>;
  errors: Record<string, string>;
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchPreview(): Promise<BackupPreview> {
  const res = await apiFetch("/api/backup/preview", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load preview");
  return res.json();
}

async function restoreBackup(data: unknown): Promise<RestoreResult> {
  const res = await apiFetch("/api/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error("Restore failed");
  return res.json();
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BackupRestore() {
  const { t } = useT();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [backupData, setBackupData] = useState<unknown>(null);
  const [backupFileName, setBackupFileName] = useState<string>("");
  const [filePreview, setFilePreview] = useState<Record<string, number> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);

  // ── Queries ──

  const previewQuery = useQuery({
    queryKey: ["backup-preview"],
    queryFn: fetchPreview,
  });

  // ── Mutations ──

  const restoreMutation = useMutation({
    mutationFn: restoreBackup,
    onSuccess: (data) => {
      setRestoreResult(data);
      setConfirmOpen(false);
      if (data.ok) {
        toast({ title: t("toast_restoreSuccess") });
      } else {
        toast({ title: t("toast_restoreFailed"), variant: "destructive" });
      }
    },
    onError: (err: Error) =>
      toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  // ── Handlers ──

  const handleBackup = async () => {
    try {
      const res = await apiFetch("/api/backup", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load backup");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t("toast_backupDownloaded") });
    } catch (err) {
      toast({
        title: t("error"),
        description: err instanceof Error ? err.message : t("backup_loadFailed"),
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        setBackupData(json);
        setRestoreResult(null);

        // Build preview from the backup JSON
        const preview: Record<string, number> = {};
        if (json && typeof json === "object") {
          for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
            if (Array.isArray(value)) {
              preview[key] = value.length;
            } else if (typeof value === "object" && value !== null) {
              preview[key] = Object.keys(value).length;
            }
          }
        }
        setFilePreview(preview);
      } catch {
        toast({
          title: t("toast_invalidFile"),
          description: t("backup_selectValidJson"),
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = () => {
    if (!backupData) return;
    setConfirmOpen(true);
  };

  const confirmRestore = () => {
    if (!backupData) return;
    restoreMutation.mutate(backupData);
  };

  const resetRestore = () => {
    setBackupData(null);
    setBackupFileName("");
    setFilePreview(null);
    setRestoreResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Render ──

  return (
    <PageContainer>
      <PageHeader title={t("backup_title")} icon={Database} description={t("backup_desc")} />

      <div className="grid gap-6 md:grid-cols-2">
        {/* ── Card: Create Backup ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              {t("backup_createBackup")}
            </CardTitle>
            <CardDescription>
              {t("backup_createBackupDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleBackup} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              {t("backup_createBackup")}
            </Button>

            <Separator />

            {/* Preview summary from API */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {t("backup_dataWillBeBackedUp")}
              </p>
              {previewQuery.isLoading ? (
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-5 w-20 animate-pulse rounded bg-muted"
                    />
                  ))}
                </div>
              ) : previewQuery.data ? (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(previewQuery.data).map(([table, count]) => (
                    <Badge key={table} variant="secondary" className="text-xs">
                      {table}: {count}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("backup_couldNotLoadPreview")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Card: Restore ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-orange-500" />
              {t("backup_restore")}
            </CardTitle>
            <CardDescription>
              {t("backup_restoreDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File upload */}
            <label
              htmlFor="backup-upload"
              className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
            >
              <FileJson className="h-8 w-8 text-muted-foreground/50 mb-2" />
              {backupFileName ? (
                <span className="text-sm font-medium">{backupFileName}</span>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground">
                    {t("backup_uploadFile")}
                  </span>
                  <span className="text-xs text-muted-foreground/60 mt-1">
                    {t("backup_onlyJson")}
                  </span>
                </>
              )}
              <input
                id="backup-upload"
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {/* File preview */}
            {filePreview != null && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileJson className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t("backup_contentBackup")}</span>
                </div>
                <Separator />
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("backup_records")}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(filePreview).map(([key, count]) => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {key}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Restore result */}
            {restoreResult && (
              <div className="rounded-lg border p-4 space-y-3">
                {restoreResult.ok ? (
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">{t("backup_restoreSuccess")}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">{t("backup_restoreFailed")}</span>
                  </div>
                )}
                {Object.keys(restoreResult.restored).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(restoreResult.restored).map(([table, count]) => (
                      <Badge key={table} variant="secondary" className="text-xs text-green-600">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {table}: {count}
                      </Badge>
                    ))}
                  </div>
                )}
                {Object.keys(restoreResult.errors).length > 0 && (
                  <div className="space-y-1">
                    {Object.entries(restoreResult.errors).map(([table, msg]) => (
                      <p key={table} className="text-xs text-destructive">
                        <XCircle className="mr-1 inline h-3 w-3" />
                        {table}: {msg}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Warning + Actions */}
            {backupData != null && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-xs text-destructive">
                    {t("backup_willReplaceConfig")}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!backupData || restoreMutation.isPending}
                onClick={handleRestore}
              >
                {restoreMutation.isPending ? (
                  t("backup_restoring")
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {t("backup_restore")}
                  </>
                )}
              </Button>
              {backupData != null && (
                <Button variant="outline" onClick={resetRestore}>
                  {t("delete")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Confirm Restore AlertDialog ── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t("backup_confirmRestore")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("backup_confirmRestoreDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Show what will be restored inside the dialog */}
          {filePreview && (
            <div className="space-y-2 py-2">
              <p className="text-sm font-medium">{t("backup_dataToBeRestored")}:</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(filePreview).map(([key, count]) => (
                  <Badge key={key} variant="outline" className="text-xs">
                    {key}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMutation.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={restoreMutation.isPending}
              onClick={confirmRestore}
            >
              {restoreMutation.isPending ? t("backup_restoring") : t("backup_restore")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
