import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGuild } from "@/contexts/GuildContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmojiTextarea } from "@/components/EmojiInput";
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
import { PageContainer, PageHeader } from "@/components/yuri";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";

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
  const { t } = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedGuildId } = useGuild();
  const [tab, setTab] = useState<Tab>("emoji");

  const [emojiUploadOpen, setEmojiUploadOpen] = useState(false);
  const [stickerUploadOpen, setStickerUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Emoji | null>(null);
  const [stickerDeleteTarget, setStickerDeleteTarget] = useState<StickerItem | null>(null);

  // ── Fetch emojis ──
  const { data: emojis = [], isLoading: emojisLoading } = useQuery<Emoji[]>({
    queryKey: ["discord-emojis", selectedGuildId],
    queryFn: () =>
      apiFetch("/api/discord/emojis").then((r) => {
        if (!r.ok) throw new Error("Failed to load emojis");
        return r.json();
      }),
    staleTime: 30_000,
    enabled: !!selectedGuildId,
  });

  // ── Fetch stickers ──
  const { data: stickers = [], isLoading: stickersLoading } = useQuery<StickerItem[]>({
    queryKey: ["discord-stickers", selectedGuildId],
    queryFn: () =>
      apiFetch("/api/discord/stickers").then((r) => {
        if (!r.ok) throw new Error("Failed to load stickers");
        return r.json();
      }),
    staleTime: 30_000,
    enabled: !!selectedGuildId,
  });

  const totalCount = emojis.length;
  const animatedCount = emojis.filter((e) => e.animated).length;
  const staticCount = totalCount - animatedCount;

  // ── Delete emoji mutation ──
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/discord/emojis/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast({ title: t("toast_emojiDeleted"), description: t("success") });
      queryClient.invalidateQueries({ queryKey: ["discord-emojis", selectedGuildId] });
      queryClient.invalidateQueries({ queryKey: ["managed-emojis"] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: t("error"), description: t("toast_emojiDeleteFailed"), variant: "destructive" });
    },
  });

  // ── Delete sticker mutation ──
  const deleteStickerMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/discord/stickers/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast({ title: t("toast_stickerDeleted"), description: t("success") });
      queryClient.invalidateQueries({ queryKey: ["discord-stickers", selectedGuildId] });
      setStickerDeleteTarget(null);
    },
    onError: () => {
      toast({ title: t("error"), description: t("toast_stickerDeleteFailed"), variant: "destructive" });
    },
  });

  // ── Sync emoji mutation ──
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/managed-emojis/sync", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: t("toast_syncSuccess"),
        description: t("emoji_syncAdded") + ` ${data.added} ` + t("emoji_syncAddedEmoji"),
      });
      queryClient.invalidateQueries({ queryKey: ["discord-emojis", selectedGuildId] });
      queryClient.invalidateQueries({ queryKey: ["managed-emojis"] });
    },
    onError: () => {
      toast({ title: t("error"), description: t("toast_emojiSyncFailed"), variant: "destructive" });
    },
  });

  // ── Copy usage ──
  const copyUsage = async (usage: string) => {
    try {
      await navigator.clipboard.writeText(usage);
      toast({ title: t("copied"), description: t("emoji_copiedUsagePrefix") + ` \`${usage}\` ` + t("emoji_copiedUsageSuffix") });
    } catch {
      toast({ title: t("error"), description: t("toast_couldNotCopy"), variant: "destructive" });
    }
  };

  return (
    <PageContainer size="lg">
      <PageHeader title={t("emoji_title")} description={t("emoji_desc")} icon={Smile}>
        {tab === "emoji" && (
          <>
            <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCw className={cn("h-4 w-4 mr-2", syncMutation.isPending && "animate-spin")} />
              {t("emoji_sync")}
            </Button>
            <Button onClick={() => setEmojiUploadOpen(true)}>
              <SmilePlus className="h-4 w-4 mr-2" />
              {t("emoji_addEmoji")}
            </Button>
          </>
        )}
        {tab === "sticker" && (
          <Button onClick={() => setStickerUploadOpen(true)}>
            <Sticker className="h-4 w-4 mr-2" />
            {t("emoji_addSticker")}
          </Button>
        )}
      </PageHeader>

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
          {t("emoji_emojiTab")}
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
          {t("emoji_stickers")}
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
              {totalCount} {t("emoji_emojiTab").toLowerCase()}
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1 bg-secondary/10 text-secondary dark:text-secondary/80 border-0">
              {animatedCount} {t("emoji_animated").toLowerCase()}
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1 bg-primary/10 text-primary dark:text-primary/80 border-0">
              {staticCount} {t("emoji_static").toLowerCase()}
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
              <p className="text-lg font-medium text-muted-foreground">{t("emoji_noEmojisYet")}</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                {t("emoji_addEmojiDesc")}
              </p>
              <Button variant="outline" onClick={() => setEmojiUploadOpen(true)}>
                <SmilePlus className="h-4 w-4 mr-2" />
                {t("emoji_addEmoji")}
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
                    <Badge className="absolute top-1 right-1 text-[10px] px-1 py-0 h-4 bg-secondary/80">GIF</Badge>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon" variant="ghost"
                      className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                      onClick={() => copyUsage(emoji.usage)}
                      title={t("copy")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-white/20"
                      onClick={() => setDeleteTarget(emoji)}
                      title={t("delete")}
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
              {stickers.length} {t("emoji_stickers").toLowerCase()}
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
              <p className="text-lg font-medium text-muted-foreground">{t("emoji_empty")}</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                {t("emoji_uploadSticker")} (PNG, APNG, GIF — 320×320px)
              </p>
              <Button variant="outline" onClick={() => setStickerUploadOpen(true)}>
                <Sticker className="h-4 w-4 mr-2" />
                {t("emoji_addSticker")}
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
                      title={t("delete")}
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
          queryClient.invalidateQueries({ queryKey: ["discord-emojis", selectedGuildId] });
          queryClient.invalidateQueries({ queryKey: ["managed-emojis"] });
        }}
      />

      {/* ── Sticker Upload Dialog ── */}
      <StickerUploadDialog
        open={stickerUploadOpen}
        onOpenChange={setStickerUploadOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["discord-stickers", selectedGuildId] });
        }}
      />

      {/* ── Delete Emoji Confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("emoji_deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              Emoji <code className="font-mono">:{deleteTarget?.name}:</code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Sticker Confirm ── */}
      <AlertDialog open={!!stickerDeleteTarget} onOpenChange={(open) => !open && setStickerDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("emoji_stickerDeleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              Sticker <strong>{stickerDeleteTarget?.name}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => stickerDeleteTarget && deleteStickerMutation.mutate(stickerDeleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
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
  const { t } = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);

  // Keep GIFs as-is; others resize to 128×128 via Canvas
  const prepareImageData = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const dataUri = reader.result as string;
        if (f.type === "image/gif") { resolve(dataUri); return; }
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const SIZE = 128;
          const canvas = document.createElement("canvas");
          canvas.width = SIZE; canvas.height = SIZE;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
          resolve(canvas.toDataURL("image/png"));
        };
        img.src = dataUri;
      };
      reader.readAsDataURL(f);
    });
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      const dataUri = await prepareImageData(file);
      const res = await apiFetch("/api/discord/emojis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, image_base64: dataUri }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("success"), description: t("toast_emojiAdded") });
      onSuccess();
      resetForm();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: t("error"), description: err.message || t("toast_emojiDeleteFailed"), variant: "destructive" });
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
          <DialogTitle>{t("emoji_addEmoji")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="emoji-name">{t("emoji_name")}</Label>
            <Input
              id="emoji-name"
              placeholder={t("emoji_namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
            />
            <p className="text-xs text-muted-foreground">
              {t("emoji_nameHint")}
            </p>
            {name.length > 0 && !/^[a-zA-Z0-9_]+$/.test(name) && (
              <p className="text-xs text-destructive">{t("emoji_nameCharsError")}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t("image")}</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">
              {t("emoji_fileHint")}
            </p>
            {sizeError && (
              <p className="text-xs text-destructive">{t("emoji_fileTooLarge256")}</p>
            )}
            {preview && (
              <div className="flex items-center gap-3 mt-2">
                <img src={preview} alt="Preview" className="h-16 w-16 rounded object-contain border bg-muted" />
                <span className="text-xs text-muted-foreground">{file?.name}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("emoji_limitWarning")}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => uploadMutation.mutate()} disabled={!canSubmit || uploadMutation.isPending}>
            {uploadMutation.isPending ? t("saving") : (
              <><Upload className="h-4 w-4 mr-2" />{t("emoji_upload")}</>
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
  const { t } = useT();
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
      const res = await apiFetch("/api/discord/stickers", {
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
        throw new Error(err.detail || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("success"), description: t("toast_stickerAdded") });
      onSuccess();
      resetForm();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: t("error"), description: err.message || t("toast_stickerDeleteFailed"), variant: "destructive" });
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
          <DialogTitle>{t("emoji_addSticker")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sticker-name">{t("emoji_stickerName")}</Label>
            <Input
              id="sticker-name"
              placeholder={t("emoji_stickerNamePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
            />
            <p className="text-xs text-muted-foreground">{t("emoji_stickerNameHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sticker-desc">{t("description")}</Label>
            <EmojiTextarea
              id="sticker-desc"
              placeholder={t("emoji_stickerDesc")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={100}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sticker-tags">{t("tags")}</Label>
            <Input
              id="sticker-tags"
              placeholder={t("emoji_stickerTagsPlaceholder")}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              {t("emoji_stickerTagsHint")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>{t("image")}</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/apng,image/gif"
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">
              {t("emoji_stickerFileHint")}
            </p>
            {sizeError && (
              <p className="text-xs text-destructive">{t("emoji_fileTooLarge512")}</p>
            )}
            {preview && (
              <div className="flex items-center gap-3 mt-2">
                <img src={preview} alt="Preview" className="h-20 w-20 rounded object-contain border bg-muted" />
                <span className="text-xs text-muted-foreground">{file?.name}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("emoji_stickerLimitWarning")}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => uploadMutation.mutate()} disabled={!canSubmit || uploadMutation.isPending}>
            {uploadMutation.isPending ? t("saving") : (
              <><Upload className="h-4 w-4 mr-2" />{t("emoji_upload")}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
