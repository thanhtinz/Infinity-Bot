import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { SmilePlus, Copy, Trash2, Upload, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Emoji {
  id: number;
  name: string;
  animated: boolean;
  url: string;
  usage: string;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function EmojiManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Emoji | null>(null);

  // ── Fetch emojis ──
  const { data: emojis = [], isLoading } = useQuery<Emoji[]>({
    queryKey: ["discord-emojis"],
    queryFn: () =>
      fetch("/api/discord/emojis", { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to load emojis");
        return r.json();
      }),
    staleTime: 30_000,
  });

  const totalCount = emojis.length;
  const animatedCount = emojis.filter((e) => e.animated).length;
  const staticCount = totalCount - animatedCount;

  // ── Delete mutation ──
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/discord/emojis/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Xóa thất bại");
    },
    onSuccess: () => {
      toast({ title: "Đã xóa", description: "Emoji đã được xóa thành công." });
      queryClient.invalidateQueries({ queryKey: ["discord-emojis"] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể xóa emoji.", variant: "destructive" });
    },
  });

  // ── Copy usage ──
  const copyUsage = async (usage: string) => {
    try {
      await navigator.clipboard.writeText(usage);
      toast({ title: "Đã sao chép", description: `\`${usage}\` đã được copy.` });
    } catch {
      toast({ title: "Lỗi", description: "Không thể sao chép.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Emoji Server</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Quản lý emoji tùy chỉnh cho server Discord
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <SmilePlus className="h-4 w-4 mr-2" />
          Thêm Emoji
        </Button>
      </div>

      {/* ── Stats row ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {totalCount} emoji
        </Badge>
        <Badge variant="secondary" className="text-sm px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-0">
          {animatedCount} animated
        </Badge>
        <Badge variant="secondary" className="text-sm px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">
          {staticCount} static
        </Badge>
      </div>

      {/* ── Emoji Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-lg border">
              <Skeleton className="h-12 w-12 rounded" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      ) : emojis.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Chưa có emoji nào</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Thêm emoji tùy chỉnh để sử dụng trong server
          </p>
          <Button variant="outline" onClick={() => setUploadOpen(true)}>
            <SmilePlus className="h-4 w-4 mr-2" />
            Thêm Emoji
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {emojis.map((emoji) => (
            <div
              key={emoji.id}
              className="group relative flex flex-col items-center gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <img
                src={emoji.url}
                alt={emoji.name}
                className="h-12 w-12 rounded object-contain"
              />
              <span className="text-xs font-mono text-muted-foreground truncate w-full text-center">
                :{emoji.name}:
              </span>

              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                  onClick={() => copyUsage(emoji.usage)}
                  title="Sao chép"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-white/20"
                  onClick={() => setDeleteTarget(emoji)}
                  title="Xóa"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Upload Dialog ── */}
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["discord-emojis"] })}
      />

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa emoji?</AlertDialogTitle>
            <AlertDialogDescription>
              Emoji <code className="font-mono">:{deleteTarget?.name}:</code> sẽ bị xóa vĩnh viễn khỏi server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Upload Dialog ───────────────────────────────────────────────────────────

function UploadDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");

      const reader = new FileReader();
      const dataUri = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/discord/emojis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, image_base64: dataUri }),
      });
      if (!res.ok) throw new Error("Upload thất bại");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Emoji đã được thêm vào server." });
      onSuccess();
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể upload emoji.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setName("");
    setFile(null);
    setPreview(null);
    setSizeError(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      setPreview(null);
      setSizeError(false);
      return;
    }

    if (selected.size > 256 * 1024) {
      setSizeError(true);
      setFile(null);
      setPreview(null);
      return;
    }

    setSizeError(false);
    setFile(selected);
    const url = URL.createObjectURL(selected);
    setPreview(url);
  };

  const nameValid = /^[a-zA-Z0-9_]+$/.test(name) && name.length > 0 && name.length <= 32;
  const canSubmit = nameValid && file && !sizeError;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm Emoji</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="emoji-name">Tên Emoji</Label>
            <Input
              id="emoji-name"
              placeholder="vd: cool_cat"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
            />
            <p className="text-xs text-muted-foreground">
              Chỉ chữ cái, số và dấu gạch dưới. Tối đa 32 ký tự.
            </p>
            {name.length > 0 && !/^[a-zA-Z0-9_]+$/.test(name) && (
              <p className="text-xs text-destructive">Tên chỉ được chứa chữ cái, số và _</p>
            )}
          </div>

          {/* File upload */}
          <div className="space-y-1.5">
            <Label>Hình ảnh</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleFileChange}
            />
            {sizeError && (
              <p className="text-xs text-destructive">
                File quá lớn. Kích thước tối đa 256KB.
              </p>
            )}
            {preview && (
              <div className="flex items-center gap-3 mt-2">
                <img
                  src={preview}
                  alt="Preview"
                  className="h-16 w-16 rounded object-contain border bg-muted"
                />
                <span className="text-xs text-muted-foreground">{file?.name}</span>
              </div>
            )}
          </div>

          {/* Note */}
          <p className="text-xs text-muted-foreground">
            ⚠️ Discord giới hạn 50 emoji thường và 50 emoji animated mỗi server
          </p>
        </div>

        <DialogFooter>
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={!canSubmit || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              "Đang upload..."
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
