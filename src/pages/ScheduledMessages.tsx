import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGuild } from "@/contexts/GuildContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Repeat,
  Hash,
  Send,
  Layout,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/hooks/useApi";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmbedData {
  title: string;
  description: string;
  color: string;
  footer: string;
  image_url: string;
  thumbnail_url: string;
  author_name: string;
  author_icon_url: string;
  fields: { name: string; value: string; inline: boolean }[];
}

interface ScheduledMessage {
  id: number;
  channel_id: string;
  content: string;
  embed_data: EmbedData | null;
  send_at: string;
  repeat_type: "none" | "hourly" | "daily" | "weekly" | "monthly";
  sent: boolean;
  last_sent_at: string | null;
  enabled: boolean;
  created_by: string;
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_COLOR = "#5865F2";

const REPEAT_LABELS: Record<ScheduledMessage["repeat_type"], string> = {
  none: "No repeat",
  hourly: "Every hour",
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(s?: string | null, len = 80) {
  if (!s) return "";
  return s.length > len ? s.slice(0, len) + "…" : s;
}

function relativeTime(s: string): string {
  const now = Date.now();
  const target = new Date(s).getTime();
  const diff = target - now;
  const absDiff = Math.abs(diff);
  const isFuture = diff > 0;

  const minutes = Math.floor(absDiff / 60_000);
  const hours = Math.floor(absDiff / 3_600_000);
  const days = Math.floor(absDiff / 86_400_000);

  if (minutes < 1) return isFuture ? "right now" : "just now";
  if (minutes < 60) return isFuture ? `in ${minutes}m` : `${minutes}m ago`;
  if (hours < 24) return isFuture ? `in ${hours}h` : `${hours}h ago`;
  if (days < 30) return isFuture ? `in ${days}d` : `${days}d ago`;

  return formatDate(s);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ScheduledMessages() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { selectedGuildId } = useGuild();

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: messages = [], isLoading } = useQuery<ScheduledMessage[]>({
    queryKey: ["scheduled-messages", selectedGuildId],
    queryFn: () =>
      apiFetch("/api/scheduled-messages").then((r) =>
        r.json()
      ),
    enabled: !!selectedGuildId,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/scheduled-messages/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-messages", selectedGuildId] });
      setConfirmDeleteId(null);
      toast({ title: "Schedule deleted." });
    },
    onError: () =>
      toast({ variant: "destructive", title: "Error deleting schedule." }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      apiFetch(`/api/scheduled-messages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: ["scheduled-messages", selectedGuildId] });
      const prev = qc.getQueryData<ScheduledMessage[]>(["scheduled-messages", selectedGuildId]);
      qc.setQueryData<ScheduledMessage[]>(["scheduled-messages", selectedGuildId], (old) =>
        old?.map((m) => (m.id === id ? { ...m, enabled } : m))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["scheduled-messages", selectedGuildId], ctx.prev);
      toast({ variant: "destructive", title: "Error toggling status." });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-messages", selectedGuildId] });
    },
  });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-2xl font-bold leading-none">
              Scheduled Messages
            </h2>
            <p className="text-sm text-muted-foreground">
              Schedule messages / embeds
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => navigate('/scheduled-messages/new')} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            New Schedule
          </Button>
        </div>
      </div>

      {/* Message list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-6 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-6 w-16 animate-pulse rounded bg-muted" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="relative mb-4">
              <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center">
                <CalendarClock className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Send className="h-3 w-3 text-primary/60" />
              </div>
            </div>
            <p className="text-sm font-medium">No schedules yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create scheduled messages for the bot to send at the right time.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/scheduled-messages/new')}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => {
            const preview = m.embed_data
              ? truncate(m.embed_data.title || m.embed_data.description, 80)
              : truncate(m.content, 80);

            return (
              <Card
                key={m.id}
                className={cn(
                  "overflow-hidden transition-all cursor-pointer hover:shadow-md",
                  !m.enabled && "opacity-60"
                )}
                onClick={() => navigate('/scheduled-messages/' + m.id + '/edit')}
              >
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Colored left border for embed messages */}
                    {m.embed_data && (
                      <div
                        className="w-1 shrink-0"
                        style={{ backgroundColor: m.embed_data.color || DEFAULT_COLOR }}
                      />
                    )}

                    <div className="flex-1 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* Left: status dot + content */}
                        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          {/* Status dot */}
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full shrink-0",
                                m.sent
                                  ? "bg-green-500"
                                  : m.enabled
                                    ? "bg-amber-500 animate-pulse"
                                    : "bg-muted-foreground/40"
                              )}
                            />
                            <span className="text-xs font-medium">
                              {m.sent ? "Sent" : m.enabled ? "Pending" : "Disabled"}
                            </span>
                          </div>

                          {/* Channel */}
                          <Badge
                            variant="secondary"
                            className="w-fit gap-1 font-mono text-xs"
                          >
                            <Hash className="h-3 w-3" />
                            {m.channel_id}
                          </Badge>

                          {/* Repeat badge */}
                          {m.repeat_type !== "none" && (
                            <Badge
                              variant="outline"
                              className="w-fit gap-1 text-xs"
                            >
                              <Repeat className="h-3 w-3" />
                              {REPEAT_LABELS[m.repeat_type]}
                            </Badge>
                          )}

                          {/* Embed badge */}
                          {m.embed_data && (
                            <Badge className="bg-indigo-500/15 text-indigo-600 border-indigo-500/30 w-fit gap-1 text-xs">
                              <Layout className="h-3 w-3" />
                              Embed
                            </Badge>
                          )}

                          {/* Preview */}
                          <span className="truncate text-sm text-muted-foreground">
                            {preview || "(empty)"}
                          </span>
                        </div>

                        {/* Right: time + actions */}
                        <div className="flex items-center gap-3">
                          {/* Relative time */}
                          <div className="hidden flex-col gap-0.5 text-xs text-muted-foreground md:flex items-end">
                            <span className="font-medium text-foreground/80">
                              {relativeTime(m.send_at)}
                            </span>
                            <span>{formatDate(m.send_at)}</span>
                          </div>

                          {/* Mobile time */}
                          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground md:hidden">
                            <span>{relativeTime(m.send_at)}</span>
                          </div>

                          <Separator orientation="vertical" className="mx-1 h-8" />

                          {/* Enabled toggle */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMutation.mutate({
                                id: m.id,
                                enabled: !m.enabled,
                              });
                            }}
                            disabled={toggleMutation.isPending}
                            title={m.enabled ? "Disable" : "Enable"}
                          >
                            {m.enabled ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>

                          {/* Edit */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/scheduled-messages/' + m.id + '/edit');
                            }}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          {/* Delete */}
                          {confirmDeleteId === m.id ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMutation.mutate(m.id);
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              Confirm?
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(m.id);
                              }}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
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
