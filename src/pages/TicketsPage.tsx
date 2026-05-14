import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Clock, Search, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TicketRow {
  id: number;
  channel_id?: string;
  creator_id: string;
  claimed_by?: string;
  status: "open" | "closed" | "deleted";
  priority: "low" | "normal" | "high" | "urgent";
  subject?: string;
  close_reason?: string;
  members: string[];
  created_at: string;
  closed_at?: string;
}

interface TicketStats {
  total: number;
  open: number;
  closed: number;
  avg_close_hours: number;
  by_priority: Record<string, number>;
  panels: number;
}

const PRIORITY_CONFIG: Record<string, { label: string; cls: string }> = {
  low:    { label: "Thấp",    cls: "bg-green-500/15 text-green-600 border-green-500/30" },
  normal: { label: "Bình thường", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  high:   { label: "Cao",     cls: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
  urgent: { label: "Khẩn cấp", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  open:   { label: "Đang mở", cls: "bg-green-500/15 text-green-600 border-green-500/30" },
  closed: { label: "Đã đóng", cls: "bg-gray-500/15 text-gray-500 border-gray-500/30" },
  deleted:{ label: "Đã xóa",  cls: "bg-red-500/15 text-red-500 border-red-500/30" },
};

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TicketsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "open" | "closed">("all");
  const [search, setSearch] = useState("");

  const { data: tickets = [], isLoading } = useQuery<TicketRow[]>({
    queryKey: ["tickets", tab],
    queryFn: () => {
      const params = new URLSearchParams();
      if (tab === "open") params.set("status", "open");
      else if (tab === "closed") params.set("status", "closed");
      return fetch(`/api/tickets?${params}`, { credentials: "include" }).then((r) => r.json());
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: stats } = useQuery<TicketStats>({
    queryKey: ["ticket-stats"],
    queryFn: () => fetch("/api/ticket-stats", { credentials: "include" }).then((r) => r.json()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
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
      toast({ title: "Đã cập nhật ticket" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return tickets;
    return tickets.filter(
      (t) =>
        t.subject?.toLowerCase().includes(q) ||
        t.creator_id.toLowerCase().includes(q)
    );
  }, [tickets, search]);

  const statCards = [
    { label: "Tổng ticket", value: stats?.total ?? 0, icon: Ticket, color: "text-blue-500" },
    { label: "Đang mở", value: stats?.open ?? 0, icon: Ticket, color: "text-green-500" },
    { label: "Đã đóng", value: stats?.closed ?? 0, icon: Ticket, color: "text-gray-500" },
    { label: "TB đóng (giờ)", value: stats?.avg_close_hours?.toFixed(1) ?? "—", icon: Clock, color: "text-yellow-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Ticket className="h-6 w-6 text-primary" />
          Tickets
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Quản lý ticket hệ thống</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("rounded-lg bg-muted p-2", s.color)}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "open" | "closed")}>
          <TabsList>
            <TabsTrigger value="all">Tất cả</TabsTrigger>
            <TabsTrigger value="open">Đang mở</TabsTrigger>
            <TabsTrigger value="closed">Đã đóng</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm subject / creator..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => qc.invalidateQueries({ queryKey: ["tickets"] })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Không có ticket nào</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#ID</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Mức ưu tiên</TableHead>
                    <TableHead>Claimed by</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead className="w-40">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-sm">#{t.id}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {t.subject || <span className="text-muted-foreground italic">—</span>}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.creator_id}</code>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("border", STATUS_CONFIG[t.status]?.cls)}>
                          {STATUS_CONFIG[t.status]?.label ?? t.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("border", PRIORITY_CONFIG[t.priority]?.cls)}>
                          {PRIORITY_CONFIG[t.priority]?.label ?? t.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {t.claimed_by ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.claimed_by}</code>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(t.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1.5">
                          <Select
                            value={t.status}
                            onValueChange={(v) => updateMutation.mutate({ id: t.id, status: v })}
                          >
                            <SelectTrigger className="h-7 text-xs w-[90px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Mở</SelectItem>
                              <SelectItem value="closed">Đóng</SelectItem>
                              <SelectItem value="deleted">Xóa</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={t.priority}
                            onValueChange={(v) => updateMutation.mutate({ id: t.id, priority: v })}
                          >
                            <SelectTrigger className="h-7 text-xs w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Thấp</SelectItem>
                              <SelectItem value="normal">BT</SelectItem>
                              <SelectItem value="high">Cao</SelectItem>
                              <SelectItem value="urgent">Khẩn</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
