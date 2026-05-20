import { useT } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import { useGuild } from "@/contexts/GuildContext";
import { useCurrency } from "@/hooks/useCurrency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, ShoppingCart, Users, Package,
  BarChart as BarChartIcon, Search, Clock, CheckCircle2,
  XCircle, Truck, AlertCircle, CreditCard,
} from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { PageContainer, PageHeader } from "@/components/infinity";
import { useState, useMemo } from "react";

interface Stats {
  chart: { date: string; revenue: number; orders: number }[];
  total_revenue: number;
  total_orders: number;
  pending_orders: number;
  total_users: number;
  total_products: number;
}

interface OrderItem {
  id: number;
  user_id: number;
  product_id: number | null;
  quantity: number;
  total_price: number;
  status: string;
  payos_order_code: string | null;
  checkout_url: string | null;
  package_name: string | null;
  created_at: string | null;
  user_discord_id: string | null;
  user_username: string | null;
  product_name: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ALL: { label: "Tất cả", color: "bg-secondary text-secondary-foreground", icon: ShoppingCart },
  PENDING: { label: "Chờ thanh toán", color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400", icon: Clock },
  PENDING_MANUAL: { label: "Chờ duyệt", color: "bg-orange-500/15 text-orange-600 dark:text-orange-400", icon: AlertCircle },
  PAID: { label: "Đã thanh toán", color: "bg-green-500/15 text-green-600 dark:text-green-400", icon: CheckCircle2 },
  DELIVERED: { label: "Đã giao", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400", icon: Truck },
  CANCELLED: { label: "Đã hủy", color: "bg-red-500/15 text-red-600 dark:text-red-400", icon: XCircle },
  ERROR: { label: "Lỗi", color: "bg-destructive/15 text-destructive", icon: AlertCircle },
};

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

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ERROR;
  const Icon = cfg.icon;
  return (
    <Badge variant="secondary" className={`${cfg.color} gap-1 text-xs font-medium`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

export function ShopStats() {
  const { t } = useT();
  const { selectedGuildId } = useGuild();
  const { formatPriceCompact, formatPrice } = useCurrency();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["stats", selectedGuildId],
    queryFn: () => apiFetch("/api/stats").then((r) => r.json()),
    refetchInterval: 60_000,
    staleTime: 60_000,
    enabled: !!selectedGuildId,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<OrderItem[]>({
    queryKey: ["orders", selectedGuildId],
    queryFn: () => apiFetch("/api/orders").then((r) => r.json()),
    refetchInterval: 30_000,
    staleTime: 30_000,
    enabled: !!selectedGuildId,
  });

  const fmtMoney = (n: number) => formatPriceCompact(n);

  const statusCounts = useMemo(() => {
    if (!orders) return {};
    const counts: Record<string, number> = {};
    for (const o of orders) {
      counts[o.status] = (counts[o.status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    let list = orders;
    if (statusFilter !== "ALL") {
      list = list.filter((o) => o.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o) =>
        (o.user_username && o.user_username.toLowerCase().includes(q)) ||
        (o.user_discord_id && o.user_discord_id.includes(q)) ||
        (o.product_name && o.product_name.toLowerCase().includes(q)) ||
        (o.package_name && o.package_name.toLowerCase().includes(q)) ||
        String(o.id).includes(q) ||
        (o.payos_order_code && o.payos_order_code.includes(q))
      );
    }
    return list;
  }, [orders, statusFilter, search]);

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <PageContainer size="lg">
      <PageHeader title="Lịch sử giao dịch" icon={CreditCard} />

      {/* ── Stats Cards ── */}
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
          sub={stats ? `${stats.pending_orders} ${t("shopStats_pending")}` : undefined}
        />
        <StatCard icon={Users} label={t("shopStats_totalUsers")} value={stats?.total_users ?? "—"} />
        <StatCard icon={Package} label={t("shopStats_totalProducts")} value={stats?.total_products ?? "—"} />
      </div>

      {/* ── Charts ── */}
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("shopStats_revenue14")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {statsLoading || !stats ? (
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
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v) => v >= 1000 ? `${v / 1000}K` : v} />
                  <Tooltip formatter={(v: unknown) => [formatPrice(v as number), t("shopStats_totalRevenue")]} contentStyle={{ fontSize: 12 }} />
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
            {statsLoading || !stats ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">{t("loading")}</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.chart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                  <Tooltip formatter={(v: unknown) => [v as number, t("shopStats_ordersLabel")]} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Transaction History ── */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Lịch sử giao dịch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên, Discord ID, sản phẩm, mã đơn..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Status tabs */}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const count = key === "ALL" ? (orders?.length ?? 0) : (statusCounts[key] ?? 0);
              const isActive = statusFilter === key;
              return (
                <Button
                  key={key}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setStatusFilter(key)}
                >
                  <cfg.icon className="h-3 w-3" />
                  {cfg.label}
                  <span className={`ml-0.5 text-[10px] ${isActive ? "opacity-80" : "text-muted-foreground"}`}>
                    {count}
                  </span>
                </Button>
              );
            })}
          </div>

          {/* Orders table */}
          {ordersLoading ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">{t("loading")}</div>
          ) : filteredOrders.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-muted-foreground text-sm gap-1">
              <ShoppingCart className="h-8 w-8 opacity-30" />
              Không có giao dịch nào
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">ID</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Khách hàng</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Sản phẩm</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">SL</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Tổng tiền</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Trạng thái</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono text-xs text-muted-foreground">#{o.id}</td>
                        <td className="p-3">
                          <div className="font-medium text-sm truncate max-w-[150px]">{o.user_username || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{o.user_discord_id}</div>
                        </td>
                        <td className="p-3">
                          <div className="truncate max-w-[200px]">{o.product_name || o.package_name || "—"}</div>
                        </td>
                        <td className="p-3 text-center">{o.quantity}</td>
                        <td className="p-3 text-right font-medium">{formatPrice(o.total_price)}</td>
                        <td className="p-3 text-center"><StatusBadge status={o.status} /></td>
                        <td className="p-3 text-right text-xs text-muted-foreground whitespace-nowrap">{formatDate(o.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t px-3 py-2 bg-muted/30 text-xs text-muted-foreground">
                Hiển thị {filteredOrders.length} / {orders?.length ?? 0} giao dịch
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
