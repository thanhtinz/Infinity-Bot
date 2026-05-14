import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { SmilePlus, Copy, Trash2, Upload, ImageIcon, RefreshCw, Sticker, Smile } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Emoji {
  id: number;
  name: string;
  animated: boolean;
  url: string;
  usage: string;
}

interface StickerItem {
  id: string;
  name: string;
  description: string;
  tags: string;
  format_type: number;
  url: string;
}

type Tab = "emoji" | "sticker";

// ─── Main Component ──────────────────────────────────────────────────────────

export function EmojiManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("emoji");

  const [emojiUploadOpen, setEmojiUploadOpen] = useState(false);
  const [stickerUploadOpen, setStickerUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Emoji | null>(null);
  const [stickerDeleteTarget, setStickerDeleteTarget] = useState<StickerItem | null>(null);

  // ── Fetch emojis ──
  const { data: emojis = [], isLoading: emojisLoading } = useQuery<Emoji[]>({
    queryKey: ["discord-emojis"],
    queryFn: () =>
      fetch("/api/discord/emojis", { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to load emojis");
        return r.json();
      }),
    staleTime: 30_000,
  });

  // ── Fetch stickers ──
  const { data: stickers = [], isLoading: stickersLoading } = useQuery<StickerItem[]>({
    queryKey: ["discord-stickers"],
    queryFn: () =>
      fetch("/api/discord/stickers", { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to load stickers");
        return r.json();
      }),
    staleTime: 30_000,
  });

  const totalCount = emojis.length;
  const animatedCount = emojis.filter((e) => e.animated).length;
  const staticCount = totalCount - animatedCount;

  // ── Delete emoji mutation ──
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
      queryClient.invalidateQueries({ queryKey: ["managed-emojis"] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể xóa emoji.", variant: "destructive" });
    },
  });

  // ── Delete sticker mutation ──
  const deleteStickerMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/discord/stickers/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Xóa thất bại");
    },
    onSuccess: () => {
      toast({ title: "Đã xóa", description: "Sticker đã được xóa thành công." });
      queryClient.invalidateQueries({ queryKey: ["discord-stickers"] });
      setStickerDeleteTarget(null);
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể xóa sticker.", variant: "destructive" });
    },
  });

  // ── Sync emoji mutation ──
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/managed-emojis/sync", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Sync thất bại");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Đồng bộ thành công",
        description: `Đã thêm ${data.added} emoji mới vào danh sách quản lý.`,
      });
      queryClient.invalidateQueries({ queryKey: ["discord-emojis"] });
      queryClient.invalidateQueries({ queryKey: ["managed-emojis"] });
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể đồng bộ emoji.", variant: "destructive" });
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
          <h1 className="text-2xl font-bold tracking-tight">Emoji & Sticker</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Quản lý emoji và sticker tùy chỉnh cho server Discord
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "emoji" && (
            <>
              <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                <RefreshCw className={cn("h-4 w-4 mr-2", syncMutation.isPending && "animate-spin")} />
                Đồng bộ
              </Button>
              <Button onClick={() => setEmojiUploadOpen(true)}>
                <SmilePlus className="h-4 w-4 mr-2" />
                Thêm Emoji
              </Button>
            </>
          )}
          {tab === "sticker" && (
            <Button onClick={() => setStickerUploadOpen(true)}>
              <Sticker className="h-4 w-4 mr-2" />
              Thêm Sticker
            </Button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b">
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px",
            tab === "emoji"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("emoji")}
        >
          <Smile className="h-4 w-4" />
          Emoji
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
            {totalCount}
          </Badge>
        </button>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px",
            tab === "sticker"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("sticker")}
        >
          <Sticker className="h-4 w-4" />
          Sticker
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
            {stickers.length}
          </Badge>
        </button>
      </div>

      {/* ── EMOJI TAB ── */}
      {tab === "emoji" && (
        <>
          {/* Stats */}
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

          {/* Grid */}
          {emojisLoading ? (
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
              <Button variant="outline" onClick={() => setEmojiUploadOpen(true)}>
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
                  <img src={emoji.url} alt={emoji.name} className="h-12 w-12 rounded object-contain" />
                  <span className="text-xs font-mono text-muted-foreground truncate w-full text-center">
                    :{emoji.name}:
                  </span>
                  {emoji.animated && (
                    <Badge className="absolute top-1 right-1 text-[10px] px-1 py-0 h-4 bg-purple-500/80">GIF</Badge>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon" variant="ghost"
                      className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                      onClick={() => copyUsage(emoji.usage)}
                      title="Sao chép"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
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
        </>
      )}

      {/* ── STICKER TAB ── */}
      {tab === "sticker" && (
        <>
          {/* Stats */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {stickers.length} sticker
            </Badge>
          </div>

          {/* Grid */}
          {stickersLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-lg border">
                  <Skeleton className="h-24 w-24 rounded" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : stickers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Sticker className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Chưa có sticker nào</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Thêm sticker tùy chỉnh cho server (PNG, APNG, GIF — 320×320px)
              </p>
              <Button variant="outline" onClick={() => setStickerUploadOpen(true)}>
                <Sticker className="h-4 w-4 mr-2" />
                Thêm Sticker
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {stickers.map((sticker) => (
                <div
                  key={sticker.id}
                  className="group relative flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <img
                    src={sticker.url}
                    alt={sticker.name}
                    className="h-24 w-24 rounded object-contain"
                  />
                  <span className="text-xs font-medium truncate w-full text-center">
                    {sticker.name}
                  </span>
                  {sticker.tags && (
                    <span className="text-[11px] text-muted-foreground truncate w-full text-center">
                      {sticker.tags}
                    </span>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon" variant="ghost"
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-white/20"
                      onClick={() => setStickerDeleteTarget(sticker)}
                      title="Xóa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Emoji Upload Dialog ── */}
      <EmojiUploadDialog
        open={emojiUploadOpen}
        onOpenChange={setEmojiUploadOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["discord-emojis"] });
          queryClient.invalidateQueries({ queryKey: ["managed-emojis"] });
        }}
      />

      {/* ── Sticker Upload Dialog ── */}
      <StickerUploadDialog
        open={stickerUploadOpen}
        onOpenChange={setStickerUploadOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["discord-stickers"] });
        }}
      />

      {/* ── Delete Emoji Confirm ── */}
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

      {/* ── Delete Sticker Confirm ── */}
      <AlertDialog open={!!stickerDeleteTarget} onOpenChange={(open) => !open && setStickerDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa sticker?</AlertDialogTitle>
            <AlertDialogDescription>
              Sticker <strong>{stickerDeleteTarget?.name}</strong> sẽ bị xóa vĩnh viễn khỏi server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => stickerDeleteTarget && deleteStickerMutation.mutate(stickerDeleteTarget.id)}
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

// ─── Emoji Upload Dialog ─────────────────────────────────────────────────────

function EmojiUploadDialog({
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Upload thất bại");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Emoji đã được thêm vào server." });
      onSuccess();
      resetForm();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Lỗi", description: err.message || "Không thể upload emoji.", variant: "destructive" });
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
    if (!selected) { setFile(null); setPreview(null); setSizeError(false); return; }
    if (selected.size > 256 * 1024) { setSizeError(true); setFile(null); setPreview(null); return; }
    setSizeError(false);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const nameValid = /^[a-zA-Z0-9_]+$/.test(name) && name.length >= 2 && name.length <= 32;
  const canSubmit = nameValid && file && !sizeError;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm Emoji</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
              Chỉ chữ cái, số và dấu gạch dưới. 2–32 ký tự.
            </p>
            {name.length > 0 && !/^[a-zA-Z0-9_]+$/.test(name) && (
              <p className="text-xs text-destructive">Tên chỉ được chứa chữ cái, số và _</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Hình ảnh</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPEG, GIF, WebP — tối đa 256KB. File GIF sẽ thành emoji animated.
            </p>
            {sizeError && (
              <p className="text-xs text-destructive">File quá lớn. Kích thước tối đa 256KB.</p>
            )}
            {preview && (
              <div className="flex items-center gap-3 mt-2">
                <img src={preview} alt="Preview" className="h-16 w-16 rounded object-contain border bg-muted" />
                <span className="text-xs text-muted-foreground">{file?.name}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            ⚠️ Discord giới hạn 50 emoji thường và 50 emoji animated mỗi server (tăng theo Boost)
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => uploadMutation.mutate()} disabled={!canSubmit || uploadMutation.isPending}>
            {uploadMutation.isPending ? "Đang upload..." : (
              <><Upload className="h-4 w-4 mr-2" />Upload</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sticker Upload Dialog ───────────────────────────────────────────────────

function StickerUploadDialog({
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
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
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
      const res = await fetch("/api/discord/stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          description,
          tags: tags || name,
          file_base64: dataUri,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Upload thất bại");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Thành công", description: "Sticker đã được thêm vào server." });
      onSuccess();
      resetForm();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Lỗi", description: err.message || "Không thể upload sticker.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setTags("");
    setFile(null);
    setPreview(null);
    setSizeError(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) { setFile(null); setPreview(null); setSizeError(false); return; }
    if (selected.size > 512 * 1024) { setSizeError(true); setFile(null); setPreview(null); return; }
    setSizeError(false);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const nameValid = name.trim().length >= 2 && name.trim().length <= 30;
  const canSubmit = nameValid && file && !sizeError;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm Sticker</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sticker-name">Tên Sticker</Label>
            <Input
              id="sticker-name"
              placeholder="vd: happy_dance"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
            />
            <p className="text-xs text-muted-foreground">2–30 ký tự.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sticker-desc">Mô tả</Label>
            <Textarea
              id="sticker-desc"
              placeholder="Mô tả sticker (tuỳ chọn)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={100}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sticker-tags">Tags</Label>
            <Input
              id="sticker-tags"
              placeholder="vd: happy, dance, excited"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              Từ khoá gợi ý khi tìm sticker. Để trống sẽ dùng tên.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Hình ảnh</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/apng,image/gif"
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">
              PNG, APNG hoặc GIF — 320×320px, tối đa 512KB.
            </p>
            {sizeError && (
              <p className="text-xs text-destructive">File quá lớn. Kích thước tối đa 512KB.</p>
            )}
            {preview && (
              <div className="flex items-center gap-3 mt-2">
                <img src={preview} alt="Preview" className="h-20 w-20 rounded object-contain border bg-muted" />
                <span className="text-xs text-muted-foreground">{file?.name}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            ⚠️ Discord giới hạn 5 sticker mỗi server (tăng theo Boost: 15/30/60)
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => uploadMutation.mutate()} disabled={!canSubmit || uploadMutation.isPending}>
            {uploadMutation.isPending ? "Đang upload..." : (
              <><Upload className="h-4 w-4 mr-2" />Upload</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
