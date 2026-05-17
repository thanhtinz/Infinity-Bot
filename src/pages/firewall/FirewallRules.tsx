import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  Shield,
  Plus,
  Trash2,
  Search,
  User,
  Globe,
  Flag,
  Mail,
  Network,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface FirewallRule {
  id: number;
  rule_type: "block" | "allow";
  target_type: "user_id" | "ip" | "country" | "email_domain" | "asn";
  target_value: string;
  reason: string | null;
  created_by: string | null;
  created_at: string | null;
}

interface FirewallStats {
  total_rules: number;
  blocks_24h: number;
  blocks_week: number;
  breakdown: Record<string, number>;
}

type TargetType = FirewallRule["target_type"];

const TARGET_TYPE_CONFIG: Record<TargetType, { label: string; icon: typeof User; placeholder: string; hint: string }> = {
  user_id: { label: "User ID", icon: User, placeholder: "e.g. 123456789012345678", hint: "Discord user ID (17-20 digits)" },
  ip: { label: "IP Address", icon: Globe, placeholder: "e.g. 192.168.1.1", hint: "IPv4 or IPv6 address" },
  country: { label: "Country", icon: Flag, placeholder: "e.g. VN", hint: "ISO 3166-1 alpha-2 country code" },
  email_domain: { label: "Email Domain", icon: Mail, placeholder: "e.g. example.com", hint: "Email domain to block/allow" },
  asn: { label: "ASN", icon: Network, placeholder: "e.g. AS13335", hint: "Autonomous System Number" },
};

// ── Component ──────────────────────────────────────────────────────────────

export function FirewallRules() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Add rule form state
  const [newRuleType, setNewRuleType] = useState<"block" | "allow">("block");
  const [newTargetType, setNewTargetType] = useState<TargetType>("user_id");
  const [newTargetValue, setNewTargetValue] = useState("");
  const [newReason, setNewReason] = useState("");

  // ── Queries ──

  const { data: stats } = useQuery<FirewallStats>({
    queryKey: ["firewall-stats"],
    queryFn: () => apiFetch("/api/firewall/stats").then((r) => r.json()),
  });

  const { data: rules = [], isLoading } = useQuery<FirewallRule[]>({
    queryKey: ["firewall-rules", filterType],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("target_type", filterType);
      return apiFetch(`/api/firewall/rules?${params}`).then((r) => r.json());
    },
  });

  // ── Filtered rules ──

  const filteredRules = useMemo(() => {
    if (!search.trim()) return rules;
    const q = search.toLowerCase();
    return rules.filter(
      (r) =>
        r.target_value.toLowerCase().includes(q) ||
        (r.reason && r.reason.toLowerCase().includes(q)) ||
        r.target_type.toLowerCase().includes(q)
    );
  }, [rules, search]);

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: (data: { rule_type: string; target_type: string; target_value: string; reason?: string }) =>
      apiFetch("/api/firewall/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to create rule");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["firewall-rules"] });
      qc.invalidateQueries({ queryKey: ["firewall-stats"] });
      setAddDialogOpen(false);
      resetForm();
      toast({ title: "Rule created successfully" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to create rule" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/firewall/rules/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Failed to delete rule");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["firewall-rules"] });
      qc.invalidateQueries({ queryKey: ["firewall-stats"] });
      toast({ title: "Rule deleted" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to delete rule" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) =>
      apiFetch("/api/firewall/rules/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }).then((r) => {
        if (!r.ok) throw new Error("Bulk delete failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["firewall-rules"] });
      qc.invalidateQueries({ queryKey: ["firewall-stats"] });
      setSelectedIds(new Set());
      toast({ title: "Rules deleted" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to delete rules" });
    },
  });

  // ── Helpers ──

  function resetForm() {
    setNewRuleType("block");
    setNewTargetType("user_id");
    setNewTargetValue("");
    setNewReason("");
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredRules.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRules.map((r) => r.id)));
    }
  }

  function handleSubmitRule() {
    if (!newTargetValue.trim()) {
      toast({ variant: "destructive", title: "Target value is required" });
      return;
    }
    createMutation.mutate({
      rule_type: newRuleType,
      target_type: newTargetType,
      target_value: newTargetValue.trim(),
      reason: newReason.trim() || undefined,
    });
  }

  // ── Render ──

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Firewall Rules</h1>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Rule
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.total_rules ?? "-"}</p>
              <p className="text-xs text-muted-foreground">Total Rules</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.blocks_24h ?? "-"}</p>
              <p className="text-xs text-muted-foreground">Blocks (24h)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.blocks_week ?? "-"}</p>
              <p className="text-xs text-muted-foreground">Blocks This Week</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Bulk Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="user_id">User ID</SelectItem>
            <SelectItem value="ip">IP Address</SelectItem>
            <SelectItem value="country">Country</SelectItem>
            <SelectItem value="email_domain">Email Domain</SelectItem>
            <SelectItem value="asn">ASN</SelectItem>
          </SelectContent>
        </Select>
        {selectedIds.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
            disabled={bulkDeleteMutation.isPending}
          >
            {bulkDeleteMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Delete {selectedIds.size} rule{selectedIds.size > 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {/* Rules Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredRules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No firewall rules yet.</p>
            <p className="text-xs text-muted-foreground/70 mb-4">
              Add your first rule to protect your server.
            </p>
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.size === filteredRules.length && filteredRules.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="hidden md:table-cell">Value</TableHead>
                <TableHead className="hidden lg:table-cell">Reason</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRules.map((rule) => {
                const cfg = TARGET_TYPE_CONFIG[rule.target_type];
                const Icon = cfg.icon;
                return (
                  <TableRow
                    key={rule.id}
                    className={cn(
                      selectedIds.has(rule.id) && "bg-muted/50",
                      rule.rule_type === "block" && "hover:bg-red-500/5",
                      rule.rule_type === "allow" && "hover:bg-emerald-500/5"
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(rule.id)}
                        onCheckedChange={() => toggleSelect(rule.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={rule.rule_type === "block" ? "destructive" : "default"}
                        className={cn(
                          rule.rule_type === "allow" && "bg-emerald-600 hover:bg-emerald-700"
                        )}
                      >
                        {rule.rule_type === "block" ? "Block" : "Allow"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{cfg.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {rule.target_value}
                      </code>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[200px]">
                      <span className="text-xs text-muted-foreground truncate block">
                        {rule.reason || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {rule.created_at
                          ? formatDistanceToNow(new Date(rule.created_at), { addSuffix: true })
                          : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(rule.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ── Add Rule Dialog ── */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setAddDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Firewall Rule</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Rule type toggle */}
            <div className="space-y-1.5">
              <Label>Rule Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={newRuleType === "block" ? "destructive" : "outline"}
                  onClick={() => setNewRuleType("block")}
                  className="flex-1"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Block
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={newRuleType === "allow" ? "default" : "outline"}
                  onClick={() => setNewRuleType("allow")}
                  className={cn("flex-1", newRuleType === "allow" && "bg-emerald-600 hover:bg-emerald-700")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Allow
                </Button>
              </div>
            </div>

            {/* Target type */}
            <div className="space-y-1.5">
              <Label>Target Type</Label>
              <Select value={newTargetType} onValueChange={(v) => setNewTargetType(v as TargetType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TARGET_TYPE_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-1.5">
                        <cfg.icon className="h-3.5 w-3.5" />
                        {cfg.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target value */}
            <div className="space-y-1.5">
              <Label>Target Value</Label>
              <Input
                placeholder={TARGET_TYPE_CONFIG[newTargetType].placeholder}
                value={newTargetValue}
                onChange={(e) => setNewTargetValue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {TARGET_TYPE_CONFIG[newTargetType].hint}
              </p>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="Why is this rule being added?"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setAddDialogOpen(false); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRule}
              disabled={createMutation.isPending || !newTargetValue.trim()}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
