import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Search,
  Eye,
  Copy,
  Check,
  X,
  Plus,
  ShieldBan,
  ShoppingCart,
  DollarSign,
  Tag,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Star,
} from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { useCurrency } from "@/hooks/useCurrency";
import { useGuild } from "@/contexts/GuildContext";
import { PageContainer, PageHeader } from "@/components/infinity";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface Customer {
  id: number;
  discord_id: string;
  username: string;
  total_spent: number;
  order_count: number;
  loyalty_tier: string | null;
  reputation_score: number;
  dispute_count: number;
  chargeback_count: number;
  tags: string[];
  internal_notes: string | null;
  blacklisted: boolean;
  created_at: string;
}

interface CustomerListResponse {
  customers: Customer[];
  total: number;
}

interface RecentOrder {
  id: number;
  status: string;
  total_price: number;
  package_name: string | null;
  payment_method: string | null;
  created_at: string | null;
}

interface CustomerProfile extends Customer {
  recent_orders: RecentOrder[];
}

/* ── Tier Config ────────────────────────────────────────────────────────── */

const TIER_CONFIG: Record<string, { label: string; cls: string }> = {
  bronze: { label: "Bronze", cls: "bg-amber-600/15 text-amber-600 border-amber-600/30" },
  silver: { label: "Silver", cls: "bg-slate-500/15 text-slate-500 border-slate-500/30" },
  gold: { label: "Gold", cls: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
  vip: { label: "VIP", cls: "bg-purple-600/15 text-purple-600 border-purple-600/30" },
};

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier || !TIER_CONFIG[tier]) return <Badge variant="outline" className="text-xs font-semibold bg-muted text-muted-foreground border-muted">None</Badge>;
  const cfg = TIER_CONFIG[tier];
  return (
    <Badge variant="outline" className={cn("text-xs font-semibold", cfg.cls)}>
      {cfg.label}
    </Badge>
  );
}

/* ── Status Config ──────────────────────────────────────────────────────── */

const ORDER_STATUS_CLS: Record<string, string> = {
  PAID: "bg-green-500/15 text-green-600 border-green-500/30",
  PENDING: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  DELIVERED: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  CANCELLED: "bg-red-500/15 text-red-600 border-red-500/30",
  ERROR: "bg-gray-500/15 text-gray-600 border-gray-500/30",
};

/* ── Helpers ────────────────────────────────────────────────────────────── */

function fmtDate(d: string | null): string {
  if (!d) return "Never";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PER_PAGE = 50;

/* ── Component ──────────────────────────────────────────────────────────── */

export function CustomerCRM() {
  const { selectedGuildId } = useGuild();
  const { formatPrice } = useCurrency();
  const { toast } = useToast();
  const qc = useQueryClient();

  /* ── List State ─────────────────────────────────────────────────────── */
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  /* ── Detail State ───────────────────────────────────────────────────── */
  const [selectedDiscordId, setSelectedDiscordId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [blacklistConfirm, setBlacklistConfirm] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [editNotes, setEditNotes] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editRepScore, setEditRepScore] = useState<number | null>(null);

  /* ── List Query ─────────────────────────────────────────────────────── */
  const listParams = new URLSearchParams({
    search,
    tier: tierFilter === "all" ? "" : tierFilter,
    page: String(page),
    per_page: String(PER_PAGE),
  });
  if (statusFilter === "active") listParams.set("blacklisted", "false");
  if (statusFilter === "blacklisted") listParams.set("blacklisted", "true");

  const { data: listData, isLoading: listLoading } = useQuery<CustomerListResponse>({
    queryKey: ["crm-customers", selectedGuildId, search, tierFilter, statusFilter, page],
    queryFn: () => apiFetch(`/api/crm/customers?${listParams}`).then((r) => r.json()),
    enabled: !!selectedGuildId,
  });

  /* ── Detail Query ───────────────────────────────────────────────────── */
  const { data: profile, isLoading: profileLoading } = useQuery<CustomerProfile>({
    queryKey: ["crm-customer", selectedGuildId, selectedDiscordId],
    queryFn: () => apiFetch(`/api/crm/customers/${selectedDiscordId}`).then((r) => r.json()),
    enabled: !!selectedDiscordId && detailOpen,
  });

  /* ── Update Mutation ────────────────────────────────────────────────── */
  const updateMutation = useMutation({
    mutationFn: (body: Partial<Pick<Customer, "internal_notes" | "tags" | "blacklisted" | "reputation_score" | "dispute_count" | "chargeback_count">>) => {
      return apiFetch(`/api/crm/customers/${selectedDiscordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Update failed");
        return r.json();
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-customer", selectedGuildId, selectedDiscordId] });
      qc.invalidateQueries({ queryKey: ["crm-customers", selectedGuildId] });
      toast({ title: "Customer updated" });
    },
    onError: () => {
      toast({ title: "Failed to update customer", variant: "destructive" });
    },
  });

  /* ── Handlers ───────────────────────────────────────────────────────── */

  const openDetail = useCallback((discordId: string) => {
    setSelectedDiscordId(discordId);
    setDetailOpen(true);
    setNewTag("");
    setCopied(false);
    setEditNotes(null);
    setEditRepScore(null);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setSelectedDiscordId(null);
    setBlacklistConfirm(false);
  }, []);

  const handleCopyId = useCallback(async () => {
    if (!profile?.discord_id) return;
    await navigator.clipboard.writeText(profile.discord_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [profile?.discord_id]);

  const handleAddTag = useCallback(() => {
    if (!newTag.trim() || !profile) return;
    const tags = [...profile.tags, newTag.trim()];
    updateMutation.mutate({ tags });
    setNewTag("");
  }, [newTag, profile, updateMutation]);

  const handleRemoveTag = useCallback(
    (tag: string) => {
      if (!profile) return;
      const tags = profile.tags.filter((t) => t !== tag);
      updateMutation.mutate({ tags });
    },
    [profile, updateMutation]
  );

  const handleSaveNotes = useCallback(() => {
    if (!profile || editNotes === null) return;
    updateMutation.mutate({ internal_notes: editNotes });
  }, [profile, editNotes, updateMutation]);

  const handleToggleBlacklist = useCallback(() => {
    if (!profile) return;
    updateMutation.mutate({ blacklisted: !profile.blacklisted });
    setBlacklistConfirm(false);
  }, [profile, updateMutation]);

  const handleSaveRepScore = useCallback(() => {
    if (!profile || editRepScore === null) return;
    updateMutation.mutate({ reputation_score: editRepScore });
  }, [profile, editRepScore, updateMutation]);

  // Derived values for the profile dialog
  const displayNotes = editNotes !== null ? editNotes : (profile?.internal_notes ?? "");
  const displayRepScore = editRepScore !== null ? editRepScore : (profile?.reputation_score ?? 0);

  const totalPages = listData ? Math.ceil(listData.total / PER_PAGE) : 1;

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <PageContainer>
      <PageHeader title="Customer CRM" description="Manage customers, loyalty tiers, and notes" icon={Users} />

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="bronze">Bronze</SelectItem>
            <SelectItem value="silver">Silver</SelectItem>
            <SelectItem value="gold">Gold</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="blacklisted">Blacklisted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Customer Table ──────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          {listLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : listData?.customers && listData.customers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">User</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Tier</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Spent</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Orders</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Tags</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listData.customers.map((c) => (
                    <tr
                      key={c.id}
                      className={cn(
                        "border-b last:border-0 hover:bg-muted/30 transition-colors",
                        c.blacklisted && "bg-red-500/5"
                      )}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {c.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium truncate max-w-[160px]">{c.username}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <TierBadge tier={c.loyalty_tier} />
                      </td>
                      <td className="p-3 text-right font-medium">{formatPrice(c.total_spent)}</td>
                      <td className="p-3 text-right text-muted-foreground">{c.order_count}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {c.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                          {c.tags.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{c.tags.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {c.blacklisted ? (
                          <ShieldBan className="w-4 h-4 text-destructive mx-auto" />
                        ) : null}
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDetail(c.discord_id)}
                          className="h-7 px-2"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No customers found
            </div>
          )}
        </CardContent>

        {/* ── Pagination ────────────────────────────────────────────────── */}
        {listData && listData.total > PER_PAGE && (
          <div className="border-t px-4 py-3 flex items-center justify-between bg-muted/30">
            <p className="text-xs text-muted-foreground">
              {page * PER_PAGE - PER_PAGE + 1}–{Math.min(page * PER_PAGE, listData.total)} of{" "}
              {listData.total.toLocaleString()} customers
            </p>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Customer Detail Dialog ──────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={(open) => { if (!open) closeDetail(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {profileLoading ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : profile ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-lg font-bold text-primary">
                    {profile.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-lg">{profile.username}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {profile.discord_id}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={handleCopyId}
                      >
                        {copied ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                      <TierBadge tier={profile.loyalty_tier} />
                      {profile.blacklisted && (
                        <Badge variant="outline" className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px]">
                          Blacklisted
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                {/* ── Stats Row ─────────────────────────────────────────── */}
                <div className="grid grid-cols-5 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <DollarSign className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Total Spent</p>
                    <p className="text-sm font-bold">{formatPrice(profile.total_spent)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <ShoppingCart className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Orders</p>
                    <p className="text-sm font-bold">{profile.order_count}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <Star className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Rep Score</p>
                    <p className="text-sm font-bold">{profile.reputation_score}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <ShieldAlert className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Disputes</p>
                    <p className="text-sm font-bold">{profile.dispute_count}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <ShieldBan className="w-4 h-4 text-destructive mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Chargebacks</p>
                    <p className="text-sm font-bold">{profile.chargeback_count}</p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Joined {fmtDate(profile.created_at)}
                </div>

                <Separator />

                {/* ── Tags ──────────────────────────────────────────────── */}
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Tag className="w-3.5 h-3.5" />
                    Tags
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {profile.tags.length > 0 ? (
                      profile.tags.map((tag) => (
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

                {/* ── Internal Notes ────────────────────────────────────── */}
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <FileText className="w-3.5 h-3.5" />
                    Internal Notes
                  </Label>
                  <Textarea
                    placeholder="Add internal notes about this customer..."
                    value={displayNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    onBlur={handleSaveNotes}
                    rows={3}
                    className="text-xs"
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={updateMutation.isPending}
                      className="h-7 px-3 text-xs"
                    >
                      {updateMutation.isPending ? "Saving..." : "Save Notes"}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* ── Reputation Score ──────────────────────────────────── */}
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Star className="w-3.5 h-3.5" />
                    Reputation Score
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={displayRepScore}
                      onChange={(e) => setEditRepScore(Number(e.target.value))}
                      className="h-8 w-24 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSaveRepScore}
                      disabled={updateMutation.isPending}
                      className="h-8 px-3 text-xs"
                    >
                      Save
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* ── Blacklist Toggle ──────────────────────────────────── */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <ShieldBan className="w-3.5 h-3.5" />
                      Blacklist
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Prevent this customer from placing orders
                    </p>
                  </div>
                  <Switch
                    checked={profile.blacklisted}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setBlacklistConfirm(true);
                      } else {
                        updateMutation.mutate({ blacklisted: false });
                      }
                    }}
                  />
                </div>

                <Separator />

                {/* ── Recent Orders ─────────────────────────────────────── */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Recent Orders</Label>
                  {profile.recent_orders && profile.recent_orders.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="text-left p-2 font-medium text-muted-foreground">ID</th>
                            <th className="text-left p-2 font-medium text-muted-foreground">Product</th>
                            <th className="text-right p-2 font-medium text-muted-foreground">Total</th>
                            <th className="text-center p-2 font-medium text-muted-foreground">Status</th>
                            <th className="text-right p-2 font-medium text-muted-foreground">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.recent_orders.map((o) => (
                            <tr key={o.id} className="border-b last:border-0">
                              <td className="p-2 font-mono text-muted-foreground">#{o.id}</td>
                              <td className="p-2 truncate max-w-[160px]">{o.package_name || "—"}</td>
                              <td className="p-2 text-right font-medium">{formatPrice(o.total_price)}</td>
                              <td className="p-2 text-center">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] px-1.5 py-0",
                                    ORDER_STATUS_CLS[o.status] || ORDER_STATUS_CLS.ERROR
                                  )}
                                >
                                  {o.status}
                                </Badge>
                              </td>
                              <td className="p-2 text-right text-muted-foreground whitespace-nowrap">
                                {fmtDateTime(o.created_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-4 text-center">No orders found</p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Blacklist Confirm Dialog ────────────────────────────────────── */}
      <AlertDialog open={blacklistConfirm} onOpenChange={setBlacklistConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Blacklist Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to blacklist {profile?.username}? They will no longer be able to place orders.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleBlacklist}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Blacklist
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

export default CustomerCRM;
