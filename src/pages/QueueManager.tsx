import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Headset,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Plus,
  X,
  Send,
  StickyNote,
  Settings,
  LayoutList,
  BarChart3,
} from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { PageContainer, PageHeader, StatCard, EmptyState } from "@/components/infinity";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────────────────────────────────── */

import type { LucideIcon } from "lucide-react";

interface Ticket {
  id: number;
  ticket_number: number;
  subject: string;
  status: string;
  priority: string;
  category: string;
  creator_discord_id: string;
  creator_name: string;
  assigned_staff_id: number | null;
  assigned_staff_name: string | null;
  channel_id: string;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  sla_response_breached: boolean;
  sla_resolve_breached: boolean;
  tags: string[];
  internal_note: string | null;
  rating: number | null;
  elapsed_minutes: number;
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: number;
  discord_id: string;
  content: string;
  is_staff: boolean;
  is_internal: boolean;
  created_at: string;
}

interface TicketDetail extends Ticket {
  messages: TicketMessage[];
}

interface QueueStats {
  total: number;
  open: number;
  resolved: number;
  sla_breached: number;
  avg_resolve_minutes: number;
  avg_rating: number;
}

interface QueueConfig {
  enabled: boolean;
  sla_response_minutes: number;
  sla_resolve_minutes: number;
  support_role_id: string;
  log_channel_id: string;
  category_id: string;
  max_open_per_user: number;
  close_on_resolve: boolean;
  welcome_message: string;
}

interface StaffProfile {
  id: number;
  name: string;
  discord_id: string;
}

/* ── Config Maps ────────────────────────────────────────────────────────── */

const PRIORITY_CFG: Record<string, { label: string; cls: string }> = {
  urgent: { label: "Urgent", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
  high: { label: "High", cls: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
  normal: { label: "Normal", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  low: { label: "Low", cls: "bg-gray-500/15 text-gray-600 border-gray-500/30" },
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  claimed: { label: "Claimed", cls: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
  in_progress: { label: "In Progress", cls: "bg-purple-500/15 text-purple-600 border-purple-500/30" },
  pending: { label: "Pending", cls: "bg-gray-500/15 text-gray-600 border-gray-500/30" },
  resolved: { label: "Resolved", cls: "bg-green-500/15 text-green-600 border-green-500/30" },
  closed: { label: "Closed", cls: "bg-gray-500/15 text-gray-600 border-gray-500/30" },
};

/* ── Helpers ────────────────────────────────────────────────────────────── */

function fmtElapsed(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }
  return `${minutes}m`;
}

function fmtDateTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.normal;
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-semibold", cfg.cls)}>
      {cfg.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.open;
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-semibold", cfg.cls)}>
      {cfg.label}
    </Badge>
  );
}

function SlaIndicator({ ticket }: { ticket: Ticket }) {
  const breached = ticket.sla_response_breached || ticket.sla_resolve_breached;
  if (breached) {
    return <AlertTriangle className="w-4 h-4 text-red-500" />;
  }
  return <CheckCircle2 className="w-4 h-4 text-green-500" />;
}

/* ── Component ──────────────────────────────────────────────────────────── */

export default function QueueManager() {
  const { toast } = useToast();
  const qc = useQueryClient();

  /* ── State ───────────────────────────────────────────────────────────── */
  const [tab, setTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [internalReply, setInternalReply] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [editNote, setEditNote] = useState<string | null>(null);

  /* ── Stats Query ─────────────────────────────────────────────────────── */
  const { data: stats, isLoading: statsLoading } = useQuery<QueueStats>({
    queryKey: ["queue-stats"],
    queryFn: () => apiFetch("/api/queue/stats").then((r) => r.json()),
    refetchInterval: 60000,
  });

  /* ── Tickets Query ───────────────────────────────────────────────────── */
  const ticketParams = new URLSearchParams();
  if (statusFilter !== "all") ticketParams.set("status", statusFilter);
  if (priorityFilter !== "all") ticketParams.set("priority", priorityFilter);

  const { data: tickets, isLoading: ticketsLoading } = useQuery<Ticket[]>({
    queryKey: ["queue-tickets", statusFilter, priorityFilter],
    queryFn: () => apiFetch(`/api/queue/tickets?${ticketParams}`).then((r) => r.json()),
    refetchInterval: 60000,
  });

  /* ── Ticket Detail Query ─────────────────────────────────────────────── */
  const { data: detail, isLoading: detailLoading } = useQuery<TicketDetail>({
    queryKey: ["queue-ticket", selectedTicketId],
    queryFn: () => apiFetch(`/api/queue/tickets/${selectedTicketId}`).then((r) => r.json()),
    enabled: !!selectedTicketId && detailOpen,
  });

  /* ── Staff Query ─────────────────────────────────────────────────────── */
  const { data: staffListRaw } = useQuery<unknown>({
    queryKey: ["staff-profiles"],
    queryFn: () => apiFetch("/api/staff/profiles").then((r) => r.json()),
  });
  const staffList: StaffProfile[] = Array.isArray(staffListRaw) ? (staffListRaw as StaffProfile[]) : [];

  /* ── Config Query ────────────────────────────────────────────────────── */
  const { data: config, isLoading: configLoading } = useQuery<QueueConfig>({
    queryKey: ["queue-config"],
    queryFn: () => apiFetch("/api/queue/config").then((r) => r.json()),
  });

  /* ── Config Form State ───────────────────────────────────────────────── */
  const [cfgForm, setCfgForm] = useState<QueueConfig | null>(null);
  const configReady = cfgForm !== null;

  // Sync config data to form when loaded
  useState(() => {
    if (config && !cfgForm) {
      setCfgForm({ ...config });
    }
  });

  // Keep cfgForm in sync with config
  if (config && !cfgForm) {
    setCfgForm({ ...config });
  }

  /* ── Mutations ───────────────────────────────────────────────────────── */

  const updateTicketMutation = useMutation({
    mutationFn: (body: Partial<Pick<Ticket, "status" | "priority" | "tags" | "internal_note" | "assigned_staff_id">>) => {
      return apiFetch(`/api/queue/tickets/${selectedTicketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Update failed");
        return r.json();
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue-ticket", selectedTicketId] });
      qc.invalidateQueries({ queryKey: ["queue-tickets"] });
      qc.invalidateQueries({ queryKey: ["queue-stats"] });
      toast({ title: "Ticket updated" });
    },
    onError: () => {
      toast({ title: "Failed to update ticket", variant: "destructive" });
    },
  });

  const claimMutation = useMutation({
    mutationFn: (staffId: number) => {
      return apiFetch(`/api/queue/tickets/${selectedTicketId}/claim?staff_id=${staffId}`, {
        method: "POST",
      }).then((r) => {
        if (!r.ok) throw new Error("Claim failed");
        return r.json();
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue-ticket", selectedTicketId] });
      qc.invalidateQueries({ queryKey: ["queue-tickets"] });
      qc.invalidateQueries({ queryKey: ["queue-stats"] });
      toast({ title: "Ticket claimed" });
    },
    onError: () => {
      toast({ title: "Failed to claim ticket", variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (body: { discord_id: string; content: string; is_staff: boolean; is_internal: boolean }) => {
      return apiFetch(`/api/queue/tickets/${selectedTicketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Send failed");
        return r.json();
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue-ticket", selectedTicketId] });
      setReplyText("");
      setInternalReply(false);
      toast({ title: "Message sent" });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: (body: Partial<QueueConfig>) => {
      return apiFetch("/api/queue/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Save failed");
        return r.json();
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue-config"] });
      toast({ title: "Configuration saved" });
    },
    onError: () => {
      toast({ title: "Failed to save configuration", variant: "destructive" });
    },
  });

  /* ── Handlers ────────────────────────────────────────────────────────── */

  const openDetail = useCallback((ticketId: number) => {
    setSelectedTicketId(ticketId);
    setDetailOpen(true);
    setReplyText("");
    setInternalReply(false);
    setNewTag("");
    setEditNote(null);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setSelectedTicketId(null);
  }, []);

  const handleAddTag = useCallback(() => {
    if (!newTag.trim() || !detail) return;
    const tags = [...(detail.tags ?? []), newTag.trim()];
    updateTicketMutation.mutate({ tags });
    setNewTag("");
  }, [newTag, detail, updateTicketMutation]);

  const handleRemoveTag = useCallback(
    (tag: string) => {
      if (!detail) return;
      const tags = (detail.tags ?? []).filter((t) => t !== tag);
      updateTicketMutation.mutate({ tags });
    },
    [detail, updateTicketMutation]
  );

  const handleSaveNote = useCallback(() => {
    if (!detail || editNote === null) return;
    updateTicketMutation.mutate({ internal_note: editNote });
  }, [detail, editNote, updateTicketMutation]);

  const handleSendReply = useCallback(() => {
    if (!replyText.trim() || !detail) return;
    sendMessageMutation.mutate({
      discord_id: detail.creator_discord_id,
      content: replyText.trim(),
      is_staff: true,
      is_internal: internalReply,
    });
  }, [replyText, detail, internalReply, sendMessageMutation]);

  const handleAssignStaff = useCallback(
    (staffId: string) => {
      if (!staffId) return;
      claimMutation.mutate(Number(staffId));
    },
    [claimMutation]
  );

  const handleSaveConfig = useCallback(() => {
    if (!cfgForm) return;
    saveConfigMutation.mutate(cfgForm);
  }, [cfgForm, saveConfigMutation]);

  /* ── Active tickets for overview ─────────────────────────────────────── */
  const ticketList = Array.isArray(tickets) ? tickets : [];
  const activeTickets = ticketList.filter((t) => !["resolved", "closed"].includes(t.status));

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <PageContainer>
      <PageHeader
        title="Queue Manager"
        description="Manage support tickets, SLA tracking, and queue settings"
        icon={Headset}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1.5">
            <LayoutList className="w-3.5 h-3.5" />
            Tickets
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="w-3.5 h-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ──────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-5 flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-7 w-12" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : stats ? (
              <>
                <StatCard
                  icon={MessageSquare as LucideIcon}
                  label="Open Tickets"
                  value={String(stats.open)}
                  color="primary"
                />
                <StatCard
                  icon={AlertTriangle as LucideIcon}
                  label="SLA Breaches"
                  value={String(stats.sla_breached)}
                  color="amber"
                />
                <StatCard
                  icon={CheckCircle2 as LucideIcon}
                  label="Resolved Today"
                  value={String(stats.resolved)}
                  color="emerald"
                />
                <StatCard
                  icon={Clock as LucideIcon}
                  label="Avg Resolve Time"
                  value={stats.avg_resolve_minutes >= 60
                    ? `${(stats.avg_resolve_minutes / 60).toFixed(1)}h`
                    : `${Math.round(stats.avg_resolve_minutes)}m`}
                  color="purple"
                />
              </>
            ) : null}
          </div>

          {/* Active Tickets Table */}
          <Card>
            <CardContent className="p-0">
              {ticketsLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-10" />
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-5 w-14" />
                      <Skeleton className="h-5 w-14" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-12 ml-auto" />
                      <Skeleton className="h-4 w-4" />
                    </div>
                  ))}
                </div>
              ) : activeTickets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Subject</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Priority</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Assigned</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Elapsed</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">SLA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTickets.map((t) => (
                        <tr
                          key={t.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => openDetail(t.id)}
                        >
                          <td className="p-3 font-mono text-muted-foreground">#{t.ticket_number}</td>
                          <td className="p-3 font-medium truncate max-w-[240px]">{t.subject}</td>
                          <td className="p-3 text-center">
                            <StatusBadge status={t.status} />
                          </td>
                          <td className="p-3 text-center">
                            <PriorityBadge priority={t.priority} />
                          </td>
                          <td className="p-3 text-muted-foreground truncate max-w-[140px]">
                            {t.assigned_staff_name || "Unassigned"}
                          </td>
                          <td className="p-3 text-right text-muted-foreground whitespace-nowrap">
                            {fmtElapsed(t.elapsed_minutes)}
                          </td>
                          <td className="p-3 text-center">
                            <SlaIndicator ticket={t} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="All caught up"
                  description="No active tickets in the queue right now"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tickets Tab ───────────────────────────────────────────────── */}
        <TabsContent value="tickets" className="space-y-4 mt-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="claimed">Claimed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tickets Table */}
          <Card>
            <CardContent className="p-0">
              {ticketsLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-10" />
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-14" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-4" />
                    </div>
                  ))}
                </div>
              ) : ticketList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Subject</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Priority</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Assigned To</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Created</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">SLA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ticketList.map((t) => (
                        <tr
                          key={t.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => openDetail(t.id)}
                        >
                          <td className="p-3 font-mono text-muted-foreground">#{t.ticket_number}</td>
                          <td className="p-3 font-medium truncate max-w-[240px]">{t.subject}</td>
                          <td className="p-3 text-center">
                            <StatusBadge status={t.status} />
                          </td>
                          <td className="p-3 text-center">
                            <PriorityBadge priority={t.priority} />
                          </td>
                          <td className="p-3 text-muted-foreground truncate max-w-[140px]">
                            {t.assigned_staff_name || "Unassigned"}
                          </td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {fmtDateTime(t.created_at)}
                          </td>
                          <td className="p-3 text-center">
                            <SlaIndicator ticket={t} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={LayoutList}
                  title="No tickets found"
                  description="No tickets match the current filters"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Settings Tab ──────────────────────────────────────────────── */}
        <TabsContent value="settings" className="space-y-6 mt-4">
          {configLoading || !configReady ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : cfgForm ? (
            <Card>
              <CardContent className="p-6 space-y-6">
                {/* Enabled */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Queue Enabled</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Enable or disable the support ticket queue</p>
                  </div>
                  <Switch
                    checked={cfgForm.enabled}
                    onCheckedChange={(v) => setCfgForm({ ...cfgForm, enabled: v })}
                  />
                </div>

                <Separator />

                {/* SLA Settings */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">SLA Configuration</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Response SLA (minutes)</Label>
                      <Input
                        type="number"
                        value={cfgForm.sla_response_minutes}
                        onChange={(e) => setCfgForm({ ...cfgForm, sla_response_minutes: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Resolve SLA (minutes)</Label>
                      <Input
                        type="number"
                        value={cfgForm.sla_resolve_minutes}
                        onChange={(e) => setCfgForm({ ...cfgForm, sla_resolve_minutes: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Queue Limits */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Queue Limits</h3>
                  <div className="space-y-4">
                    <div className="space-y-2 max-w-xs">
                      <Label className="text-xs text-muted-foreground">Max Open Per User</Label>
                      <Input
                        type="number"
                        value={cfgForm.max_open_per_user}
                        onChange={(e) => setCfgForm({ ...cfgForm, max_open_per_user: Number(e.target.value) })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-semibold">Close on Resolve</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Automatically close tickets when resolved</p>
                      </div>
                      <Switch
                        checked={cfgForm.close_on_resolve}
                        onCheckedChange={(v) => setCfgForm({ ...cfgForm, close_on_resolve: v })}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Discord IDs */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Discord IDs</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Support Role ID</Label>
                      <Input
                        value={cfgForm.support_role_id}
                        onChange={(e) => setCfgForm({ ...cfgForm, support_role_id: e.target.value })}
                        placeholder="000000000000000000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Log Channel ID</Label>
                      <Input
                        value={cfgForm.log_channel_id}
                        onChange={(e) => setCfgForm({ ...cfgForm, log_channel_id: e.target.value })}
                        placeholder="000000000000000000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Category ID</Label>
                      <Input
                        value={cfgForm.category_id}
                        onChange={(e) => setCfgForm({ ...cfgForm, category_id: e.target.value })}
                        placeholder="000000000000000000"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Welcome Message */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Welcome Message</Label>
                  <p className="text-xs text-muted-foreground">Sent to users when they open a ticket</p>
                  <Textarea
                    value={cfgForm.welcome_message}
                    onChange={(e) => setCfgForm({ ...cfgForm, welcome_message: e.target.value })}
                    rows={3}
                    placeholder="Welcome to support! A staff member will be with you shortly."
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveConfig}
                    disabled={saveConfigMutation.isPending}
                    className="bg-black text-white hover:bg-black/90"
                  >
                    {saveConfigMutation.isPending ? "Saving..." : "Save Configuration"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>

      {/* ── Ticket Detail Dialog ────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={(open) => { if (!open) closeDetail(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailLoading ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>Ticket #{detail.ticket_number}</span>
                  <span className="text-muted-foreground font-normal">—</span>
                  <span className="truncate">{detail.subject}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                {/* ── Info Grid ─────────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Creator</p>
                    <p className="text-sm font-medium truncate">{detail.creator_name}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Category</p>
                    <p className="text-sm font-medium">{detail.category || "—"}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm font-medium">{fmtDateTime(detail.created_at)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Elapsed</p>
                    <p className="text-sm font-medium">{fmtElapsed(detail.elapsed_minutes)}</p>
                  </div>
                </div>

                {/* ── SLA Status ────────────────────────────────────────── */}
                {(detail.sla_response_breached || detail.sla_resolve_breached) && (
                  <div className="flex items-center gap-2 bg-red-500/10 text-red-600 rounded-lg px-3 py-2 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="font-medium">
                      {detail.sla_response_breached && detail.sla_resolve_breached
                        ? "Response & resolve SLA breached"
                        : detail.sla_response_breached
                          ? "Response SLA breached"
                          : "Resolve SLA breached"}
                    </span>
                  </div>
                )}

                <Separator />

                {/* ── Assigned Staff ─────────────────────────────────────── */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Assigned Staff</Label>
                  <Select
                    value={detail.assigned_staff_id ? String(detail.assigned_staff_id) : ""}
                    onValueChange={handleAssignStaff}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Assign a staff member" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* ── Priority & Status ─────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Priority</Label>
                    <Select
                      value={detail.priority}
                      onValueChange={(v) => updateTicketMutation.mutate({ priority: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Status</Label>
                    <Select
                      value={detail.status}
                      onValueChange={(v) => updateTicketMutation.mutate({ status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="claimed">Claimed</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* ── Tags ──────────────────────────────────────────────── */}
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    Tags
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(detail.tags ?? []).length > 0 ? (
                      (detail.tags ?? []).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="gap-1 cursor-pointer hover:bg-destructive/15 hover:text-destructive transition-colors"
                          onClick={() => handleRemoveTag(tag)}
                        >
                          {tag}
                          <X className="w-3 h-3" />
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No tags</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a tag..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddTag();
                      }}
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddTag}
                      disabled={!newTag.trim()}
                      className="h-8 px-3"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* ── Internal Note ─────────────────────────────────────── */}
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <StickyNote className="w-3.5 h-3.5" />
                    Internal Note
                  </Label>
                  <Textarea
                    placeholder="Add an internal note..."
                    value={editNote !== null ? editNote : (detail.internal_note ?? "")}
                    onChange={(e) => setEditNote(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      onClick={handleSaveNote}
                      disabled={updateTicketMutation.isPending}
                      className="h-7 px-3 text-xs bg-black text-white hover:bg-black/90"
                    >
                      {updateTicketMutation.isPending ? "Saving..." : "Save Note"}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* ── Messages ──────────────────────────────────────────── */}
                <div>
                  <Label className="text-sm font-semibold mb-3 block">Messages</Label>
                  {detail.messages && detail.messages.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {detail.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "rounded-lg px-3 py-2 text-sm",
                            msg.is_internal
                              ? "bg-yellow-500/10 italic text-yellow-700 dark:text-yellow-400"
                              : msg.is_staff
                                ? "bg-primary/10 text-foreground"
                                : "bg-muted text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold">
                              {msg.is_internal ? "Internal Note" : msg.is_staff ? "Staff" : detail.creator_name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {fmtDateTime(msg.created_at)}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-4 text-center">No messages yet</p>
                  )}
                </div>

                <Separator />

                {/* ── Reply Input ────────────────────────────────────────── */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">Reply</Label>
                    <Button
                      size="sm"
                      variant={internalReply ? "default" : "outline"}
                      className={cn(
                        "h-6 px-2 text-[10px]",
                        internalReply && "bg-yellow-600 hover:bg-yellow-700 text-white"
                      )}
                      onClick={() => setInternalReply(!internalReply)}
                    >
                      <StickyNote className="w-3 h-3 mr-1" />
                      Internal
                    </Button>
                  </div>
                  <Textarea
                    placeholder={internalReply ? "Write an internal note..." : "Type your reply..."}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || sendMessageMutation.isPending}
                      className="h-8 px-4 text-xs bg-black text-white hover:bg-black/90"
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      {sendMessageMutation.isPending ? "Sending..." : internalReply ? "Send Internal Note" : "Send Reply"}
                    </Button>
                  </div>
                </div>

                {/* ── Rating (if resolved) ──────────────────────────────── */}
                {detail.rating !== null && (
                  <>
                    <Separator />
                    <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Customer Rating:</span>
                      <span className="text-sm font-bold">{detail.rating}/5</span>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
