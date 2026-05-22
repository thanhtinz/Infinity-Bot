import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";
import { useToast } from "@/hooks/use-toast";
import { PageContainer, PageHeader, StatCard, EmptyState } from "@/components/infinity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Users,
  Clock,
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  Timer,
  CheckCircle,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface StaffSummary {
  total_staff: number;
  clocked_in: number;
  total_commission_unpaid: number;
}

interface StaffProfile {
  id: number;
  discord_id: string;
  display_name: string;
  role_title: string;
  avatar_url: string | null;
  commission_rate: number;
  total_orders_handled: number;
  total_hours_worked: number;
  is_active: boolean;
  clocked_in: boolean;
  clock_in_at: string | null;
  notes: string | null;
}

interface StaffShift {
  id: number;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  note: string | null;
}

interface CommissionRule {
  id: number;
  name: string;
  rule_type: "flat_rate" | "tier" | "per_category";
  rate: number;
  min_order_value: number | null;
  active: boolean;
}

interface CommissionLog {
  id: number;
  staff_id: number;
  order_id: number;
  commission_amount: number;
  created_at: string;
  paid: boolean;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function formatElapsed(startIso: string): string {
  const ms = Date.now() - new Date(startIso).getTime();
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ── Component ──────────────────────────────────────────────────────────── */

export default function StaffManagement() {
  const { selectedGuildId } = useGuild();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState("overview");

  /* ── Profile dialog state ── */
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editProfileId, setEditProfileId] = useState<number | null>(null);
  const [pfDiscordId, setPfDiscordId] = useState("");
  const [pfDisplayName, setPfDisplayName] = useState("");
  const [pfRoleTitle, setPfRoleTitle] = useState("");
  const [pfCommissionRate, setPfCommissionRate] = useState(0);
  const [pfNotes, setPfNotes] = useState("");

  /* ── Delete confirm ── */
  const [deleteTarget, setDeleteTarget] = useState<{ type: "profile" | "rule"; id: number; name: string } | null>(null);

  /* ── Shifts dialog ── */
  const [shiftsProfileId, setShiftsProfileId] = useState<number | null>(null);

  /* ── Commission rule dialog ── */
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editRuleId, setEditRuleId] = useState<number | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState<"flat_rate" | "tier" | "per_category">("flat_rate");
  const [ruleRate, setRuleRate] = useState(0);
  const [ruleMinOrder, setRuleMinOrder] = useState<number>(0);
  const [ruleActive, setRuleActive] = useState(true);

  /* ── Queries ── */

  const summaryQ = useQuery<StaffSummary>({
    queryKey: ["staff-summary", selectedGuildId],
    queryFn: () => apiFetch("/api/staff/summary").then((r) => r.json()),
  });

  const profilesQ = useQuery<StaffProfile[]>({
    queryKey: ["staff-profiles", selectedGuildId],
    queryFn: () => apiFetch("/api/staff/profiles").then((r) => r.json()),
  });

  const rulesQ = useQuery<CommissionRule[]>({
    queryKey: ["commission-rules", selectedGuildId],
    queryFn: () => apiFetch("/api/staff/commission-rules").then((r) => r.json()),
  });

  const logsQ = useQuery<CommissionLog[]>({
    queryKey: ["commission-logs-unpaid", selectedGuildId],
    queryFn: () => apiFetch("/api/staff/commission-logs?paid=false").then((r) => r.json()),
  });

  const shiftsQ = useQuery<StaffShift[]>({
    queryKey: ["staff-shifts", shiftsProfileId, selectedGuildId],
    queryFn: () =>
      shiftsProfileId
        ? apiFetch(`/api/staff/profiles/${shiftsProfileId}/shifts`).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!shiftsProfileId,
  });

  /* ── Profile name lookup ── */
  const profileNameMap = useMemo(() => {
    const map = new Map<number, string>();
    if (profilesQ.data) {
      for (const p of profilesQ.data) map.set(p.id, p.display_name);
    }
    return map;
  }, [profilesQ.data]);

  /* ── Invalidate helpers ── */
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["staff-summary", selectedGuildId] });
    qc.invalidateQueries({ queryKey: ["staff-profiles", selectedGuildId] });
    qc.invalidateQueries({ queryKey: ["commission-logs-unpaid", selectedGuildId] });
  };

  /* ── Mutations ── */

  const createProfile = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/api/staff/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      invalidateAll();
      closeProfileDialog();
      toast({ title: "Staff member added" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to add staff member" }),
  });

  const updateProfile = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      apiFetch(`/api/staff/profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      invalidateAll();
      closeProfileDialog();
      toast({ title: "Staff member updated" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to update staff member" }),
  });

  const deleteProfile = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/staff/profiles/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      invalidateAll();
      setDeleteTarget(null);
      toast({ title: "Staff member removed" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to remove staff member" }),
  });

  const clockIn = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/staff/profiles/${id}/clockin`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Clocked in" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to clock in" }),
  });

  const clockOut = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/staff/profiles/${id}/clockout`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Clocked out" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to clock out" }),
  });

  const markPaid = useMutation({
    mutationFn: (logIds: number[]) =>
      apiFetch("/api/staff/commission-logs/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_ids: logIds }),
      }).then((r) => r.json()),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Commissions marked as paid" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to mark as paid" }),
  });

  const createRule = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/api/staff/commission-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-rules", selectedGuildId] });
      closeRuleDialog();
      toast({ title: "Commission rule added" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to add rule" }),
  });

  const updateRule = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      apiFetch(`/api/staff/commission-rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-rules", selectedGuildId] });
      closeRuleDialog();
      toast({ title: "Commission rule updated" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to update rule" }),
  });

  const deleteRule = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/staff/commission-rules/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-rules", selectedGuildId] });
      setDeleteTarget(null);
      toast({ title: "Commission rule deleted" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to delete rule" }),
  });

  /* ── Dialog helpers ── */

  function openAddProfile() {
    setEditProfileId(null);
    setPfDiscordId("");
    setPfDisplayName("");
    setPfRoleTitle("");
    setPfCommissionRate(0);
    setPfNotes("");
    setProfileDialogOpen(true);
  }

  function openEditProfile(p: StaffProfile) {
    setEditProfileId(p.id);
    setPfDiscordId(p.discord_id);
    setPfDisplayName(p.display_name);
    setPfRoleTitle(p.role_title);
    setPfCommissionRate(p.commission_rate);
    setPfNotes(p.notes ?? "");
    setProfileDialogOpen(true);
  }

  function closeProfileDialog() {
    setProfileDialogOpen(false);
    setEditProfileId(null);
  }

  function saveProfile() {
    const body = {
      discord_id: pfDiscordId,
      display_name: pfDisplayName,
      role_title: pfRoleTitle,
      commission_rate: pfCommissionRate,
      notes: pfNotes || null,
    };
    if (editProfileId) {
      updateProfile.mutate({ id: editProfileId, ...body });
    } else {
      createProfile.mutate(body);
    }
  }

  function openAddRule() {
    setEditRuleId(null);
    setRuleName("");
    setRuleType("flat_rate");
    setRuleRate(0);
    setRuleMinOrder(0);
    setRuleActive(true);
    setRuleDialogOpen(true);
  }

  function openEditRule(r: CommissionRule) {
    setEditRuleId(r.id);
    setRuleName(r.name);
    setRuleType(r.rule_type);
    setRuleRate(r.rate);
    setRuleMinOrder(r.min_order_value ?? 0);
    setRuleActive(r.active);
    setRuleDialogOpen(true);
  }

  function closeRuleDialog() {
    setRuleDialogOpen(false);
    setEditRuleId(null);
  }

  function saveRule() {
    const body = {
      name: ruleName,
      rule_type: ruleType,
      rate: ruleRate,
      min_order_value: ruleMinOrder || null,
      active: ruleActive,
    };
    if (editRuleId) {
      updateRule.mutate({ id: editRuleId, ...body });
    } else {
      createRule.mutate(body);
    }
  }

  /* ── Derived data ── */

  const clockedProfiles = useMemo(
    () => (profilesQ.data ?? []).filter((p) => p.clocked_in),
    [profilesQ.data]
  );

  const unpaidLogs = logsQ.data ?? [];

  /* ── Render ── */

  return (
    <PageContainer>
      <PageHeader title="Staff Management" description="Manage staff, shifts, and commissions" icon={Users}>
        <Button onClick={openAddProfile} className="bg-black text-white hover:bg-black/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="commission-rules">Commission Rules</TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 1 — Overview
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* KPI Cards */}
          {summaryQ.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-[10px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                icon={Users}
                label="Total Active Staff"
                value={summaryQ.data?.total_staff ?? 0}
                color="primary"
              />
              <StatCard
                icon={Clock}
                label="Currently Clocked In"
                value={summaryQ.data?.clocked_in ?? 0}
                color="emerald"
              />
              <StatCard
                icon={DollarSign}
                label="Unpaid Commission"
                value={formatCurrency(summaryQ.data?.total_commission_unpaid ?? 0)}
                color="amber"
              />
            </div>
          )}

          {/* Active Shifts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Active Shifts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profilesQ.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : clockedProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No staff currently clocked in</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Clocked In At</TableHead>
                      <TableHead>Elapsed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clockedProfiles.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.display_name}</TableCell>
                        <TableCell>{p.role_title}</TableCell>
                        <TableCell>{p.clock_in_at ? formatDate(p.clock_in_at) : "—"}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                            <Clock className="h-3.5 w-3.5" />
                            {p.clock_in_at ? formatElapsed(p.clock_in_at) : "—"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Unpaid Commission Logs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Unpaid Commissions
                </CardTitle>
                {unpaidLogs.length > 0 && (
                  <Button
                    size="sm"
                    className="bg-black text-white hover:bg-black/90"
                    onClick={() => markPaid.mutate(unpaidLogs.map((l) => l.id))}
                    disabled={markPaid.isPending}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    Mark All Paid
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {logsQ.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : unpaidLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No unpaid commissions</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {profileNameMap.get(log.staff_id) ?? `Staff #${log.staff_id}`}
                        </TableCell>
                        <TableCell>#{log.order_id}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(log.commission_amount)}</TableCell>
                        <TableCell>{formatDate(log.created_at)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            Unpaid
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 2 — Profiles
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="profiles" className="space-y-4 mt-4">
          {profilesQ.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-[10px]" />
              ))}
            </div>
          ) : (profilesQ.data ?? []).length === 0 ? (
            <EmptyState
              icon={Users}
              title="No staff yet"
              description="Add your first staff member to get started."
            >
              <Button onClick={openAddProfile} className="bg-black text-white hover:bg-black/90">
                <Plus className="h-4 w-4 mr-2" />
                Add Staff
              </Button>
            </EmptyState>
          ) : (
            (profilesQ.data ?? []).map((profile) => (
              <div
                key={profile.id}
                className="bg-card rounded-[10px] shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow px-5 py-4"
              >
                <div className="flex flex-wrap items-center gap-4">
                  {/* Avatar / Initials */}
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.display_name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-sm font-bold text-primary">
                        {initials(profile.display_name)}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-card-foreground truncate">
                        {profile.display_name}
                      </span>
                      {profile.is_active ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px] px-1.5 py-0">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{profile.role_title}</p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">Commission</p>
                      <p className="font-semibold">{profile.commission_rate}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">Orders</p>
                      <p className="font-semibold tabular-nums">{profile.total_orders_handled}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">Hours</p>
                      <p className="font-semibold tabular-nums">{profile.total_hours_worked}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {profile.clocked_in ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => clockOut.mutate(profile.id)}
                        disabled={clockOut.isPending}
                        className="text-amber-600 border-amber-300 hover:bg-amber-50"
                      >
                        <Clock className="h-3.5 w-3.5 mr-1.5" />
                        Clock Out
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => clockIn.mutate(profile.id)}
                        disabled={clockIn.isPending}
                        className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                      >
                        <Timer className="h-3.5 w-3.5 mr-1.5" />
                        Clock In
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setShiftsProfileId(profile.id)}
                      title="View shifts"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditProfile(profile)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() =>
                        setDeleteTarget({ type: "profile", id: profile.id, name: profile.display_name })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 3 — Commission Rules
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="commission-rules" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={openAddRule} className="bg-black text-white hover:bg-black/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>

          {rulesQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (rulesQ.data ?? []).length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No commission rules"
              description="Create rules to automate staff commission calculations."
            >
              <Button onClick={openAddRule} className="bg-black text-white hover:bg-black/90">
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </EmptyState>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Min Order Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(rulesQ.data ?? []).map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {rule.rule_type.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{rule.rate}%</TableCell>
                        <TableCell>
                          {rule.min_order_value != null ? formatCurrency(rule.min_order_value) : "—"}
                        </TableCell>
                        <TableCell>
                          {rule.active ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditRule(rule)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() =>
                                setDeleteTarget({ type: "rule", id: rule.id, name: rule.name })
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════
          DIALOG — Add / Edit Profile
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={profileDialogOpen} onOpenChange={(open) => !open && closeProfileDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editProfileId ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pf-discord-id">Discord ID</Label>
              <Input
                id="pf-discord-id"
                value={pfDiscordId}
                onChange={(e) => setPfDiscordId(e.target.value)}
                placeholder="e.g. 123456789012345678"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-display-name">Display Name</Label>
              <Input
                id="pf-display-name"
                value={pfDisplayName}
                onChange={(e) => setPfDisplayName(e.target.value)}
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-role-title">Role Title</Label>
              <Input
                id="pf-role-title"
                value={pfRoleTitle}
                onChange={(e) => setPfRoleTitle(e.target.value)}
                placeholder="e.g. Sales Associate"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-commission-rate">Commission Rate (%)</Label>
              <Input
                id="pf-commission-rate"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={pfCommissionRate}
                onChange={(e) => setPfCommissionRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-notes">Notes</Label>
              <Textarea
                id="pf-notes"
                value={pfNotes}
                onChange={(e) => setPfNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeProfileDialog}>
              Cancel
            </Button>
            <Button
              className="bg-black text-white hover:bg-black/90"
              onClick={saveProfile}
              disabled={createProfile.isPending || updateProfile.isPending || !pfDiscordId || !pfDisplayName}
            >
              {createProfile.isPending || updateProfile.isPending
                ? "Saving..."
                : editProfileId
                  ? "Update"
                  : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          DIALOG — Add / Edit Commission Rule
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={ruleDialogOpen} onOpenChange={(open) => !open && closeRuleDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editRuleId ? "Edit Commission Rule" : "Add Commission Rule"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input
                id="rule-name"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g. Standard Commission"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rule Type</Label>
              <Select value={ruleType} onValueChange={(v) => setRuleType(v as typeof ruleType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat_rate">Flat Rate</SelectItem>
                  <SelectItem value="tier">Tier</SelectItem>
                  <SelectItem value="per_category">Per Category</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-rate">Rate (%)</Label>
              <Input
                id="rule-rate"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={ruleRate}
                onChange={(e) => setRuleRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-min-order">Min Order Value</Label>
              <Input
                id="rule-min-order"
                type="number"
                min={0}
                step={0.01}
                value={ruleMinOrder}
                onChange={(e) => setRuleMinOrder(parseFloat(e.target.value) || 0)}
                placeholder="0 = no minimum"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="rule-active">Active</Label>
              <Switch id="rule-active" checked={ruleActive} onCheckedChange={setRuleActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeRuleDialog}>
              Cancel
            </Button>
            <Button
              className="bg-black text-white hover:bg-black/90"
              onClick={saveRule}
              disabled={createRule.isPending || updateRule.isPending || !ruleName}
            >
              {createRule.isPending || updateRule.isPending
                ? "Saving..."
                : editRuleId
                  ? "Update"
                  : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          DIALOG — View Shifts
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!shiftsProfileId} onOpenChange={(open) => !open && setShiftsProfileId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Shift History
            </DialogTitle>
          </DialogHeader>

          {shiftsQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (shiftsQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No shifts recorded</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(shiftsQ.data ?? []).slice(0, 10).map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell className="text-xs">{formatDate(shift.clock_in)}</TableCell>
                    <TableCell className="text-xs">
                      {shift.clock_out ? formatDate(shift.clock_out) : "—"}
                    </TableCell>
                    <TableCell>
                      {shift.duration_minutes != null ? (
                        <span className="font-medium tabular-nums">
                          {Math.floor(shift.duration_minutes / 60)}h {shift.duration_minutes % 60}m
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                      {shift.note ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShiftsProfileId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          DIALOG — Delete Confirm
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.type === "profile" ? "Remove staff member?" : "Delete commission rule?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget?.type === "profile"
              ? `${deleteTarget.name} will be removed from staff. This cannot be undone.`
              : `"${deleteTarget?.name}" will be permanently deleted. This cannot be undone.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                deleteTarget?.type === "profile"
                  ? deleteProfile.isPending
                  : deleteRule.isPending
              }
              onClick={() => {
                if (!deleteTarget) return;
                if (deleteTarget.type === "profile") {
                  deleteProfile.mutate(deleteTarget.id);
                } else {
                  deleteRule.mutate(deleteTarget.id);
                }
              }}
            >
              {deleteTarget?.type === "profile" ? "Remove" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
