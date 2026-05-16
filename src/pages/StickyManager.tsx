import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(s?: string) {
  if (!s) return "Not sent";
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

// ─── Component ───────────────────────────────────────────────────────────────

export function StickyManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

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

  // ── Handlers ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    navigate("/sticky/new");
  };

  const openEdit = (s: StickyMessage) => {
    navigate("/sticky/" + s.id + "/edit");
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
                        {preview || "(empty)"}
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
                        title="Edit"
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
                          title="Delete"
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
    </div>
  );
}
