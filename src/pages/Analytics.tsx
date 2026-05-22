import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Repeat,
  Package,
  BarChart3,
  Trophy,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiFetch } from "@/hooks/useApi";
import { useCurrency } from "@/hooks/useCurrency";
import { useGuild } from "@/contexts/GuildContext";
import { PageContainer, PageHeader, StatCard } from "@/components/infinity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface RevenueData {
  daily: { date: string; revenue: number; orders: number }[];
  period_revenue: number;
  period_orders: number;
  period_aov: number;
  all_time_revenue: number;
  all_time_orders: number;
}

interface ProductData {
  product_id: number;
  product_name: string;
  revenue: number;
  units_sold: number;
  order_count: number;
}

interface CustomerData {
  period_buyers: number;
  period_repeat_buyers: number;
  period_repeat_rate: number;
  all_time_buyers: number;
  top_spenders: {
    discord_id: string;
    username: string;
    loyalty_tier: string | null;
    spent: number;
    order_count: number;
  }[];
}

interface FraudOrder {
  order_id: number;
  flag_reason: string | null;
  status: string;
  total_price: number;
  created_at: string | null;
}

type Period = "7d" | "30d" | "90d";

const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

/* ── Tier Badge ─────────────────────────────────────────────────────────── */

const TIER_CLS: Record<string, string> = {
  bronze: "bg-amber-600/15 text-amber-600 border-amber-600/30",
  silver: "bg-slate-500/15 text-slate-500 border-slate-500/30",
  gold: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  vip: "bg-purple-600/15 text-purple-600 border-purple-600/30",
};

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier || !TIER_CLS[tier]) return null;
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-semibold", TIER_CLS[tier])}>
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </Badge>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function fmtPercent(n: number): string {
  return n.toFixed(1) + "%";
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
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

/* ── Component ──────────────────────────────────────────────────────────── */

export function Analytics() {
  const { selectedGuildId } = useGuild();
  const { formatPrice, symbol } = useCurrency();
  const [period, setPeriod] = useState<Period>("30d");
  const [fraudOpen, setFraudOpen] = useState(false);

  const days = PERIOD_DAYS[period];

  /* ── Queries ─────────────────────────────────────────────────────────── */

  const { data: revenue, isLoading: revLoading } = useQuery<RevenueData>({
    queryKey: ["analytics-revenue", selectedGuildId, days],
    queryFn: () => apiFetch(`/api/analytics/revenue?days=${days}`).then((r) => r.json()),
    enabled: !!selectedGuildId,
  });

  const { data: products, isLoading: prodLoading } = useQuery<ProductData[]>({
    queryKey: ["analytics-products", selectedGuildId, days],
    queryFn: () => apiFetch(`/api/analytics/products?days=${days}&limit=10`).then((r) => r.json()),
    enabled: !!selectedGuildId,
  });

  const { data: customers, isLoading: custLoading } = useQuery<CustomerData>({
    queryKey: ["analytics-customers", selectedGuildId, days],
    queryFn: () => apiFetch(`/api/analytics/customers?days=${days}`).then((r) => r.json()),
    enabled: !!selectedGuildId,
  });

  const { data: fraudOrders, isLoading: fraudLoading } = useQuery<FraudOrder[]>({
    queryKey: ["analytics-fraud", selectedGuildId],
    queryFn: () => apiFetch("/api/analytics/fraud").then((r) => r.json()),
    enabled: !!selectedGuildId,
  });

  const loading = revLoading || prodLoading || custLoading;

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <PageContainer>
      <PageHeader title="Analytics" description="Revenue and sales performance" icon={BarChart3}>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={period === p.value ? "default" : "ghost"}
              onClick={() => setPeriod(p.value)}
              className="text-xs h-7 px-3"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </PageHeader>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-28" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              icon={DollarSign}
              label="Total Revenue"
              value={formatPrice(revenue?.period_revenue ?? 0)}
              color="emerald"
            />
            <StatCard
              icon={ShoppingCart}
              label="Total Orders"
              value={(revenue?.period_orders ?? 0).toLocaleString()}
              color="primary"
            />
            <StatCard
              icon={TrendingUp}
              label="Avg Order Value"
              value={formatPrice(revenue?.period_aov ?? 0)}
              color="amber"
            />
            <StatCard
              icon={Repeat}
              label="Repeat Rate"
              value={fmtPercent(customers?.period_repeat_rate ?? 0)}
              color="purple"
            />
          </>
        )}
      </div>

      {/* ── Revenue Chart ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Daily Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {revLoading ? (
            <Skeleton className="h-[280px] w-full rounded-lg" />
          ) : revenue?.daily && revenue.daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={revenue.daily} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tickFormatter={(v: number) => symbol + v.toLocaleString()}
                  tick={{ fontSize: 11 }}
                  width={70}
                  className="text-muted-foreground"
                />
                <Tooltip
                  formatter={(value) => [formatPrice(Number(value ?? 0)), "Revenue"]}
                  labelFormatter={(label) => fmtDate(String(label ?? ""))}
                  contentStyle={{
                    borderRadius: 8,
                    fontSize: 12,
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
              No revenue data for this period
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Top Products ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Top Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          {prodLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-center p-3 font-medium text-muted-foreground w-16">Rank</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Revenue</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Units Sold</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p.product_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold",
                            i === 0
                              ? "bg-amber-500/15 text-amber-600"
                              : i === 1
                                ? "bg-slate-400/15 text-slate-500"
                                : i === 2
                                  ? "bg-orange-500/15 text-orange-600"
                                  : "bg-muted text-muted-foreground"
                          )}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="p-3 font-medium truncate max-w-[200px]">{p.product_name}</td>
                      <td className="p-3 text-right font-medium">{formatPrice(p.revenue)}</td>
                      <td className="p-3 text-right text-muted-foreground">{p.units_sold.toLocaleString()}</td>
                      <td className="p-3 text-right text-muted-foreground">{p.order_count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No product data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Top Spenders ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Top Spenders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {custLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-6" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : customers?.top_spenders && customers.top_spenders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">User</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Tier</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Spent</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.top_spenders.map((s) => (
                    <tr key={s.discord_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {s.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium truncate max-w-[160px]">{s.username}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <TierBadge tier={s.loyalty_tier} />
                      </td>
                      <td className="p-3 text-right font-medium">{formatPrice(s.spent)}</td>
                      <td className="p-3 text-right text-muted-foreground">{s.order_count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No customer data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Flagged Orders (Collapsible) ───────────────────────────────── */}
      <Collapsible open={fraudOpen} onOpenChange={setFraudOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer select-none hover:bg-muted/30 transition-colors rounded-t-[10px]">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Flagged Orders
                {fraudOrders && fraudOrders.length > 0 && (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] px-1.5 py-0">
                    {fraudOrders.length}
                  </Badge>
                )}
                <ChevronDown className={cn("w-4 h-4 ml-auto text-muted-foreground transition-transform", fraudOpen && "rotate-180")} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {fraudLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-16 ml-auto" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : fraudOrders && fraudOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium text-muted-foreground">Order ID</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Reason</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fraudOrders.map((o) => (
                        <tr key={o.order_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-mono text-muted-foreground">#{o.order_id}</td>
                          <td className="p-3 truncate max-w-[200px]">{o.flag_reason || "—"}</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {o.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-medium">{formatPrice(o.total_price)}</td>
                          <td className="p-3 text-right text-muted-foreground whitespace-nowrap">
                            {fmtDateTime(o.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No flagged orders
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </PageContainer>
  );
}

export default Analytics;
