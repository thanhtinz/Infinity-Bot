import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Database,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileJson,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BackupPreview {
  guild_id: string;
  created_at: string;
  summary: Record<string, number>;
}

interface RestoreResult {
  ok: boolean;
  restored: string[];
  errors: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BACKUP_ITEMS = [
  "AutoMod",
  "Starboard",
  "Reaction Roles",
  "Custom Commands",
  "Scheduled Messages",
  "Sticky Messages",
  "Embeds",
  "Welcome",
  "Auto Role",
  "Button Roles",
  "Select Roles",
  "Logging",
  "Ticket Config",
  "Ticket Panels",
];

// ─── API ─────────────────────────────────────────────────────────────────────

async function downloadBackup(): Promise<Blob> {
  const res = await fetch("/api/backup", { credentials: "include" });
  if (!res.ok) throw new Error("Tải backup thất bại");
  return res.blob();
}

async function previewBackup(data: unknown): Promise<BackupPreview> {
  const res = await fetch("/api/backup/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Xem trước thất bại");
  return res.json();
}

async function restoreBackup(data: unknown): Promise<RestoreResult> {
  const res = await fetch("/api/backup/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Khôi phục thất bại");
  return res.json();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function extractFilename(res: Response): string {
  const disposition = res.headers.get("Content-Disposition");
  if (disposition) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match?.[1]) return match[1].replace(/['"]/g, "");
  }
  return `backup-${new Date().toISOString().slice(0, 10)}.json`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BackupRestore() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [backupJson, setBackupJson] = useState<unknown>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);

  // ── Mutations ──

  const backupMutation = useMutation({
    mutationFn: downloadBackup,
    onSuccess: async (blob, _vars, fetchRes) => {
      // Get filename from the raw response if possible
      let filename = `backup-${new Date().toISOString().slice(0, 10)}.json`;
      try {
        // Re-fetch just to get headers — not ideal but the blob is already consumed
        // Actually, we already have the blob, just use default name
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Backup đã được tải xuống" });
      } catch {
        toast({ title: "Lỗi khi tải file", variant: "destructive" });
      }
    },
    onError: (err: Error) =>
      toast({ title: "Lỗi", description: err.message, variant: "destructive" }),
  });

  const previewMutation = useMutation({
    mutationFn: previewBackup,
    onSuccess: (data) => {
      setPreview(data);
    },
    onError: (err: Error) =>
      toast({ title: "Lỗi", description: err.message, variant: "destructive" }),
  });

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

  async function handleBackup() {
    // We need the raw Response to extract filename from Content-Disposition
    const res = await fetch("/api/backup", { credentials: "include" });
    if (!res.ok) throw new Error("Tải backup thất bại");
    const filename = extractFilename(res);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Backup đã được tải xuống" });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        setBackupJson(json);
        setRestoreResult(null);
        previewMutation.mutate(json);
      } catch {
        toast({ title: "File không hợp lệ", description: "Vui lòng chọn file JSON hợp lệ", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  }

  function handleRestore() {
    if (!backupJson) return;
    setConfirmOpen(true);
  }

  function confirmRestore() {
    if (!backupJson) return;
    restoreMutation.mutate(backupJson);
  }

  function resetRestore() {
    setBackupJson(null);
    setPreview(null);
    setRestoreResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
          <Database className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sao lưu & Khôi phục</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý backup và khôi phục cấu hình bot
          </p>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* ── Left: Backup ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-500" />
              Sao lưu
            </CardTitle>
            <CardDescription>
              Tạo bản sao lưu toàn bộ cấu hình bot. File backup chứa tất cả dữ liệu cần thiết để khôi phục.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleBackup}
              disabled={backupMutation.isPending}
              className="w-full"
            >
              {backupMutation.isPending ? (
                "Đang tạo..."
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Tạo Backup
                </>
              )}
            </Button>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Bao gồm:</p>
              <div className="flex flex-wrap gap-1.5">
                {BACKUP_ITEMS.map((item) => (
                  <Badge key={item} variant="secondary" className="text-xs">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Right: Restore ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-orange-500" />
              Khôi phục
            </CardTitle>
            <CardDescription>
              Tải lên file backup để khôi phục cấu hình. Thao tác này sẽ thay thế toàn bộ cấu hình hiện tại.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File upload */}
            <div className="space-y-2">
              <label
                htmlFor="backup-upload"
                className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
              >
                <FileJson className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <span className="text-sm text-muted-foreground">
                  Tải lên file backup
                </span>
                <span className="text-xs text-muted-foreground/60 mt-1">
                  Chỉ chấp nhận file .json
                </span>
                <input
                  id="backup-upload"
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </div>

            {/* Preview */}
            {previewMutation.isPending && (
              <div className="rounded-lg border p-4 space-y-2 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            )}

            {preview && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Xem trước</span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guild ID</span>
                    <span className="font-mono text-xs">{preview.guild_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ngày tạo</span>
                    <span>{formatDateTime(preview.created_at)}</span>
                  </div>
                </div>
                <Separator />
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Số lượng bản ghi:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(preview.summary).map(([key, count]) => (
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
                {restoreResult.restored.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {restoreResult.restored.map((item) => (
                      <Badge key={item} variant="secondary" className="text-xs text-green-600">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {item}
                      </Badge>
                    ))}
                  </div>
                )}
                {restoreResult.errors.length > 0 && (
                  <div className="space-y-1">
                    {restoreResult.errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive">{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!backupJson || restoreMutation.isPending}
                onClick={handleRestore}
              >
                {restoreMutation.isPending ? (
                  "Đang khôi phục..."
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Khôi phục cấu hình
                  </>
                )}
              </Button>
              {backupJson && (
                <Button variant="outline" onClick={resetRestore}>
                  Xóa
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Confirm Restore Dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Xác nhận khôi phục
            </DialogTitle>
            <DialogDescription>
              Thao tác này sẽ thay thế toàn bộ cấu hình hiện tại. Bạn chắc chứ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={restoreMutation.isPending}
              onClick={confirmRestore}
            >
              {restoreMutation.isPending ? "Đang khôi phục..." : "Khôi phục"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
