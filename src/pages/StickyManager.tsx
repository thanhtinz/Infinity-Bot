import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ChannelSelect } from "@/components/ChannelSelect";
import { EmojiPicker } from "@/components/EmojiPicker";
import {
  Pin,
  CheckCircle,
  RefreshCw,
  Image,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Power,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESET_COLORS = ["#5865F2", "#57f287", "#fee75c", "#ed4245", "#eb459e", "#2b2d31"];

// ─── Types ───────────────────────────────────────────────────────────────────

interface StickyMessage {
  id: number;
  guild_id: string;
  channel_id: string;
  content?: string;
  embed_enabled: boolean;
  embed_title?: string;
  embed_description?: string;
  embed_color: string;
  embed_footer?: string;
  embed_image_url?: string;
  embed_thumbnail_url?: string;
  message_count_trigger: number;
  interval_minutes: number;
  is_enabled: boolean;
  is_pinned: boolean;
  resend_count: number;
  created_at?: string;
  last_sent?: string;
  expires_at?: string;
}

interface StickyStats {
  total: number;
  active: number;
  total_resends: number;
  embed_count: number;
  pinned_count: number;
}

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

interface FormState {
  channel_id: string;
  content: string;
  embed_enabled: boolean;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  embed_footer: string;
  embed_image_url: string;
  embed_thumbnail_url: string;
  message_count_trigger: number;
  interval_minutes: number;
  is_pinned: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMPTY_FORM: FormState = {
  channel_id: "",
  content: "",
  embed_enabled: false,
  embed_title: "",
  embed_description: "",
  embed_color: "#5865F2",
  embed_footer: "",
  embed_image_url: "",
  embed_thumbnail_url: "",
  message_count_trigger: 1,
  interval_minutes: 0,
  is_pinned: false,
};

function formatTime(s?: string) {
  if (!s) return "Chưa gửi";
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(s?: string, len = 80) {
  if (!s) return "";
  return s.length > len ? s.slice(0, len) + "…" : s;
}

// ─── DiscordPreview ──────────────────────────────────────────────────────────

function DiscordPreview({ form }: { form: FormState }) {
  const DISCORD_BG = "#2b2d31";
  const DISCORD_TEXT = "#dbdee1";
  const DISCORD_MUTED = "#949ba4";

  return (
    <div
      className="rounded-md overflow-hidden text-sm"
      style={{ backgroundColor: DISCORD_BG }}
    >
      {/* Channel header mock */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        <Hash className="h-3.5 w-3.5" style={{ color: DISCORD_MUTED }} />
        <span
          className="text-xs font-semibold"
          style={{ color: DISCORD_TEXT }}
        >
          sticky-channel
        </span>
      </div>

      {/* Message */}
      <div className="px-3 pb-3 pt-1">
        <div className="flex items-start gap-2.5">
          {/* Bot avatar */}
          <div
            className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: "#5865F2", color: "#fff" }}
          >
            B
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-semibold text-xs"
                style={{ color: "#5865F2" }}
              >
                Bot
              </span>
              <span className="text-[10px]" style={{ color: DISCORD_MUTED }}>
                Hôm nay lúc 12:00
              </span>
            </div>

            {/* Plain text content */}
            {form.content && (
              <p className="text-xs mt-1" style={{ color: DISCORD_TEXT }}>
                {form.content}
              </p>
            )}

            {/* Embed */}
            {form.embed_enabled &&
              (form.embed_title || form.embed_description) && (
                <div
                  className="mt-1.5 rounded overflow-hidden max-w-[360px]"
                  style={{ backgroundColor: DISCORD_BG }}
                >
                  <div className="flex">
                    <div
                      className="w-1 shrink-0 rounded-l"
                      style={{
                        backgroundColor: form.embed_color || "#5865F2",
                      }}
                    />
                    <div className="p-2.5 flex-1 min-w-0">
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          {form.embed_title && (
                            <p
                              className="font-semibold text-[13px] leading-tight"
                              style={{ color: DISCORD_TEXT }}
                            >
                              {form.embed_title}
                            </p>
                          )}
                          {form.embed_description && (
                            <p
                              className="text-xs mt-1 whitespace-pre-wrap leading-relaxed"
                              style={{ color: DISCORD_MUTED }}
                            >
                              {form.embed_description}
                            </p>
                          )}
                        </div>
                        {/* Thumbnail */}
                        {form.embed_thumbnail_url && (
                          <img
                            src={form.embed_thumbnail_url}
                            className="h-14 w-14 rounded object-cover shrink-0"
                            alt=""
                          />
                        )}
                      </div>
                      {/* Image */}
                      {form.embed_image_url && (
                        <img
                          src={form.embed_image_url}
                          className="mt-2 rounded max-h-40 w-full object-cover"
                          alt=""
                        />
                      )}
                      {/* Footer */}
                      {form.embed_footer && (
                        <p
                          className="text-[10px] mt-2 opacity-70"
                          style={{ color: DISCORD_MUTED }}
                        >
                          {form.embed_footer}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StickyManager() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StickyMessage | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Auto-reset confirm delete after 3s
  useEffect(() => {
    if (confirmDeleteId === null) return;
    const t = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmDeleteId]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: stickies = [], isLoading: loadingStickies } = useQuery<
    StickyMessage[]
  >({
    queryKey: ["sticky"],
    queryFn: () =>
      fetch("/api/sticky", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: stats, isLoading: loadingStats } = useQuery<StickyStats>({
    queryKey: ["sticky-stats"],
    queryFn: () =>
      fetch("/api/sticky/stats", { credentials: "include" }).then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  });

  const { data: channels = [] } = useQuery<DiscordChannel[]>({
    queryKey: ["discord-channels-all"],
    queryFn: () =>
      fetch("/api/discord/channels/all", { credentials: "include" }).then(
        (r) => r.json()
      ),
    staleTime: 120_000,
  });

  const textChannels = channels.filter((c) => c.type === 0);

  const channelName = useCallback(
    (id: string) => {
      const ch = textChannels.find((c) => c.id === id);
      return ch ? ch.name : null;
    },
    [textChannels]
  );

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: FormState) =>
      fetch("/api/sticky", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sticky"] });
      qc.invalidateQueries({ queryKey: ["sticky-stats"] });
      setDialogOpen(false);
      toast({ title: "Đã tạo sticky." });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Partial<FormState>) =>
      fetch(`/api/sticky/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sticky"] });
      qc.invalidateQueries({ queryKey: ["sticky-stats"] });
      setDialogOpen(false);
      toast({ title: "Đã cập nhật sticky." });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/sticky/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sticky"] });
      qc.invalidateQueries({ queryKey: ["sticky-stats"] });
      setConfirmDeleteId(null);
      toast({ title: "Đã xóa sticky." });
    },
    onError: () =>
      toast({ variant: "destructive", title: "Lỗi khi xóa sticky." }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_enabled }: { id: number; is_enabled: boolean }) =>
      fetch(`/api/sticky/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_enabled }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onMutate: async ({ id, is_enabled }) => {
      await qc.cancelQueries({ queryKey: ["sticky"] });
      const prev = qc.getQueryData<StickyMessage[]>(["sticky"]);
      qc.setQueryData<StickyMessage[]>(["sticky"], (old) =>
        old?.map((s) => (s.id === id ? { ...s, is_enabled } : s))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["sticky"], ctx.prev);
      toast({ variant: "destructive", title: "Lỗi khi chuyển trạng thái." });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sticky"] });
      qc.invalidateQueries({ queryKey: ["sticky-stats"] });
    },
  });

  const resendMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/sticky/${id}/resend`, {
        method: "POST",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sticky"] });
      qc.invalidateQueries({ queryKey: ["sticky-stats"] });
      toast({ title: "Đã gửi lại sticky." });
    },
    onError: () =>
      toast({ variant: "destructive", title: "Lỗi khi gửi lại." }),
  });

  // ── Dialog helpers ───────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (s: StickyMessage) => {
    setEditing(s);
    setForm({
      channel_id: s.channel_id,
      content: s.content ?? "",
      embed_enabled: s.embed_enabled,
      embed_title: s.embed_title ?? "",
      embed_description: s.embed_description ?? "",
      embed_color: s.embed_color || "#5865F2",
      embed_footer: s.embed_footer ?? "",
      embed_image_url: s.embed_image_url ?? "",
      embed_thumbnail_url: s.embed_thumbnail_url ?? "",
      message_count_trigger: s.message_count_trigger,
      interval_minutes: s.interval_minutes,
      is_pinned: s.is_pinned,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  // ── Stat cards ───────────────────────────────────────────────────────────

  const statCards = [
    {
      label: "Tổng sticky",
      value: stats?.total ?? 0,
      icon: Pin,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Đang hoạt động",
      value: stats?.active ?? 0,
      icon: CheckCircle,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      label: "Tổng lần gửi lại",
      value: stats?.total_resends ?? 0,
      icon: RefreshCw,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      label: "Dạng Embed",
      value: stats?.embed_count ?? 0,
      icon: Image,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      label: "Đã ghim",
      value: stats?.pinned_count ?? 0,
      icon: MapPin,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pin className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Sticky Messages</h2>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Thêm Sticky
        </Button>
      </div>

      {/* Stat cards */}
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card
              key={s.label}
              className="min-w-[160px] flex-shrink-0"
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    s.bg
                  )}
                >
                  <Icon className={cn("h-5 w-5", s.color)} />
                </div>
                <div>
                  {loadingStats ? (
                    <>
                      <Skeleton className="mb-1 h-5 w-8" />
                      <Skeleton className="h-3 w-20" />
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold leading-none">
                        {s.value}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.label}
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sticky list */}
      {loadingStickies ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stickies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Pin className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">
              Chưa có sticky nào. Nhấn Thêm Sticky để bắt đầu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {stickies.map((s) => {
            const chName = channelName(s.channel_id);
            const preview = s.embed_enabled
              ? truncate(s.embed_title, 80)
              : truncate(s.content, 80);

            return (
              <Card
                key={s.id}
                className={cn(
                  "transition-colors",
                  !s.is_enabled && "opacity-60"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left + Middle */}
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      {/* Channel badge */}
                      <Badge
                        variant="secondary"
                        className="w-fit gap-1 font-mono text-xs"
                      >
                        <Hash className="h-3 w-3" />
                        {chName ?? `channel_${s.channel_id}`}
                      </Badge>

                      {/* Type badge */}
                      <Badge
                        variant={s.embed_enabled ? "default" : "outline"}
                        className="w-fit text-xs"
                      >
                        {s.embed_enabled ? "Embed" : "Text"}
                      </Badge>

                      {/* Enabled badge */}
                      <Badge
                        variant={s.is_enabled ? "default" : "secondary"}
                        className={cn(
                          "w-fit text-xs",
                          s.is_enabled
                            ? "bg-green-600 hover:bg-green-700"
                            : ""
                        )}
                      >
                        {s.is_enabled ? "Bật" : "Tắt"}
                      </Badge>

                      {/* Preview */}
                      <span className="truncate text-sm text-muted-foreground">
                        {preview || "(trống)"}
                      </span>
                    </div>

                    {/* Right info + actions */}
                    <div className="flex items-center gap-3">
                      {/* Info */}
                      <div className="hidden flex-col gap-0.5 text-xs text-muted-foreground md:flex">
                        <span>
                          Trigger: mỗi {s.message_count_trigger} tin |{" "}
                          {s.interval_minutes > 0
                            ? `${s.interval_minutes} phút`
                            : "Tắt interval"}
                        </span>
                        <span>
                          Gửi lại: {s.resend_count} lần ·{" "}
                          {formatTime(s.last_sent)}
                        </span>
                      </div>

                      {/* Mobile info */}
                      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground md:hidden">
                        <span>
                          {s.message_count_trigger} tin ·{" "}
                          {s.interval_minutes > 0
                            ? `${s.interval_minutes}p`
                            : "Tắt"}
                        </span>
                        <span>
                          {s.resend_count} lần · {formatTime(s.last_sent)}
                        </span>
                      </div>

                      {/* Actions */}
                      <Separator orientation="vertical" className="mx-1 h-8" />

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          toggleMutation.mutate({
                            id: s.id,
                            is_enabled: !s.is_enabled,
                          })
                        }
                        disabled={toggleMutation.isPending}
                        title={s.is_enabled ? "Tắt" : "Bật"}
                      >
                        <Power
                          className={cn(
                            "h-4 w-4",
                            s.is_enabled
                              ? "text-green-500"
                              : "text-muted-foreground"
                          )}
                        />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(s)}
                        title="Chỉnh sửa"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => resendMutation.mutate(s.id)}
                        disabled={resendMutation.isPending}
                        title="Gửi lại ngay"
                      >
                        <RefreshCw
                          className={cn(
                            "h-4 w-4",
                            resendMutation.isPending && "animate-spin"
                          )}
                        />
                      </Button>

                      {confirmDeleteId === s.id ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => deleteMutation.mutate(s.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Xác nhận?
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDeleteId(s.id)}
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Chỉnh sửa Sticky" : "Tạo Sticky"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Channel select */}
            <div className="space-y-2">
              <Label>Channel</Label>
              <ChannelSelect
                filter="text"
                value={form.channel_id}
                onChange={(v) =>
                  setForm((f) => ({ ...f, channel_id: v === "__clear__" ? "" : v }))
                }
                placeholder="Chọn channel..."
                disabled={!!editing}
              />
              <p className="text-xs text-muted-foreground">
                Channel Discord để đăng sticky message
              </p>
            </div>

            {/* Embed toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="embed-toggle">Dùng Embed</Label>
              <Switch
                id="embed-toggle"
                checked={form.embed_enabled}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, embed_enabled: v }))
                }
              />
            </div>

            {/* Plain text mode */}
            {!form.embed_enabled && (
              <div className="space-y-2">
                <Label>Nội dung</Label>
                <div className="flex items-start gap-1">
                  <Textarea
                    value={form.content}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, content: e.target.value }))
                    }
                    placeholder="Nội dung tin nhắn sticky..."
                    rows={4}
                    className="flex-1"
                  />
                  <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, content: f.content + em }))} />
                </div>
              </div>
            )}

            {/* Embed mode */}
            {form.embed_enabled && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Tiêu đề</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      value={form.embed_title}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, embed_title: e.target.value }))
                      }
                      placeholder="Tiêu đề embed"
                    />
                    <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, embed_title: f.embed_title + em }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Mô tả</Label>
                  <div className="flex items-start gap-1">
                    <Textarea
                      value={form.embed_description}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          embed_description: e.target.value,
                        }))
                      }
                      placeholder="Mô tả embed..."
                      rows={4}
                      className="flex-1"
                    />
                    <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, embed_description: f.embed_description + em }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Màu embed</Label>
                  <div className="flex items-center gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, embed_color: c }))
                        }
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-all",
                          form.embed_color?.toLowerCase() === c.toLowerCase()
                            ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                            : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: c }}
                        aria-label={`Chọn màu ${c}`}
                      />
                    ))}
                    <Input
                      className="w-24 h-8 text-xs font-mono"
                      value={form.embed_color}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, embed_color: e.target.value }))
                      }
                      placeholder="#5865F2"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Footer</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      value={form.embed_footer}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, embed_footer: e.target.value }))
                      }
                      placeholder="Chân trang embed"
                    />
                    <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, embed_footer: f.embed_footer + em }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <Input
                    value={form.embed_image_url}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        embed_image_url: e.target.value,
                      }))
                    }
                    placeholder="https://example.com/image.png"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Thumbnail URL</Label>
                  <Input
                    value={form.embed_thumbnail_url}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        embed_thumbnail_url: e.target.value,
                      }))
                    }
                    placeholder="https://example.com/thumb.png"
                  />
                </div>

                {/* Live Discord embed preview */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Xem trước trên Discord</Label>
                  <DiscordPreview form={form} />
                </div>
              </div>
            )}

            <Separator />

            {/* Resend settings */}
            <p className="text-sm font-medium">Cài đặt gửi lại</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gửi lại sau X tin nhắn</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={form.message_count_trigger}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      message_count_trigger: Math.max(
                        1,
                        Math.min(500, Number(e.target.value) || 1)
                      ),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Interval (phút, 0=tắt)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10080}
                  value={form.interval_minutes}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      interval_minutes: Math.max(
                        0,
                        Math.min(10080, Number(e.target.value) || 0)
                      ),
                    }))
                  }
                />
              </div>
            </div>

            {/* Pin toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="pin-toggle">Ghim tin nhắn</Label>
              <Switch
                id="pin-toggle"
                checked={form.is_pinned}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, is_pinned: v }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !form.channel_id ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Đang lưu..."
                : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
