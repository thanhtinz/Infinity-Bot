import { useT } from "@/i18n";
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  ScrollText,
  MessageSquare,
  Mic,
  Users,
  Server,
  Search,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Trash2,
  Pencil,
  LogIn,
  LogOut,
  Hash,
  UserMinus,
  UserPlus,
  ArrowRightLeft,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/hooks/useApi";

/* ───────── Types ───────── */

interface LogEntry {
  id: number;
  event_type: string;
  category: string;
  actor_id: string;
  actor_name: string;
  actor_avatar: string | null;
  target_id: string;
  target_name: string;
  description: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface LogEntriesResponse {
  entries: LogEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface LogStats {
  total: number;
  by_category: Record<string, number>;
}

/* ───────── Constants ───────── */

const CATEGORY_META: Record<
  string,
  { labelKey: string; icon: React.ElementType; color: string }
> = {
  message: { labelKey: "logViewer_messages", icon: MessageSquare, color: "text-blue-500" },
  voice: { labelKey: "logViewer_voice", icon: Mic, color: "text-green-500" },
  member: { labelKey: "logViewer_members", icon: Users, color: "text-purple-500" },
  server: { labelKey: "logViewer_server", icon: Server, color: "text-orange-500" },
};

const EVENT_BADGE: Record<string, { labelKey: string; variant: string }> = {
  log_message_delete: { labelKey: "logViewer_deleteMsg", variant: "destructive" },
  log_message_edit: { labelKey: "logViewer_editMsg", variant: "amber" },
  log_message_bulk_delete: { labelKey: "logViewer_bulkDelete", variant: "destructive" },
  log_voice_join: { labelKey: "logViewer_voiceJoin", variant: "green" },
  log_voice_leave: { labelKey: "logViewer_voiceLeave", variant: "gray" },
  log_voice_move: { labelKey: "logViewer_voiceMove", variant: "amber" },
  log_member_join: { labelKey: "logViewer_memberJoin", variant: "green" },
  log_member_leave: { labelKey: "logViewer_memberLeave", variant: "gray" },
  log_nickname_change: { labelKey: "logViewer_nickChange", variant: "amber" },
  log_role_update: { labelKey: "logViewer_roleUpdate", variant: "amber" },
  log_channel_create: { labelKey: "logViewer_channelCreate", variant: "green" },
  log_channel_delete: { labelKey: "logViewer_channelDelete", variant: "destructive" },
};

const EVENT_ICON: Record<string, React.ElementType> = {
  log_message_delete: Trash2,
  log_message_edit: Pencil,
  log_message_bulk_delete: Trash2,
  log_voice_join: LogIn,
  log_voice_leave: LogOut,
  log_voice_move: ArrowRightLeft,
  log_member_join: UserPlus,
  log_member_leave: UserMinus,
  log_nickname_change: Pencil,
  log_role_update: ArrowRightLeft,
  log_channel_create: Hash,
  log_channel_delete: Trash2,
};

/* ───────── Helpers ───────── */

function relativeTime(dateStr: string, t: (key: string) => string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return t("logViewer_justNow");
  if (minutes < 60) return `${minutes}${t("logViewer_minutesAgo")}`;
  if (hours < 24) return `${hours}${t("logViewer_hoursAgo")}`;
  if (days < 30) return `${days}${t("logViewer_daysAgo")}`;
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

function BadgeForEvent({ eventType, t }: { eventType: string; t: (key: string) => string }) {
  const meta = EVENT_BADGE[eventType];
  if (!meta) return <Badge variant="secondary">{eventType}</Badge>;

  const cls =
    meta.variant === "destructive"
      ? "bg-red-500/15 text-red-500 border-red-500/30"
      : meta.variant === "green"
        ? "bg-green-500/15 text-green-500 border-green-500/30"
        : meta.variant === "amber"
          ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
          : "bg-muted text-muted-foreground border-border";

  return (
    <Badge className={cn("text-[10px] px-1.5 py-0 font-medium border", cls)}>
      {t(meta.labelKey)}
    </Badge>
  );
}

/* ───────── Component ───────── */

export function LogViewer() {
  const { t } = useT();
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when category changes
  const handleCategoryChange = useCallback((val: string) => {
    setCategory(val);
    setPage(1);
  }, []);

  // Build query params
  const params = new URLSearchParams();
  if (category !== "all") params.set("category", category);
  if (debouncedSearch) params.set("search", debouncedSearch);
  params.set("page", String(page));
  params.set("limit", "50");

  const { data: stats, isLoading: statsLoading } = useQuery<LogStats>({
    queryKey: ["logging-stats"],
    queryFn: () =>
      apiFetch("/api/logging/stats").then((r) =>
        r.json()
      ),
  });

  const {
    data: entriesData,
    isLoading: entriesLoading,
    isRefetching,
  } = useQuery<LogEntriesResponse>({
    queryKey: ["logging-entries", category, debouncedSearch, page],
    queryFn: () =>
      apiFetch(`/api/logging/entries?${params}`, {
        credentials: "include",
      }).then((r) => r.json()),
  });

  const entries = entriesData?.entries ?? [];
  const totalPages = entriesData?.pages ?? 1;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">{t("logViewer_title")}</h2>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <ScrollText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t("total")}</p>
              {statsLoading ? (
                <Skeleton className="h-5 w-10" />
              ) : (
                <p className="text-lg font-bold">{stats?.total ?? 0}</p>
              )}
            </div>
          </CardContent>
        </Card>
        {Object.entries(CATEGORY_META).map(([key, meta]) => {
          const Icon = meta.icon;
          return (
            <Card key={key}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2 rounded-md bg-muted", meta.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t(meta.labelKey)}</p>
                  {statsLoading ? (
                    <Skeleton className="h-5 w-10" />
                  ) : (
                    <p className="text-lg font-bold">
                      {stats?.by_category?.[key] ?? 0}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={category} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t("logViewer_category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all")}</SelectItem>
            <SelectItem value="message">{t("logViewer_messages")}</SelectItem>
            <SelectItem value="voice">{t("logViewer_voice")}</SelectItem>
            <SelectItem value="member">{t("logViewer_members")}</SelectItem>
            <SelectItem value="server">{t("logViewer_server")}</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("logViewer_searchLogs")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isRefetching && (
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground self-center" />
        )}
      </div>

      {/* ── Log Timeline ── */}
      {entriesLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Inbox className="h-10 w-10" />
            <p className="text-sm font-medium">{t("logViewer_noLogsYet")}</p>
            <p className="text-xs">
              {t("logViewer_serverActivities")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const catMeta = CATEGORY_META[entry.category];
            const EventIcon = EVENT_ICON[entry.event_type] ?? ScrollText;
            const details = entry.details ?? {};
            const hasContent = "content" in details;
            const hasBefore = "before" in details;
            const hasAfter = "after" in details;

            return (
              <Card key={entry.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Actor avatar */}
                    <Avatar className="h-8 w-8 shrink-0">
                      {entry.actor_avatar && (
                        <AvatarImage
                          src={entry.actor_avatar}
                          alt={entry.actor_name}
                        />
                      )}
                      <AvatarFallback className="text-xs">
                        {entry.actor_name?.charAt(0) ?? "?"}
                      </AvatarFallback>
                    </Avatar>

                    {/* Main content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm truncate max-w-[200px]">
                          {entry.actor_name}
                        </span>
                        <BadgeForEvent eventType={entry.event_type} t={t} />
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          {relativeTime(entry.created_at, t)}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {entry.description}
                      </p>

                      {/* Detail blocks */}
                      {hasContent && (
                        <pre className="mt-1.5 rounded-md bg-muted/50 border px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap break-words font-mono overflow-x-auto">
                          {String(details.content)}
                        </pre>
                      )}

                      {(hasBefore || hasAfter) && (
                        <div className="mt-1.5 space-y-1">
                          {hasBefore && (
                            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs whitespace-pre-wrap break-words font-mono overflow-x-auto text-red-400">
                              <span className="font-semibold text-red-500 mr-1.5">
                                {t("logViewer_previous")}
                              </span>
                              {String(details.before)}
                            </div>
                          )}
                          {hasAfter && (
                            <div className="rounded-md bg-green-500/10 border border-green-500/20 px-3 py-2 text-xs whitespace-pre-wrap break-words font-mono overflow-x-auto text-green-400">
                              <span className="font-semibold text-green-500 mr-1.5">
                                {t("logViewer_after")}
                              </span>
                              {String(details.after)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Category icon */}
                    {catMeta && (
                      <div
                        className={cn(
                          "shrink-0 p-1.5 rounded-md bg-muted",
                          catMeta.color
                        )}
                      >
                        <EventIcon className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {!entriesLoading && entries.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("logViewer_page")} {page} / {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t("previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t("next")}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
