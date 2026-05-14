import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Ticket,
  Clock,
  Search,
  RefreshCw,
  Inbox,
  CheckCircle,
  Shield,
  Copy,
  UserPlus,
  StickyNote,
  Trash2,
  ArrowLeftRight,
  XCircle,
  Users,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ── */

interface TicketNote {
  id: number;
  author_id: string;
  content: string;
  created_at: string;
}

interface TicketRow {
  id: number;
  channel_id?: string;
  creator_id: string;
  claimed_by?: string;
  status: "open" | "closed" | "deleted";
  priority: "low" | "normal" | "high" | "urgent";
  subject?: string;
  panel_id?: number;
  close_reason?: string;
  members: string[];
  tags: string[];
  created_at: string;
  closed_at?: string;
  notes?: TicketNote[];
}

interface TicketStats {
  total: number;
  open: number;
  closed: number;
  avg_close_hours: number;
  by_priority: Record<string, number>;
  panels: number;
}

interface TicketPanel {
  id: number;
  name: string;
  [key: string]: unknown;
}

interface BlacklistEntry {
  id: number;
  discord_id: string;
  reason: string;
  added_by: string;
  created_at: string;
}

/* ── Config maps ── */

const PRIORITY_CONFIG: Record<
  string,
  { label: string; cls: string; iconCls: string }
> = {
  low: {
    label: "Thấp",
    cls: "bg-green-500/15 text-green-600 border-green-500/30",
    iconCls: "text-green-500",
  },
  normal: {
    label: "Bình thường",
    cls: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    iconCls: "text-blue-500",
  },
  high: {
    label: "Cao",
    cls: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    iconCls: "text-amber-500",
  },
  urgent: {
    label: "Khẩn cấp",
    cls: "bg-red-500/15 text-red-600 border-red-500/30",
    iconCls: "text-red-500",
  },
};

const STATUS_CONFIG: Record<
  string,
  { label: string; cls: string; iconCls: string }
> = {
  open: {
    label: "Đang mở",
    cls: "bg-green-500/15 text-green-600 border-green-500/30",
    iconCls: "text-green-500",
  },
  closed: {
    label: "Đã đóng",
    cls: "bg-gray-500/15 text-gray-500 border-gray-500/30",
    iconCls: "text-gray-500",
  },
  deleted: {
    label: "Đã xóa",
    cls: "bg-red-500/15 text-red-500 border-red-500/30",
    iconCls: "text-red-500",
  },
};

/* ── Helpers ── */

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

/* ── Stat card ── */

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("rounded-lg p-2.5", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Copyable ID chip ── */

function CopyableId({ value }: { value: string }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs bg-muted hover:bg-muted/80 px-1.5 py-0.5 rounded font-mono transition-colors cursor-pointer"
            onClick={() => copyToClipboard(value)}
          >
            {value}
            <Copy className="h-3 w-3 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Sao chép</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ── Skeleton loader ── */

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

/* ── Main page ── */

export function TicketsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Page-level tab: "list" | "blacklist"
  const [pageTab, setPageTab] = useState<"list" | "blacklist">("list");

  // Ticket list filters
  const [statusTab, setStatusTab] = useState<
    "all" | "open" | "closed" | "deleted"
  >("all");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [panelFilter, setPanelFilter] = useState<string>("all");

  // Detail sheet
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "notes" | "members">(
    "info"
  );

  /* ── Queries ── */

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<
    TicketRow[]
  >({
    queryKey: ["tickets", statusTab],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusTab !== "all") params.set("status", statusTab);
      return fetch(`/api/tickets?${params}`, { credentials: "include" }).then(
        (r) => r.json()
      );
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<TicketStats>({
    queryKey: ["ticket-stats"],
    queryFn: () =>
      fetch("/api/ticket-stats", { credentials: "include" }).then((r) =>
        r.json()
      ),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: panels = [] } = useQuery<TicketPanel[]>({
    queryKey: ["ticket-panels"],
    queryFn: () =>
      fetch("/api/ticket-panels", { credentials: "include" }).then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  });

  const { data: blacklist = [], isLoading: blacklistLoading } = useQuery<
    BlacklistEntry[]
  >({
    queryKey: ["ticket-blacklist"],
    queryFn: () =>
      fetch("/api/ticket-blacklist", { credentials: "include" }).then((r) =>
        r.json()
      ),
    staleTime: 30_000,
  });

  // Detail query — only runs when a ticket is selected
  const { data: detail, isLoading: detailLoading } = useQuery<TicketRow>({
    queryKey: ["ticket", selectedTicketId],
    queryFn: () =>
      fetch(`/api/tickets/${selectedTicketId}`, {
        credentials: "include",
      }).then((r) => r.json()),
    enabled: selectedTicketId !== null,
    staleTime: 10_000,
  });

  /* ── Mutations ── */

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: number;
    } & Record<string, unknown>) =>
      fetch(`/api/tickets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["ticket-stats"] });
      qc.invalidateQueries({ queryKey: ["ticket", selectedTicketId] });
      toast({ title: "Đã cập nhật ticket" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const blacklistRemoveMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/ticket-blacklist/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error("Xóa thất bại");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-blacklist"] });
      toast({ title: "Đã xóa khỏi blacklist" });
    },
    onError: () =>
      toast({ variant: "destructive", title: "Lỗi khi xóa khỏi blacklist" }),
  });

  /* ── Derived data ── */

  const panelMap = useMemo(
    () => new Map(panels.map((p) => [p.id, p.name])),
    [panels]
  );

  const filtered = useMemo(() => {
    let result = tickets;
    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (t) =>
          t.subject?.toLowerCase().includes(q) ||
          t.creator_id.toLowerCase().includes(q) ||
          t.channel_id?.toLowerCase().includes(q)
      );
    }
    if (priorityFilter !== "all") {
      result = result.filter((t) => t.priority === priorityFilter);
    }
    if (panelFilter !== "all") {
      result = result.filter((t) => String(t.panel_id) === panelFilter);
    }
    return result;
  }, [tickets, search, priorityFilter, panelFilter]);

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: ["ticket-stats"] });
  }, [qc]);

  /* ── Stat cards config ── */

  const statCards = [
    {
      label: "Tổng ticket",
      value: stats?.total ?? 0,
      icon: Ticket,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
    },
    {
      label: "Đang mở",
      value: stats?.open ?? 0,
      icon: Inbox,
      iconBg: "bg-green-500/10",
      iconColor: "text-green-500",
    },
    {
      label: "Đã đóng",
      value: stats?.closed ?? 0,
      icon: CheckCircle,
      iconBg: "bg-gray-500/10",
      iconColor: "text-gray-500",
    },
    {
      label: "TB đóng (giờ)",
      value: stats?.avg_close_hours?.toFixed(1) ?? "—",
      icon: Clock,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-500",
    },
  ];

  /* ── Render ── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Ticket className="h-6 w-6 text-primary" />
          Tickets
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quản lý ticket hệ thống
        </p>
      </div>

      {/* ── Page-level tabs: Danh sách | Blacklist ── */}
      <Tabs
        value={pageTab}
        onValueChange={(v) => setPageTab(v as "list" | "blacklist")}
      >
        <TabsList>
          <TabsTrigger value="list">Danh sách</TabsTrigger>
          <TabsTrigger value="blacklist" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Blacklist
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════ TICKET LIST TAB ═══════════════════ */}
        <TabsContent value="list" className="space-y-6 mt-4">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statsLoading
              ? statCards.map((s) => (
                  <Card key={s.label}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-6 w-12" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              : statCards.map((s) => <StatCard key={s.label} {...s} />)}
          </div>

          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
            {/* Status tabs */}
            <Tabs
              value={statusTab}
              onValueChange={(v) =>
                setStatusTab(v as "all" | "open" | "closed" | "deleted")
              }
            >
              <TabsList>
                <TabsTrigger value="all">Tất cả</TabsTrigger>
                <TabsTrigger value="open">Đang mở</TabsTrigger>
                <TabsTrigger value="closed">Đã đóng</TabsTrigger>
                <TabsTrigger value="deleted">Đã xóa</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search + filters */}
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              <div className="relative flex-1 min-w-[200px] lg:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm subject, creator, channel..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select
                value={priorityFilter}
                onValueChange={setPriorityFilter}
              >
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Mức ưu tiên" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả mức</SelectItem>
                  <SelectItem value="low">Thấp</SelectItem>
                  <SelectItem value="normal">Bình thường</SelectItem>
                  <SelectItem value="high">Cao</SelectItem>
                  <SelectItem value="urgent">Khẩn cấp</SelectItem>
                </SelectContent>
              </Select>

              <Select value={panelFilter} onValueChange={setPanelFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Panel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả panel</SelectItem>
                  {panels.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={invalidateAll}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tickets table */}
          <Card>
            <CardContent className="p-0">
              {ticketsLoading ? (
                <TableSkeleton />
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Inbox className="h-12 w-12 mb-3 opacity-40" />
                  <p className="text-sm font-medium">Không có ticket nào</p>
                  <p className="text-xs mt-1">
                    Thử thay đổi bộ lọc hoặc tìm kiếm
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">#</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Mức ưu tiên</TableHead>
                        <TableHead>Claimed</TableHead>
                        <TableHead>Panel</TableHead>
                        <TableHead>Ngày tạo</TableHead>
                        <TableHead className="w-24 text-right">
                          Thao tác
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-sm">
                            #{t.id}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {t.subject || (
                              <span className="text-muted-foreground italic">
                                Không có chủ đề
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {t.creator_id}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px]",
                                STATUS_CONFIG[t.status]?.cls
                              )}
                            >
                              {STATUS_CONFIG[t.status]?.label ?? t.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px]",
                                PRIORITY_CONFIG[t.priority]?.cls
                              )}
                            >
                              {PRIORITY_CONFIG[t.priority]?.label ??
                                t.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {t.claimed_by ? (
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {t.claimed_by}
                              </code>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {t.panel_id != null
                              ? panelMap.get(t.panel_id) ?? (
                                  <span className="text-muted-foreground">
                                    #{t.panel_id}
                                  </span>
                                )
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDate(t.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setSelectedTicketId(t.id);
                                setDetailTab("info");
                              }}
                            >
                              Chi tiết
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ BLACKLIST TAB ═══════════════════ */}
        <TabsContent value="blacklist" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-0">
              {blacklistLoading ? (
                <TableSkeleton />
              ) : blacklist.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Shield className="h-12 w-12 mb-3 opacity-40" />
                  <p className="text-sm font-medium">
                    Chưa có ai trong blacklist
                  </p>
                  <p className="text-xs mt-1">
                    Người dùng bị blacklist sẽ không thể tạo ticket
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Discord ID</TableHead>
                        <TableHead>Lý do</TableHead>
                        <TableHead>Thêm bởi</TableHead>
                        <TableHead>Ngày thêm</TableHead>
                        <TableHead className="w-24 text-right">
                          Thao tác
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blacklist.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {b.discord_id}
                            </code>
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate text-sm">
                            {b.reason || (
                              <span className="text-muted-foreground italic">
                                Không có lý do
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {b.added_by}
                            </code>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDate(b.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              disabled={blacklistRemoveMutation.isPending}
                              onClick={() =>
                                blacklistRemoveMutation.mutate(b.id)
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Xóa
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════ DETAIL SHEET ═══════════════════ */}
      <Sheet
        open={selectedTicketId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTicketId(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg flex flex-col p-0"
        >
          {detailLoading || !detail ? (
            <div className="flex-1 p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <div className="space-y-3 mt-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Sheet header */}
              <div className="px-6 pt-6 pb-4 border-b shrink-0">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <span className="font-mono">#{detail.id}</span>
                    <span className="text-muted-foreground font-normal">
                      —
                    </span>
                    <span className="truncate">
                      {detail.subject || "Không có chủ đề"}
                    </span>
                  </SheetTitle>
                  <SheetDescription className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px]",
                        STATUS_CONFIG[detail.status]?.cls
                      )}
                    >
                      {STATUS_CONFIG[detail.status]?.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px]",
                        PRIORITY_CONFIG[detail.priority]?.cls
                      )}
                    >
                      {PRIORITY_CONFIG[detail.priority]?.label}
                    </Badge>
                  </SheetDescription>
                </SheetHeader>
              </div>

              {/* Sheet tabs */}
              <div className="px-6 pt-3 shrink-0">
                <Tabs
                  value={detailTab}
                  onValueChange={(v) =>
                    setDetailTab(v as "info" | "notes" | "members")
                  }
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="info" className="flex-1 gap-1.5">
                      <Ticket className="h-3.5 w-3.5" />
                      Thông tin
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="flex-1 gap-1.5">
                      <StickyNote className="h-3.5 w-3.5" />
                      Notes
                    </TabsTrigger>
                    <TabsTrigger value="members" className="flex-1 gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      Members
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Sheet body — scrollable */}
              <ScrollArea className="flex-1 px-6 py-4">
                {/* ── Tab: Thông tin ── */}
                {detailTab === "info" && (
                  <div className="space-y-4">
                    {/* Channel ID */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Channel ID
                      </p>
                      {detail.channel_id ? (
                        <CopyableId value={detail.channel_id} />
                      ) : (
                        <p className="text-sm text-muted-foreground">—</p>
                      )}
                    </div>

                    {/* Creator ID */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Creator ID
                      </p>
                      <CopyableId value={detail.creator_id} />
                    </div>

                    {/* Claimed by */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Claimed by
                      </p>
                      {detail.claimed_by ? (
                        <CopyableId value={detail.claimed_by} />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Chưa ai nhận
                        </p>
                      )}
                    </div>

                    <Separator />

                    {/* Status selector */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">
                        Trạng thái
                      </p>
                      <Select
                        value={detail.status}
                        onValueChange={(v) =>
                          updateMutation.mutate({
                            id: detail.id,
                            status: v,
                          })
                        }
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Đang mở</SelectItem>
                          <SelectItem value="closed">Đã đóng</SelectItem>
                          <SelectItem value="deleted">Đã xóa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Priority selector */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">
                        Mức ưu tiên
                      </p>
                      <Select
                        value={detail.priority}
                        onValueChange={(v) =>
                          updateMutation.mutate({
                            id: detail.id,
                            priority: v,
                          })
                        }
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Thấp</SelectItem>
                          <SelectItem value="normal">
                            Bình thường
                          </SelectItem>
                          <SelectItem value="high">Cao</SelectItem>
                          <SelectItem value="urgent">Khẩn cấp</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    {/* Close reason */}
                    {detail.status === "closed" && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Lý do đóng
                        </p>
                        <p className="text-sm">
                          {detail.close_reason || (
                            <span className="text-muted-foreground italic">
                              Không có lý do
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Ngày tạo
                        </p>
                        <p className="text-sm">
                          {formatDate(detail.created_at)}
                        </p>
                      </div>
                      {detail.closed_at && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            Ngày đóng
                          </p>
                          <p className="text-sm">
                            {formatDate(detail.closed_at)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    {detail.tags.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Tags
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.tags.map((tag, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-[11px] gap-1"
                            >
                              <Tag className="h-3 w-3" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Notes ── */}
                {detailTab === "notes" && (
                  <div className="space-y-3">
                    {!detail.notes || detail.notes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <StickyNote className="h-10 w-10 mb-2 opacity-40" />
                        <p className="text-sm">Chưa có ghi chú nào</p>
                      </div>
                    ) : (
                      detail.notes.map((note) => (
                        <div
                          key={note.id}
                          className="rounded-lg border bg-muted/30 p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {note.author_id}
                            </code>
                            <span className="text-[11px] text-muted-foreground">
                              {formatDate(note.created_at)}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">
                            {note.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* ── Tab: Members ── */}
                {detailTab === "members" && (
                  <div className="space-y-2">
                    {detail.members.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <UserPlus className="h-10 w-10 mb-2 opacity-40" />
                        <p className="text-sm">Chưa có thành viên nào</p>
                      </div>
                    ) : (
                      detail.members.map((memberId, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-lg border px-3 py-2"
                        >
                          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {memberId}
                          </code>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* Sheet footer — actions */}
              <div className="px-6 py-4 border-t shrink-0">
                <div className="flex items-center gap-2">
                  {detail.status === "open" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={updateMutation.isPending}
                      onClick={() =>
                        updateMutation.mutate({
                          id: detail.id,
                          status: "closed",
                        })
                      }
                    >
                      <CheckCircle className="h-4 w-4" />
                      Đóng Ticket
                    </Button>
                  )}
                  {detail.status === "closed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={updateMutation.isPending}
                      onClick={() =>
                        updateMutation.mutate({
                          id: detail.id,
                          status: "open",
                        })
                      }
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      Mở lại
                    </Button>
                  )}
                  {detail.status !== "deleted" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5 ml-auto"
                      disabled={updateMutation.isPending}
                      onClick={() =>
                        updateMutation.mutate({
                          id: detail.id,
                          status: "deleted",
                        })
                      }
                    >
                      <XCircle className="h-4 w-4" />
                      Xóa
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
