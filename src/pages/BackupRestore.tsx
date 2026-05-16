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
  const res = await fetch("/api/backup/preview", { credentials: "include" });
  if (!res.ok) throw new Error("Tải xem trước thất bại");
  return res.json();
}

async function restoreBackup(data: unknown): Promise<RestoreResult> {
  const res = await fetch("/api/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error("Khôi phục thất bại");
  return res.json();
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BackupRestore() {
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
        toast({ title: "Khôi phục thành công" });
      } else {
        toast({ title: "Khôi phục có lỗi", variant: "destructive" });
      }
    },
    onError: (err: Error) =>
      toast({ title: "Lỗi", description: err.message, variant: "destructive" }),
  });

  // ── Handlers ──

  const handleBackup = async () => {
    try {
      const res = await fetch("/api/backup", { credentials: "include" });
      if (!res.ok) throw new Error("Tải backup thất bại");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup đã được tải xuống" });
    } catch (err) {
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Tải backup thất bại",
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
          title: "File không hợp lệ",
          description: "Vui lòng chọn file JSON hợp lệ",
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
          <Database className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backup & Restore</h1>
          <p className="text-sm text-muted-foreground">
            Sao lưu và khôi phục cấu hình server
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ── Card: Tạo Backup ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-500" />
              Tạo Backup
            </CardTitle>
            <CardDescription>
              Tạo bản sao lưu toàn bộ cấu hình server dưới dạng file JSON.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleBackup} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Tạo Backup
            </Button>

            <Separator />

            {/* Preview summary from API */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Dữ liệu sẽ được sao lưu:
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
                  Không thể tải xem trước
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Card: Khôi phục ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-orange-500" />
              Khôi phục
            </CardTitle>
            <CardDescription>
              Tải lên file backup JSON để khôi phục cấu hình server.
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
                    Tải lên file backup
                  </span>
                  <span className="text-xs text-muted-foreground/60 mt-1">
                    Chỉ chấp nhận file .json
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
                  <span className="text-sm font-medium">Nội dung backup</span>
                </div>
                <Separator />
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Số lượng bản ghi:
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
                    <span className="text-sm font-medium">Khôi phục thành công</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Khôi phục có lỗi</span>
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
                    Thao tác này sẽ thay thế toàn bộ cấu hình hiện tại.
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
                  "Đang khôi phục..."
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Khôi phục
                  </>
                )}
              </Button>
              {backupData != null && (
                <Button variant="outline" onClick={resetRestore}>
                  Xóa
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
              Xác nhận khôi phục
            </AlertDialogTitle>
            <AlertDialogDescription>
              Thao tác này sẽ thay thế toàn bộ cấu hình hiện tại. Bạn chắc chứ?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Show what will be restored inside the dialog */}
          {filePreview && (
            <div className="space-y-2 py-2">
              <p className="text-sm font-medium">Dữ liệu sẽ được khôi phục:</p>
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
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={restoreMutation.isPending}
              onClick={confirmRestore}
            >
              {restoreMutation.isPending ? "Đang khôi phục..." : "Khôi phục"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
