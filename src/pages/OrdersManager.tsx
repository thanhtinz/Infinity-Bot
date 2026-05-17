import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChannelSelect } from "@/components/ChannelSelect";
import { RefreshCw, Plus, ShoppingCart, User2, Truck, ExternalLink, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Order, Product } from "../types";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";

export function OrdersManager() {
  const { t } = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);

  const STATUS_CLS: Record<string, string> = {
    PAID: "bg-green-500/15 text-green-600 border-green-500/30",
    PENDING: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    DELIVERING: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    DELIVERED: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    CANCELLED: "bg-red-500/15 text-red-600 border-red-500/30",
    ERROR: "bg-gray-500/15 text-gray-600 border-gray-500/30",
  };

  const STATUS_LABEL: Record<string, string> = {
    PAID: t("orders_paid"),
    PENDING: t("orders_pending"),
    DELIVERING: t("orders_delivered"),
    DELIVERED: t("orders_delivered"),
    CANCELLED: t("orders_cancelled"),
    ERROR: t("error"),
  };

  // Create order form
  const [discordUid, setDiscordUid] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [selectedPrice, setSelectedPrice] = useState<number>(0);
  const [orderStatus, setOrderStatus] = useState("PENDING");
  const [deliverTarget, setDeliverTarget] = useState<Order | null>(null);
  const [dmContent, setDmContent] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [customProductName, setCustomProductName] = useState("");
  const [sendQrChannelId, setSendQrChannelId] = useState("");

  const { data: orders = [], isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: () => apiFetch("/api/orders").then((r) => r.json()),
    refetchInterval: 15000,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch("/api/products").then((r) => r.json()),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/api/orders/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: t("toast_statusUpdated") });
    },
    onError: () => toast({ variant: "destructive", title: t("error") }),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setCreateOpen(false);
      resetCreateForm();
      toast({ title: t("toast_orderCreated") });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: t("error"), description: e.message }),
  });

  const deliverMutation = useMutation({
    mutationFn: ({ id, dm_content }: { id: number; dm_content: string }) =>
      apiFetch(`/api/orders/${id}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dm_content }),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setDeliverTarget(null);
      setDmContent("");
      toast({ title: t("toast_deliveredSuccess") });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: t("toast_deliveryError"), description: e.message }),
  });

  const resetCreateForm = () => {
    setDiscordUid(""); setSelectedProductId(""); setSelectedPackage(""); setSelectedPrice(0); setOrderStatus("PENDING");
    setIsCustom(false); setCustomProductName(""); setSendQrChannelId("");
  };

  // When product selected → reset package
  const handleSelectProduct = (pid: string) => {
    setSelectedProductId(pid); setSelectedPackage(""); setSelectedPrice(0);
  };

  // Khi chọn package → tự điền giá
  const handleSelectPackage = (pkgName: string) => {
    setSelectedPackage(pkgName);
    const prod = products.find((p) => String(p.id) === selectedProductId);
    const pkg = prod?.packages?.find((pk) => pk.name === pkgName);
    if (pkg) setSelectedPrice(pkg.price);
  };

  const selectedProduct = products.find((p) => String(p.id) === selectedProductId);
  const activePackages = selectedProduct?.packages?.filter((pk) => pk.active) ?? [];

  const filtered = filter === "ALL" ? orders : orders.filter((o) => o.status === filter);

  // Stats
  const totalPaid = orders.filter((o) => o.status === "PAID").reduce((s, o) => s + o.total_price, 0);
  const counts = { ALL: orders.length, PENDING: 0, PAID: 0, DELIVERING: 0, DELIVERED: 0, CANCELLED: 0, ERROR: 0 };
  orders.forEach((o) => { if (o.status in counts) (counts as Record<string,number>)[o.status]++; });
  const paidAndDelivered = counts.PAID + counts.DELIVERING + counts.DELIVERED;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">{t("orders_title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> {t("orders_createOrder")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("orders_title"), value: counts.ALL, cls: "" },
          { label: t("orders_pending"), value: counts.PENDING, cls: "text-yellow-600" },
          { label: t("orders_paid") + " + " + t("orders_delivered"), value: paidAndDelivered, cls: "text-green-600" },
          { label: t("orders_amount"), value: totalPaid.toLocaleString() + " đ", cls: "text-primary" },
        ].map(({ label, value, cls }) => (
          <Card key={label}>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn("text-lg font-bold", cls)}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["ALL", "PENDING", "PAID", "DELIVERING", "DELIVERED", "CANCELLED"] as const).map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
            className="text-xs"
          >
            {s === "ALL" ? t("orders_all") : STATUS_LABEL[s]} ({(counts as Record<string,number>)[s] ?? 0})
          </Button>
        ))}
      </div>

      {/* Orders — card list (mobile-friendly) */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t("loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">{t("orders_empty")}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  {/* Left: info */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">#{order.id}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", STATUS_CLS[order.status] ?? "")}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </div>
                    {/* User */}
                    <div className="flex items-center gap-1.5 text-sm">
                      <User2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{order.user_username || "—"}</span>
                      {order.user_discord_id && (
                        <span className="text-xs text-muted-foreground font-mono">({order.user_discord_id})</span>
                      )}
                    </div>
                    {/* Product */}
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{order.product_name || `#${order.product_id}`}</span>
                      {order.package_name && (
                        <Badge variant="secondary" className="text-xs">{order.package_name}</Badge>
                      )}
                    </div>
                    {/* Date */}
                    <p className="text-xs text-muted-foreground">
                      {order.created_at ? new Date(order.created_at).toLocaleString("vi-VN") : "—"}
                    </p>
                  </div>

                  {/* Right: price + status changer */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="font-bold text-sm">{order.total_price.toLocaleString()} đ</span>
                    <Select
                      value={order.status}
                      onValueChange={(s) => updateStatusMutation.mutate({ id: order.id, status: s })}
                    >
                      <SelectTrigger className="w-36 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">{t("orders_pending")}</SelectItem>
                        <SelectItem value="PAID">{t("orders_paid")}</SelectItem>
                        <SelectItem value="DELIVERING">{t("orders_delivered")}</SelectItem>
                        <SelectItem value="DELIVERED">{t("orders_delivered")}</SelectItem>
                        <SelectItem value="CANCELLED">{t("orders_cancelled")}</SelectItem>
                        <SelectItem value="ERROR">{t("error")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {order.status === "PAID" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => { setDeliverTarget(order); setDmContent(""); }}
                      >
                        <Truck className="mr-1 h-3.5 w-3.5" /> {t("orders_markDelivered")}
                      </Button>
                    )}
                    {order.status === "PENDING" && order.checkout_url && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 text-yellow-600 border-yellow-500/40 hover:bg-yellow-500/10"
                          asChild
                        >
                          <a href={order.checkout_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1 h-3 w-3" /> PayOS
                          </a>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground"
                          title={t("copy")}
                          onClick={() => {
                            navigator.clipboard.writeText(order.checkout_url!);
                            toast({ title: t("toast_paymentLinkCopied") });
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create order dialog ── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); resetCreateForm(); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("orders_createOrder")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Discord UID */}
            <div className="space-y-1.5">
              <Label>Discord UID <span className="text-destructive">*</span></Label>
              <Input
                placeholder="VD: 123456789012345678"
                value={discordUid}
                onChange={(e) => setDiscordUid(e.target.value)}
              />
            </div>
            {/* Products + Toggle Custom */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{t("orders_items")} <span className="text-destructive">*</span></Label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Custom</span>
                  <Switch checked={isCustom} onCheckedChange={(v) => {
                    setIsCustom(v);
                    setSelectedProductId("");
                    setSelectedPackage("");
                    setCustomProductName("");
                    setSelectedPrice(0);
                  }} />
                </div>
              </div>
              {isCustom ? (
                <Input
                  placeholder={t("orders_selectProduct")}
                  value={customProductName}
                  onChange={(e) => setCustomProductName(e.target.value)}
                />
              ) : (
                <Select value={selectedProductId} onValueChange={handleSelectProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("orders_selectProduct")} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.filter((p) => p.active).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {/* Package */}
            {activePackages.length > 0 && (
              <div className="space-y-1.5">
                <Label>Package</Label>
                <Select value={selectedPackage} onValueChange={handleSelectPackage}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("orders_selectProduct")} />
                  </SelectTrigger>
                  <SelectContent>
                    {activePackages.map((pk) => (
                      <SelectItem key={pk.name} value={pk.name}>
                        {pk.name} — {pk.price.toLocaleString()} đ
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Price */}
            <div className="space-y-1.5">
              <Label>{t("orders_totalVnd")}</Label>
              <Input
                type="number"
                value={selectedPrice || ""}
                onChange={(e) => setSelectedPrice(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            {/* Status */}
            <div className="space-y-1.5">
              <Label>{t("status")}</Label>
              <Select value={orderStatus} onValueChange={setOrderStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">{t("orders_pending")}</SelectItem>
                  <SelectItem value="PAID">{t("orders_paid")}</SelectItem>
                  <SelectItem value="DELIVERING">{t("orders_delivered")}</SelectItem>
                  <SelectItem value="DELIVERED">{t("orders_delivered")}</SelectItem>
                  <SelectItem value="CANCELLED">{t("orders_cancelled")}</SelectItem>
                  <SelectItem value="ERROR">{t("error")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Send channel QR PayOS */}
            <div className="space-y-1.5">
              <Label>QR PayOS {t("channel")}</Label>
              <ChannelSelect
                filter="text"
                value={sendQrChannelId}
                onChange={(v) => setSendQrChannelId(v === "__clear__" ? "" : v)}
                placeholder={t("selectChannel")}
              />
              <p className="text-xs text-muted-foreground">Bot will send PayOS QR to this {t("channel").toLowerCase()} and wait for payment (15 min)</p>
            </div>
            <Separator />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>{t("cancel")}</Button>
            <Button
              disabled={!discordUid.trim() || (isCustom ? !customProductName.trim() : !selectedProductId) || createMutation.isPending}
              onClick={() => createMutation.mutate({
                discord_uid: discordUid,
                product_id: isCustom ? null : (selectedProductId ? parseInt(selectedProductId) : null),
                package_name: isCustom ? null : (selectedPackage || null),
                custom_product_name: isCustom ? customProductName : undefined,
                total_price: selectedPrice,
                status: orderStatus,
                send_qr_channel_id: sendQrChannelId || "",
              })}
            >
              {createMutation.isPending ? t("saving") : t("orders_createOrder")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delivery dialog ── */}
      <Dialog open={!!deliverTarget} onOpenChange={(o) => { if (!o) { setDeliverTarget(null); setDmContent(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("orders_markDelivered")} #{deliverTarget?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("dmContent")}</Label>
              <Textarea
                placeholder={t("dmContent")}
                value={dmContent}
                onChange={(e) => setDmContent(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeliverTarget(null); setDmContent(""); }}>{t("cancel")}</Button>
            <Button
              disabled={deliverMutation.isPending}
              onClick={() => {
                if (deliverTarget) deliverMutation.mutate({ id: deliverTarget.id, dm_content: dmContent });
              }}
            >
              {deliverMutation.isPending ? t("saving") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
