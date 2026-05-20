import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";
import {
  Crown,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Gem,
  CalendarClock,
  Users,
  Info,
  X,
  Sparkles,
  Ticket,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/infinity";

// ── Types ──────────────────────────────────────────────────────────────────

interface PremiumPlan {
  id: number;
  code: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  interval: string;
  active: boolean;
  is_public: boolean;
  sort_order: number;
  badge_text?: string;
  color: string;
  features: Record<string, boolean | number | string>;
  created_at?: string;
  updated_at?: string;
}

interface GuildSubscription {
  id: number;
  guild_id: string;
  plan_id: number;
  plan?: PremiumPlan;
  status: string;
  started_at?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  auto_renew: boolean;
  renewal_reminder_days: number;
  last_reminder_at?: string;
  payment_provider: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

interface SubscriptionPayment {
  id: number;
  guild_id: string;
  subscription_id?: number;
  plan_id?: number;
  plan?: PremiumPlan;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  provider_payment_id?: string;
  period_start?: string;
  period_end?: string;
  notes?: string;
  paid_at?: string;
  created_at?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const INTERVAL_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  lifetime: "Lifetime",
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0",
  },
  trial: {
    label: "Trial",
    className: "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary/80 border-0",
  },
  expired: {
    label: "Expired",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400 border-0",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0",
  },
  past_due: {
    label: "Past Due",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0",
  },
};

const PAYMENT_STATUS_BADGES: Record<string, { label: string; className: string }> = {
  completed: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0",
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0",
  },
  refunded: {
    label: "Refunded",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400 border-0",
  },
};

const FEATURE_LABELS: Record<string, string> = {
  custom_bot: "Custom Bot (custom name & avatar)",
  advanced_captcha: "Advanced Captcha (hCaptcha / Turnstile)",
  scheduled_backup: "Scheduled automatic backup",
  backup_retention: "Longer backup retention",
  remove_branding: "Hide Infinity Bot branding",
  priority_support: "Priority support",
};

/** Normalize features: old Record format → string[], new string[] → as-is */
function getFeatureList(features: unknown): string[] {
  if (Array.isArray(features)) return features as string[];
  if (features && typeof features === "object") {
    return Object.entries(features as Record<string, unknown>)
      .filter(([, v]) => (typeof v === "boolean" ? v : Number(v) > 0))
      .map(([k, v]) => {
        const label = FEATURE_LABELS[k] || k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return typeof v === "number" && v > 0 ? `${label}: ${v} days` : label;
      });
  }
  return [];
}

/** Ordered feature keys for the comparison table */
const COMPARISON_FEATURE_KEYS = [
  "custom_bot",
  "advanced_captcha",
  "scheduled_backup",
  "backup_retention",
  "remove_branding",
  "priority_support",
] as const;

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPrice(amount: number, currency: string, symbol?: string): string {
  const sym = symbol || currency;
  return `${amount.toLocaleString()} ${sym}`;
}

function getDaysRemaining(dateStr?: string): number | null {
  if (!dateStr) return null;
  const end = new Date(dateStr);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ── API ────────────────────────────────────────────────────────────────────

async function fetchGuildSubscription(guildId: string): Promise<GuildSubscription | null> {
  const res = await apiFetch("/api/premium/subscriptions/guild", {
    headers: { "X-Guild-ID": guildId },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load subscription");
  return res.json();
}

async function fetchPublicPlans(): Promise<PremiumPlan[]> {
  const res = await apiFetch("/api/premium/plans/public");
  if (!res.ok) throw new Error("Failed to load plans");
  return res.json();
}

async function fetchGuildPayments(guildId: string): Promise<SubscriptionPayment[]> {
  const res = await apiFetch("/api/premium/payments/guild", {
    headers: { "X-Guild-ID": guildId },
  });
  if (!res.ok) throw new Error("Failed to load payments");
  return res.json();
}

interface PremiumConfig {
  premium_payment_instructions?: string;
  manual_bank_name?: string;
  manual_account_holder?: string;
  manual_account_number?: string;
}

async function fetchPremiumConfig(): Promise<PremiumConfig> {
  const res = await apiFetch("/api/premium/config");
  if (!res.ok) return {};
  return res.json();
}

async function updateSubscription(
  id: number,
  data: Partial<GuildSubscription>
): Promise<GuildSubscription> {
  const res = await apiFetch(`/api/premium/subscriptions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update subscription");
  return res.json();
}

async function redeemCoupon(guildId: string, code: string) {
  const res = await apiFetch("/api/premium/coupons/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Guild-ID": guildId },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "Failed to activate coupon");
  }
  return res.json() as Promise<{ days_granted: number; plan_name?: string; period_end: string }>;
}

// ── Main Component ─────────────────────────────────────────────────────────

export function MyPlan() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId, guilds } = useGuild();

  const guildName = useMemo(
    () => guilds.find((g) => g.id === selectedGuildId)?.name ?? selectedGuildId ?? "Server",
    [guilds, selectedGuildId]
  );

  const subQuery = useQuery({
    queryKey: ["premium-subscription-guild", selectedGuildId],
    queryFn: () =>
      selectedGuildId
        ? fetchGuildSubscription(selectedGuildId)
        : Promise.resolve(null),
    enabled: !!selectedGuildId,
  });

  const plansQuery = useQuery({
    queryKey: ["premium-plans-public"],
    queryFn: fetchPublicPlans,
  });

  const configQuery = useQuery({
    queryKey: ["premium-config-public"],
    queryFn: fetchPremiumConfig,
  });

  const paymentsQuery = useQuery({
    queryKey: ["premium-payments-guild", selectedGuildId],
    queryFn: () =>
      selectedGuildId
        ? fetchGuildPayments(selectedGuildId)
        : Promise.resolve([]),
    enabled: !!selectedGuildId,
  });

  const updateSubMutation = useMutation({
    mutationFn: (args: { id: number; data: Partial<GuildSubscription> }) =>
      updateSubscription(args.id, args.data),
    onSuccess: () => {
      toast({ title: "Updated" });
      qc.invalidateQueries({
        queryKey: ["premium-subscription-guild", selectedGuildId],
      });
    },
    onError: () => {
      toast({ title: "Update failed", variant: "destructive" });
    },
  });

  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");

  const redeemMutation = useMutation({
    mutationFn: (code: string) => redeemCoupon(selectedGuildId!, code),
    onSuccess: (data) => {
      toast({
        title: "🎉 Activation successful!",
        description: `Received ${data.days_granted} days of ${data.plan_name ?? "Premium"} for the server.`,
      });
      setCouponCode("");
      setCouponError("");
      qc.invalidateQueries({ queryKey: ["premium-subscription-guild", selectedGuildId] });
      qc.invalidateQueries({ queryKey: ["premium-payments-guild", selectedGuildId] });
    },
    onError: (e: Error) => {
      setCouponError(e.message);
    },
  });

  function handleRedeem() {
    if (!couponCode.trim() || !selectedGuildId) return;
    setCouponError("");
    redeemMutation.mutate(couponCode.trim().toUpperCase());
  }

  const subscription = subQuery.data;
  const plans = plansQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const premiumConfig = configQuery.data ?? {};

  const daysRemaining = useMemo(
    () => getDaysRemaining(subscription?.current_period_end),
    [subscription?.current_period_end]
  );

  const currentPlan = subscription?.plan;
  const isExpired = subscription?.status === "expired" || (daysRemaining !== null && daysRemaining <= 0);
  const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 14;
  const needsRenewal = isExpired || isExpiringSoon;

  const handleAutoRenewToggle = (autoRenew: boolean) => {
    if (!subscription) return;
    updateSubMutation.mutate({ id: subscription.id, data: { auto_renew: autoRenew } });
  };

  // ── Loading ────────────────────────────────────────────────────────────

  if (subQuery.isLoading || plansQuery.isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  // ── No active subscription ────────────────────────────────────────────

  if (!subscription || isExpired) {
    const publicPlans = plans
      .filter((p) => p.active && p.is_public)
      .sort((a, b) => a.sort_order - b.sort_order);

    return (
      <div className="space-y-8 max-w-5xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            Server Premium Plan
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upgrade <span className="font-medium text-foreground">{guildName}</span> with Premium features for the entire server.
          </p>
        </div>

        {/* Server-scope info */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 dark:border-primary/30 dark:bg-primary/10 px-4 py-3 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary dark:text-primary/80 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-primary dark:text-primary/80 flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Premium plan applies to the entire server
            </p>
            <p className="text-xs text-primary dark:text-primary/80 mt-0.5">
              When an admin purchases a plan, all members in <span className="font-medium">{guildName}</span> get full Premium features immediately.
            </p>
          </div>
        </div>

        {/* Expiry banner */}
        {subscription && isExpired && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Server Premium plan has expired
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">
                Renew now so the entire server can continue using Premium features.
              </p>
            </div>
          </div>
        )}

        {/* Coupon box */}
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Ticket className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Enter coupon code</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Enter coupon code..."
                value={couponCode}
                onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                onKeyDown={e => e.key === "Enter" && handleRedeem()}
                className="font-mono tracking-wider uppercase"
                maxLength={32}
              />
              <Button
                onClick={handleRedeem}
                disabled={redeemMutation.isPending || !couponCode.trim() || !selectedGuildId}
                className="shrink-0"
              >
                {redeemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activate"}
              </Button>
            </div>
            {couponError && (
              <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />{couponError}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Feature Comparison Table ──────────────────────────────────── */}
        {publicPlans.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Compare Features
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Quick overview of what you get with each plan.
            </p>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="min-w-[200px] sticky left-0 bg-muted/50 z-10">
                      Feature
                    </TableHead>
                    <TableHead className="text-center min-w-[100px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-semibold text-muted-foreground">Free</span>
                        <span className="text-xs text-muted-foreground">Free</span>
                      </div>
                    </TableHead>
                    {publicPlans.map((plan) => (
                      <TableHead key={plan.id} className="text-center min-w-[130px]">
                        <div className="flex flex-col items-center gap-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: plan.color || "#6366f1" }}
                          />
                          <span className="font-semibold" style={{ color: plan.color || undefined }}>
                            {plan.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatPrice(plan.price, plan.currency)} / {INTERVAL_LABELS[plan.interval] || plan.interval}
                          </span>
                          {plan.badge_text && (
                            <Badge
                              className="text-[10px] px-1.5 py-0 leading-4"
                              style={{
                                backgroundColor: plan.color || "#6366f1",
                                color: "#fff",
                              }}
                            >
                              {plan.badge_text}
                            </Badge>
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Collect all unique features across plans */}
                  {(() => {
                    const allFeats = new Set<string>();
                    publicPlans.forEach((p) => getFeatureList(p.features).forEach((f) => allFeats.add(f)));
                    return Array.from(allFeats).map((feat) => (
                      <TableRow key={feat}>
                        <TableCell className="font-medium text-sm sticky left-0 bg-background z-10">
                          {feat}
                        </TableCell>
                        {/* Free column */}
                        <TableCell className="text-center">
                          <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                        </TableCell>
                        {/* Premium plan columns */}
                        {publicPlans.map((plan) => {
                          const planFeats = getFeatureList(plan.features);
                          const has = planFeats.includes(feat);
                          return (
                            <TableCell key={plan.id} className="text-center">
                              {has ? (
                                <CheckCircle2
                                  className="h-4 w-4 mx-auto"
                                  style={{ color: plan.color || "#22c55e" }}
                                />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── Plan Cards ────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-lg font-semibold mb-1">Premium Plans</h2>
          <p className="text-sm text-muted-foreground mb-4">Choose a suitable plan — contact admin to activate for your server.</p>
          {publicPlans.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No Premium plans available.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {publicPlans.map((plan) => (
                <Card
                  key={plan.id}
                  className="relative overflow-hidden group hover:shadow-md transition-shadow"
                >
                  {/* Top color accent bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: plan.color || "#6366f1" }}
                  />
                  {plan.badge_text && (
                    <div
                      className="absolute top-3 right-0 px-3 py-1 text-xs font-bold text-white rounded-l-lg"
                      style={{
                        backgroundColor: plan.color || "#6366f1",
                      }}
                    >
                      {plan.badge_text}
                    </div>
                  )}
                  <CardHeader className="pt-5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${plan.color || "#6366f1"}18` }}
                      >
                        <Crown
                          className="h-4 w-4"
                          style={{ color: plan.color || "#6366f1" }}
                        />
                      </div>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                    </div>
                    {plan.description && (
                      <CardDescription className="mt-1.5">
                        {plan.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <span className="text-2xl font-bold">
                        {formatPrice(plan.price, plan.currency)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {" / "}
                        {INTERVAL_LABELS[plan.interval] || plan.interval}
                      </span>
                    </div>

                    {/* Features */}
                    <div className="space-y-2">
                      {getFeatureList(plan.features).map((feat, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-sm"
                          >
                            <CheckCircle2
                              className="h-3.5 w-3.5 shrink-0"
                              style={{ color: plan.color || "#22c55e" }}
                            />
                            <span>{feat}</span>
                          </div>
                        ))}
                    </div>

                    <Button className="w-full" variant="outline">
                      <Gem className="h-4 w-4 mr-2" />
                      Contact admin to activate
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Payment instructions (if set by owner) */}
        {(premiumConfig.premium_payment_instructions || premiumConfig.manual_bank_name) && (
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                Payment Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {premiumConfig.manual_bank_name && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-36 shrink-0">Bank:</span>
                  <span className="font-medium">{premiumConfig.manual_bank_name}</span>
                </div>
              )}
              {premiumConfig.manual_account_holder && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-36 shrink-0">Account Holder:</span>
                  <span className="font-medium">{premiumConfig.manual_account_holder}</span>
                </div>
              )}
              {premiumConfig.manual_account_number && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-36 shrink-0">Account Number:</span>
                  <span className="font-mono font-medium">{premiumConfig.manual_account_number}</span>
                </div>
              )}
              {premiumConfig.premium_payment_instructions && (
                <p className="text-muted-foreground whitespace-pre-line pt-1 border-t">
                  {premiumConfig.premium_payment_instructions}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── Active subscription ───────────────────────────────────────────────

  const statusInfo = STATUS_BADGES[subscription.status] ?? STATUS_BADGES.active;

  const publicPlans = plans
    .filter((p) => p.active && p.is_public)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <PageContainer size="lg">
      <PageHeader title="Server Premium Plan" icon={Crown} description={`Active plan for ${guildName} — all members get full features.`} />

      {/* Server-scope reminder */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 dark:border-primary/30 dark:bg-primary/10 px-4 py-2.5 flex items-center gap-3">
        <Users className="h-4 w-4 text-primary dark:text-primary/80 shrink-0" />
        <p className="text-xs text-primary dark:text-primary/80">
          This Premium plan applies to <span className="font-semibold">{guildName}</span>. All members in the server benefit.
        </p>
      </div>

      {/* Renewal warning banner — yellow when ≤14 days */}
      {isExpiringSoon && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Server Premium plan is about to expire
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {daysRemaining} days remaining. Renew now to avoid disruption for the entire server.
            </p>
          </div>
        </div>
      )}

      {/* Current Plan Card */}
      <Card className="overflow-hidden">
        {/* Top accent bar */}
        {currentPlan && (
          <div
            className="h-1.5"
            style={{ backgroundColor: currentPlan.color || "#6366f1" }}
          />
        )}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentPlan && (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${currentPlan.color || "#6366f1"}18` }}
                >
                  <Crown
                    className="h-5 w-5"
                    style={{ color: currentPlan.color || "#6366f1" }}
                  />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">
                  {currentPlan?.name ?? `Plan #${subscription.plan_id}`}
                </CardTitle>
                {currentPlan?.badge_text && (
                  <Badge
                    className="mt-1"
                    style={{
                      backgroundColor: currentPlan.color || "#6366f1",
                      color: "#fff",
                    }}
                  >
                    {currentPlan.badge_text}
                  </Badge>
                )}
              </div>
            </div>
            <Badge className={statusInfo.className}>
              {statusInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Start Date</p>
              <p className="text-sm font-medium">
                {formatDate(subscription.current_period_start)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Expiry Date</p>
              <p className="text-sm font-medium">
                {formatDate(subscription.current_period_end)}
              </p>
            </div>
            <div
              className={`rounded-lg px-3 py-2 ${
                isExpiringSoon
                  ? "bg-amber-50 dark:bg-amber-950/30"
                  : "bg-muted/50"
              }`}
            >
              <p className={`text-xs ${isExpiringSoon ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                Remaining
              </p>
              <p className={`text-sm font-medium ${isExpiringSoon ? "text-amber-700 dark:text-amber-300" : ""}`}>
                {daysRemaining !== null ? `${daysRemaining} days` : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">Method</p>
              <p className="text-sm font-medium">
                {subscription.payment_provider}
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={subscription.auto_renew}
                onCheckedChange={handleAutoRenewToggle}
                disabled={updateSubMutation.isPending}
              />
              <Label className="text-sm">Auto-renew</Label>
              {updateSubMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </div>
            {needsRenewal && (
              <Button size="sm">
                <CalendarClock className="h-4 w-4 mr-2" />
                Renew
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Coupon box */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Ticket className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Enter coupon code</span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Enter coupon code..."
              value={couponCode}
              onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
              onKeyDown={e => e.key === "Enter" && handleRedeem()}
              className="font-mono tracking-wider uppercase"
              maxLength={32}
            />
            <Button
              onClick={handleRedeem}
              disabled={redeemMutation.isPending || !couponCode.trim() || !selectedGuildId}
              className="shrink-0"
            >
              {redeemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activate"}
            </Button>
          </div>
          {couponError && (
            <p className="text-xs text-destructive mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0" />{couponError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Feature Comparison Table (active sub) ──────────────────────── */}
      {publicPlans.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Compare Features
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Quick overview of what you get with each plan.
          </p>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[200px] sticky left-0 bg-muted/50 z-10">
                    Feature
                  </TableHead>
                  <TableHead className="text-center min-w-[100px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-semibold text-muted-foreground">Free</span>
                      <span className="text-xs text-muted-foreground">Free</span>
                    </div>
                  </TableHead>
                  {publicPlans.map((plan) => {
                    const isCurrentPlan = plan.id === subscription.plan_id;
                    return (
                      <TableHead key={plan.id} className="text-center min-w-[130px]">
                        <div className="flex flex-col items-center gap-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: plan.color || "#6366f1" }}
                          />
                          <span className="font-semibold" style={{ color: plan.color || undefined }}>
                            {plan.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatPrice(plan.price, plan.currency)} / {INTERVAL_LABELS[plan.interval] || plan.interval}
                          </span>
                          {plan.badge_text && (
                            <Badge
                              className="text-[10px] px-1.5 py-0 leading-4"
                              style={{
                                backgroundColor: plan.color || "#6366f1",
                                color: "#fff",
                              }}
                            >
                              {plan.badge_text}
                            </Badge>
                          )}
                          {isCurrentPlan && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 leading-4">
                              Current
                            </Badge>
                          )}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const allFeats = new Set<string>();
                  publicPlans.forEach((p) => getFeatureList(p.features).forEach((f) => allFeats.add(f)));
                  return Array.from(allFeats).map((feat) => (
                    <TableRow key={feat}>
                      <TableCell className="font-medium text-sm sticky left-0 bg-background z-10">
                        {feat}
                      </TableCell>
                      {/* Free column */}
                      <TableCell className="text-center">
                        <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                      </TableCell>
                      {/* Premium plan columns */}
                      {publicPlans.map((plan) => {
                        const planFeats = getFeatureList(plan.features);
                        const has = planFeats.includes(feat);
                        const isCurrentPlan = plan.id === subscription.plan_id;
                        return (
                          <TableCell
                            key={plan.id}
                            className={`text-center ${isCurrentPlan ? "bg-primary/5" : ""}`}
                          >
                            {has ? (
                              <CheckCircle2
                                className="h-4 w-4 mx-auto"
                                style={{ color: plan.color || "#22c55e" }}
                              />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Available Plans */}
      <div>
        <h2 className="text-lg font-semibold mb-1">Premium Plans</h2>
        <p className="text-sm text-muted-foreground mb-4">Upgrade or change the plan for your server.</p>
        {publicPlans.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {publicPlans.map((plan) => {
                const isCurrentPlan = plan.id === subscription.plan_id;
                return (
                  <Card
                    key={plan.id}
                    className={`relative overflow-hidden group hover:shadow-md transition-shadow ${
                      isCurrentPlan
                        ? "ring-2 ring-primary"
                        : ""
                    }`}
                  >
                    {/* Top color accent bar */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ backgroundColor: plan.color || "#6366f1" }}
                    />
                    {plan.badge_text && (
                      <div
                        className="absolute top-3 right-0 px-3 py-1 text-xs font-bold text-white rounded-l-lg"
                        style={{
                          backgroundColor: plan.color || "#6366f1",
                        }}
                      >
                        {plan.badge_text}
                      </div>
                    )}
                    <CardHeader className="pt-5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${plan.color || "#6366f1"}18` }}
                        >
                          <Crown
                            className="h-4 w-4"
                            style={{ color: plan.color || "#6366f1" }}
                          />
                        </div>
                        <CardTitle className="text-lg">
                          {plan.name}
                        </CardTitle>
                        {isCurrentPlan && (
                          <Badge variant="secondary" className="ml-auto">
                            Current
                          </Badge>
                        )}
                      </div>
                      {plan.description && (
                        <CardDescription>
                          {plan.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <span className="text-2xl font-bold">
                          {formatPrice(plan.price, plan.currency)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {" / "}
                          {INTERVAL_LABELS[plan.interval] || plan.interval}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {getFeatureList(plan.features).map((feat, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-sm"
                            >
                              <CheckCircle2
                                className="h-3.5 w-3.5 shrink-0"
                                style={{ color: plan.color || "#22c55e" }}
                              />
                              <span>{feat}</span>
                            </div>
                          ))}
                      </div>

                      {!isCurrentPlan && (
                        <Button className="w-full" variant="outline">
                          <Gem className="h-4 w-4 mr-2" />
                          Contact admin to change plan
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        )}
      </div>

      {/* Payment History */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Payment History</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Cycle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No payments yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((pay) => {
                    const statusInfo =
                      PAYMENT_STATUS_BADGES[pay.status] ??
                      PAYMENT_STATUS_BADGES.pending;
                    return (
                      <TableRow key={pay.id}>
                        <TableCell className="font-medium">
                          {formatPrice(pay.amount, pay.currency)}
                        </TableCell>
                        <TableCell>
                          {pay.plan?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {pay.payment_method}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusInfo.className}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatDate(pay.paid_at)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {pay.period_start && pay.period_end
                            ? `${formatDate(pay.period_start)} – ${formatDate(pay.period_end)}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
