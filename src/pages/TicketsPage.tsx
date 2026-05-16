import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Ticket,
  Clock,
  Search,
  RefreshCw,
  Inbox,
  CheckCircle,
  Shield,
} from "lucide-react";
import type {
  TicketRow,
  TicketStats,
  TicketPanelRef,
  BlacklistEntry,
} from "./tickets/ticketHelpers";
import { StatCard } from "./tickets/ticketHelpers";
import { TicketDetailDialog } from "./tickets/TicketDetailDialog";
import { TicketTable, BlacklistTable } from "./tickets/TicketTables";
import { apiFetch } from "@/hooks/useApi";

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
      return apiFetch(`/api/tickets?${params}`, { credentials: "include" }).then(
        (r) => r.json()
      );
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<TicketStats>({
    queryKey: ["ticket-stats"],
    queryFn: () =>
      apiFetch("/api/ticket-stats").then((r) =>
        r.json()
      ),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: panels = [] } = useQuery<TicketPanelRef[]>({
    queryKey: ["ticket-panels"],
    queryFn: () =>
      apiFetch("/api/ticket-panels").then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  });

  const { data: blacklist = [], isLoading: blacklistLoading } = useQuery<
    BlacklistEntry[]
  >({
    queryKey: ["ticket-blacklist"],
    queryFn: () =>
      apiFetch("/api/ticket-blacklist").then((r) =>
        r.json()
      ),
    staleTime: 30_000,
  });

  // Detail query — only runs when a ticket is selected
  const { data: detail, isLoading: detailLoading } = useQuery<TicketRow>({
    queryKey: ["ticket", selectedTicketId],
    queryFn: () =>
      apiFetch(`/api/tickets/${selectedTicketId}`, {
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
      apiFetch(`/api/tickets/${id}`, {
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
      toast({ title: "Ticket updated" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const blacklistRemoveMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/ticket-blacklist/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error("Delete failed");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-blacklist"] });
      toast({ title: "Removed from blacklist" });
    },
    onError: () =>
      toast({ variant: "destructive", title: "Failed to remove from blacklist" }),
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
      label: "Total tickets",
      value: stats?.total ?? 0,
      icon: Ticket,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
    },
    {
      label: "Open",
      value: stats?.open ?? 0,
      icon: Inbox,
      iconBg: "bg-green-500/10",
      iconColor: "text-green-500",
    },
    {
      label: "Closed",
      value: stats?.closed ?? 0,
      icon: CheckCircle,
      iconBg: "bg-gray-500/10",
      iconColor: "text-gray-500",
    },
    {
      label: "Avg close (hrs)",
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
          Manage ticket system
        </p>
      </div>

      {/* ── Page-level tabs: List | Blacklist ── */}
      <Tabs
        value={pageTab}
        onValueChange={(v) => setPageTab(v as "list" | "blacklist")}
      >
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
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
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="open">Open</TabsTrigger>
                <TabsTrigger value="closed">Closed</TabsTrigger>
                <TabsTrigger value="deleted">Deleted</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search + filters */}
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              <div className="relative flex-1 min-w-[200px] lg:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search subject, creator, channel..."
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
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>

              <Select value={panelFilter} onValueChange={setPanelFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Panel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All panels</SelectItem>
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
              <TicketTable
                tickets={filtered}
                isLoading={ticketsLoading}
                panelMap={panelMap}
                onViewDetail={(id) => {
                  setSelectedTicketId(id);
                  setDetailTab("info");
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ BLACKLIST TAB ═══════════════════ */}
        <TabsContent value="blacklist" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-0">
              <BlacklistTable
                blacklist={blacklist}
                isLoading={blacklistLoading}
                isRemoving={blacklistRemoveMutation.isPending}
                onRemove={(id) => blacklistRemoveMutation.mutate(id)}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════ DETAIL DIALOG ═══════════════════ */}
      <TicketDetailDialog
        open={selectedTicketId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTicketId(null);
        }}
        detail={detail}
        detailLoading={detailLoading}
        detailTab={detailTab}
        setDetailTab={(tab) => setDetailTab(tab as "info" | "notes" | "members")}
        updateMutation={updateMutation}
      />
    </div>
  );
}
