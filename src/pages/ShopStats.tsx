import { useT } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import { useGuild } from "@/contexts/GuildContext";
import { useCurrency } from "@/hooks/useCurrency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, ShoppingCart, Users, Package, BarChart as BarChartIcon } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { PageContainer, PageHeader } from "@/components/yuri";

interface Stats {
  chart: { date: string; revenue: number; orders: number }[];
  total_revenue: number;
  total_orders: number;
  pending_orders: number;
  total_users: number;
  total_products: number;
}

function StatCard({
  icon: Icon, label, value, sub, highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-md ${highlight ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function ShopStats() {
  const { t } = useT();
  const { selectedGuildId } = useGuild();
  const { formatPriceCompact, formatPrice } = useCurrency();
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["stats", selectedGuildId],
    queryFn: () => apiFetch("/api/stats").then((r) => r.json()),
    refetchInterval: 60_000,
    staleTime: 60_000,
    enabled: !!selectedGuildId,
  });

  const fmtMoney = (n: number) => formatPriceCompact(n);

  return (
    <PageContainer size="lg">
      <PageHeader title={t("shopStats_title")} icon={BarChartIcon} />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={TrendingUp}
          label={t("shopStats_totalRevenue")}
          value={stats ? fmtMoney(stats.total_revenue) : "—"}
          highlight
        />
        <StatCard
          icon={ShoppingCart}
          label={t("shopStats_totalOrders")}
          value={stats?.total_orders ?? "—"}
          sub={stats ? `${stats.pending_orders} ${t("shopStats_pendingOrders")}` : undefined}
        />
        <StatCard icon={Users} label={t("shopStats_totalUsers")} value={stats?.total_users ?? "—"} />
        <StatCard icon={Package} label={t("shopStats_products")} value={stats?.total_products ?? "—"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("shopStats_revenue14")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading || !stats ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">{t("loading")}</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={stats.chart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    className="fill-muted-foreground"
                    tickFormatter={(v) => v >= 1000 ? `${v / 1000}K` : v}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [formatPrice(v as number), t("shopStats_totalRevenue")]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("shopStats_orders14")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading || !stats ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">{t("loading")}</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.chart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                  <Tooltip
                    formatter={(v: unknown) => [v as number, t("shopStats_ordersLabel")]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
