import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import {
  Plus,
  Pencil,
  CalendarClock,
  XCircle,
  Loader2,
  Search,
  CreditCard,
  Users,
  Ticket,
  RefreshCw,
  Eye,
} from "lucide-react";

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

interface PremiumCoupon {
  id: number;
  code: string;
  plan_id: number;
  plan_name?: string;
  plan_color?: string;
  duration_days: number;
  max_uses: number;
  used_count: number;
  expires_at?: string;
  active: boolean;
  note?: string;
  created_by?: string;
  created_at?: string;
}

interface CouponRedemption {
  id: number;
  coupon_id: number;
  guild_id: string;
  redeemed_by?: string;
  subscription_id?: number;
  redeemed_at?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  active: {
    label: "Hoạt động",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0",
  },
  trial: {
    label: "Dùng thử",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0",
  },
  expired: {
    label: "Hết hạn",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400 border-0",
  },
  cancelled: {
    label: "Đã hủy",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0",
  },
  past_due: {
    label: "Quá hạn",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0",
  },
  manual_review: {
    label: "Xét duyệt",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0",
  },
};

const STATUS_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "active", label: "Hoạt động" },
  { value: "trial", label: "Dùng thử" },
  { value: "expired", label: "Hết hạn" },
  { value: "cancelled", label: "Đã hủy" },
  { value: "past_due", label: "Quá hạn" },
];

const PAYMENT_STATUS_BADGES: Record<string, { label: string; className: string }> = {
  completed: {
    label: "Hoàn thành",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0",
  },
  pending: {
    label: "Chờ xử lý",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0",
  },
  failed: {
    label: "Thất bại",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0",
  },
  refunded: {
    label: "Hoàn tiền",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400 border-0",
  },
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── API ────────────────────────────────────────────────────────────────────

async function fetchSubscriptions(): Promise<GuildSubscription[]> {
  const res = await apiFetch("/api/premium/subscriptions");
  if (!res.ok) throw new Error("Failed to load subscriptions");
  return res.json();
}

async function fetchPayments(): Promise<SubscriptionPayment[]> {
  const res = await apiFetch("/api/premium/payments");
  if (!res.ok) throw new Error("Failed to load payments");
  return res.json();
}

async function fetchPlans(): Promise<PremiumPlan[]> {
  const res = await apiFetch("/api/premium/plans");
  if (!res.ok) throw new Error("Failed to load plans");
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

async function extendSubscription(
  id: number,
  days: number
): Promise<GuildSubscription> {
  const res = await apiFetch(`/api/premium/subscriptions/${id}/extend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ days }),
  });
  if (!res.ok) throw new Error("Failed to extend subscription");
  return res.json();
}

async function cancelSubscription(id: number): Promise<void> {
  const res = await apiFetch(`/api/premium/subscriptions/${id}/cancel`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to cancel subscription");
}

async function createPayment(
  data: Partial<SubscriptionPayment>
): Promise<SubscriptionPayment> {
  const res = await apiFetch("/api/premium/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to record payment");
  return res.json();
}

async function scanReminders(): Promise<void> {
  const res = await apiFetch("/api/premium/reminders/scan", {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to scan reminders");
}

async function fetchCoupons(): Promise<PremiumCoupon[]> {
  const res = await apiFetch("/api/premium/coupons");
  if (!res.ok) throw new Error("Failed to load coupons");
  return res.json();
}

async function fetchCouponDetail(id: number): Promise<PremiumCoupon & { redemptions: CouponRedemption[] }> {
  const res = await apiFetch(`/api/premium/coupons/${id}`);
  if (!res.ok) throw new Error("Failed to load coupon");
  return res.json();
}

async function createCoupon(data: Record<string, unknown>): Promise<PremiumCoupon> {
  const res = await apiFetch("/api/premium/coupons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { detail?: string }).detail ?? "Failed"); }
  return res.json();
}

async function updateCoupon(id: number, data: Record<string, unknown>): Promise<PremiumCoupon> {
  const res = await apiFetch(`/api/premium/coupons/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { detail?: string }).detail ?? "Failed"); }
  return res.json();
}

async function deactivateCoupon(id: number): Promise<void> {
  const res = await apiFetch(`/api/premium/coupons/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to deactivate");
}

// ── Main Component ─────────────────────────────────────────────────────────

export function PremiumManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("all");
  const [extendDialogId, setExtendDialogId] = useState<number | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [cancelDialogId, setCancelDialogId] = useState<number | null>(null);
  const [editSub, setEditSub] = useState<GuildSubscription | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // Edit subscription form
  const [editStatus, setEditStatus] = useState("");
  const [editAutoRenew, setEditAutoRenew] = useState(false);
  const [editReminderDays, setEditReminderDays] = useState(7);
  const [editNotes, setEditNotes] = useState("");
  const [editPeriodEnd, setEditPeriodEnd] = useState("");

  // Payment form
  const [payGuildId, setPayGuildId] = useState("");
  const [payPlanId, setPayPlanId] = useState("");
  const [payAmount, setPayAmount] = useState(0);
  const [payCurrency, setPayCurrency] = useState("VND");
  const [payMethod, setPayMethod] = useState("manual");
  const [payStatus, setPayStatus] = useState("completed");
  const [payNotes, setPayNotes] = useState("");

  // Coupon dialog state
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [editCoupon, setEditCoupon] = useState<PremiumCoupon | null>(null);
  const [detailCoupon, setDetailCoupon] = useState<number | null>(null);
  // Coupon form fields
  const [cpCode, setCpCode] = useState("");
  const [cpPlanId, setCpPlanId] = useState("");
  const [cpDays, setCpDays] = useState("30");
  const [cpMaxUses, setCpMaxUses] = useState("1");
  const [cpExpiresAt, setCpExpiresAt] = useState("");
  const [cpNote, setCpNote] = useState("");

  const subsQuery = useQuery({
    queryKey: ["premium-subscriptions"],
    queryFn: fetchSubscriptions,
  });

  const paymentsQuery = useQuery({
    queryKey: ["premium-payments"],
    queryFn: fetchPayments,
  });

  const plansQuery = useQuery({
    queryKey: ["premium-plans"],
    queryFn: fetchPlans,
  });

  const updateSubMutation = useMutation({
    mutationFn: (args: { id: number; data: Partial<GuildSubscription> }) =>
      updateSubscription(args.id, args.data),
    onSuccess: () => {
      toast({ title: "Đã cập nhật đăng ký" });
      qc.invalidateQueries({ queryKey: ["premium-subscriptions"] });
      setEditSub(null);
    },
    onError: () => {
      toast({ title: "Cập nhật thất bại", variant: "destructive" });
    },
  });

  const extendMutation = useMutation({
    mutationFn: (args: { id: number; days: number }) =>
      extendSubscription(args.id, args.days),
    onSuccess: () => {
      toast({ title: "Đã gia hạn đăng ký" });
      qc.invalidateQueries({ queryKey: ["premium-subscriptions"] });
      setExtendDialogId(null);
    },
    onError: () => {
      toast({ title: "Gia hạn thất bại", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      toast({ title: "Đã hủy đăng ký" });
      qc.invalidateQueries({ queryKey: ["premium-subscriptions"] });
      setCancelDialogId(null);
    },
    onError: () => {
      toast({ title: "Hủy thất bại", variant: "destructive" });
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: createPayment,
    onSuccess: () => {
      toast({ title: "Đã ghi nhận thanh toán" });
      qc.invalidateQueries({ queryKey: ["premium-payments"] });
      qc.invalidateQueries({ queryKey: ["premium-subscriptions"] });
      setPaymentDialogOpen(false);
      resetPaymentForm();
    },
    onError: () => {
      toast({ title: "Ghi nhận thất bại", variant: "destructive" });
    },
  });

  const scanMutation = useMutation({
    mutationFn: scanReminders,
    onSuccess: () => {
      toast({ title: "Đã quét nhắc nhở" });
    },
    onError: () => {
      toast({ title: "Quét nhắc nhở thất bại", variant: "destructive" });
    },
  });

  const couponsQuery = useQuery({ queryKey: ["premium-coupons"], queryFn: fetchCoupons });
  const detailQuery = useQuery({
    queryKey: ["premium-coupon-detail", detailCoupon],
    queryFn: () => fetchCouponDetail(detailCoupon!),
    enabled: detailCoupon !== null,
  });

  const createCouponMutation = useMutation({
    mutationFn: createCoupon,
    onSuccess: () => { toast({ title: "Đã tạo coupon" }); qc.invalidateQueries({ queryKey: ["premium-coupons"] }); setCouponDialogOpen(false); },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const updateCouponMutation = useMutation({
    mutationFn: (args: { id: number; data: Record<string, unknown> }) => updateCoupon(args.id, args.data),
    onSuccess: () => { toast({ title: "Đã cập nhật" }); qc.invalidateQueries({ queryKey: ["premium-coupons"] }); setCouponDialogOpen(false); },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const deactivateCouponMutation = useMutation({
    mutationFn: deactivateCoupon,
    onSuccess: () => { toast({ title: "Đã vô hiệu hóa coupon" }); qc.invalidateQueries({ queryKey: ["premium-coupons"] }); },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const resetPaymentForm = () => {
    setPayGuildId("");
    setPayPlanId("");
    setPayAmount(0);
    setPayCurrency("VND");
    setPayMethod("manual");
    setPayStatus("completed");
    setPayNotes("");
  };

  const openEditDialog = useCallback((sub: GuildSubscription) => {
    setEditSub(sub);
    setEditStatus(sub.status);
    setEditAutoRenew(sub.auto_renew);
    setEditReminderDays(sub.renewal_reminder_days);
    setEditNotes(sub.notes ?? "");
    setEditPeriodEnd(
      sub.current_period_end
        ? new Date(sub.current_period_end).toISOString().slice(0, 10)
        : ""
    );
  }, []);

  const handleEditSave = () => {
    if (!editSub) return;
    updateSubMutation.mutate({
      id: editSub.id,
      data: {
        status: editStatus,
        auto_renew: editAutoRenew,
        renewal_reminder_days: editReminderDays,
        notes: editNotes || undefined,
        current_period_end: editPeriodEnd || undefined,
      },
    });
  };

  const handleCreatePayment = () => {
    createPaymentMutation.mutate({
      guild_id: payGuildId,
      plan_id: payPlanId ? Number(payPlanId) : undefined,
      amount: payAmount,
      currency: payCurrency,
      payment_method: payMethod,
      status: payStatus,
      notes: payNotes || undefined,
    });
  };

  function openCreateCoupon() {
    setEditCoupon(null);
    setCpCode("");
    setCpPlanId(plans[0] ? String(plans[0].id) : "");
    setCpDays("30");
    setCpMaxUses("1");
    setCpExpiresAt("");
    setCpNote("");
    setCouponDialogOpen(true);
  }

  function openEditCoupon(c: PremiumCoupon) {
    setEditCoupon(c);
    setCpCode(c.code);
    setCpPlanId(String(c.plan_id));
    setCpDays(String(c.duration_days));
    setCpMaxUses(String(c.max_uses));
    setCpExpiresAt(c.expires_at ? c.expires_at.slice(0, 16) : "");
    setCpNote(c.note ?? "");
    setCouponDialogOpen(true);
  }

  function handleSaveCoupon() {
    const data: Record<string, unknown> = {
      plan_id: Number(cpPlanId),
      duration_days: Number(cpDays),
      max_uses: Number(cpMaxUses),
      expires_at: cpExpiresAt || null,
      note: cpNote || null,
    };
    if (!editCoupon) {
      data.code = cpCode;
      createCouponMutation.mutate(data);
    } else {
      updateCouponMutation.mutate({ id: editCoupon.id, data });
    }
  }

  function randomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  const plans = plansQuery.data ?? [];
  const planMap = new Map(plans.map((p) => [p.id, p]));

  const subscriptions = subsQuery.data ?? [];
  const filteredSubs =
    statusFilter === "all"
      ? subscriptions
      : subscriptions.filter((s) => s.status === statusFilter);

  const payments = paymentsQuery.data ?? [];

  // ── Loading ────────────────────────────────────────────────────────────

  if (subsQuery.isLoading || paymentsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-full" />
        <Card>
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Quản lý Premium
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quản lý đăng ký và thanh toán Premium.
        </p>
      </div>

      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions" className="gap-1.5">
            <Users className="h-4 w-4" />
            Đăng ký
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            Thanh toán
          </TabsTrigger>
          <TabsTrigger value="coupons" className="gap-1.5">
            <Ticket className="h-4 w-4" />
            Coupons
          </TabsTrigger>
        </TabsList>

        {/* ── Subscriptions Tab ──────────────────────────────────────────── */}
        <TabsContent value="subscriptions" className="space-y-4 mt-4">
          {/* Top bar */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Lọc trạng thái" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
            >
              {scanMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Quét nhắc nhở
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guild ID</TableHead>
                    <TableHead>Gói</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Hết hạn</TableHead>
                    <TableHead>Tự động</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Không có đăng ký nào.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSubs.map((sub) => {
                      const plan = sub.plan || planMap.get(sub.plan_id);
                      const statusInfo =
                        STATUS_BADGES[sub.status] ??
                        STATUS_BADGES.expired;
                      return (
                        <TableRow key={sub.id}>
                          <TableCell className="font-mono text-sm">
                            {sub.guild_id}
                          </TableCell>
                          <TableCell>
                            {plan ? (
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{
                                    backgroundColor:
                                      plan.color || "#6366f1",
                                  }}
                                />
                                {plan.name}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                #{sub.plan_id}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusInfo.className}>
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDate(sub.current_period_end)}
                          </TableCell>
                          <TableCell>
                            {sub.auto_renew ? "✓" : "✗"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {sub.payment_provider}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Gia hạn"
                                onClick={() => {
                                  setExtendDialogId(sub.id);
                                  setExtendDays(30);
                                }}
                              >
                                <CalendarClock className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Hủy"
                                onClick={() => setCancelDialogId(sub.id)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Chỉnh sửa"
                                onClick={() => openEditDialog(sub)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Payments Tab ───────────────────────────────────────────────── */}
        <TabsContent value="payments" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setPaymentDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ghi nhận thanh toán
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guild ID</TableHead>
                    <TableHead>Gói</TableHead>
                    <TableHead>Số tiền</TableHead>
                    <TableHead>Phương thức</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày thanh toán</TableHead>
                    <TableHead>Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Không có thanh toán nào.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((pay) => {
                      const plan = pay.plan || planMap.get(pay.plan_id ?? 0);
                      const statusInfo =
                        PAYMENT_STATUS_BADGES[pay.status] ??
                        PAYMENT_STATUS_BADGES.pending;
                      return (
                        <TableRow key={pay.id}>
                          <TableCell className="font-mono text-sm">
                            {pay.guild_id}
                          </TableCell>
                          <TableCell>
                            {plan ? plan.name : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            {pay.amount.toLocaleString()} {pay.currency}
                          </TableCell>
                          <TableCell className="text-sm">
                            {pay.payment_method}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusInfo.className}>
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(pay.paid_at)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {pay.notes || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Coupons Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="coupons" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Tạo mã coupon để cấp Premium theo gói + số ngày cho server.
            </p>
            <Button size="sm" className="gap-1.5" onClick={openCreateCoupon}>
              <Plus className="h-4 w-4" /> Tạo coupon
            </Button>
          </div>

          {couponsQuery.isLoading ? (
            <div className="space-y-2">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Gói</TableHead>
                      <TableHead>Thời hạn</TableHead>
                      <TableHead>Đã dùng / Tối đa</TableHead>
                      <TableHead>Hết hạn</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(couponsQuery.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Chưa có coupon nào.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (couponsQuery.data ?? []).map(c => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <code className="font-mono text-sm font-bold tracking-wider">{c.code}</code>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {c.plan_color && <div className="w-2 h-2 rounded-full" style={{backgroundColor: c.plan_color}} />}
                              <span className="text-sm">{c.plan_name ?? `Plan #${c.plan_id}`}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{c.duration_days} ngày</TableCell>
                          <TableCell className="text-sm">
                            {c.used_count} / {c.max_uses === 0 ? "∞" : c.max_uses}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.expires_at ? new Date(c.expires_at).toLocaleDateString("vi-VN") : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={c.active
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0"
                              : "bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400 border-0"
                            }>
                              {c.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7"
                                onClick={() => setDetailCoupon(c.id)} title="Xem lịch sử">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7"
                                onClick={() => openEditCoupon(c)} title="Sửa">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {c.active && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => deactivateCouponMutation.mutate(c.id)} title="Vô hiệu hóa">
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Extend Dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={extendDialogId !== null}
        onOpenChange={(open) => !open && setExtendDialogId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gia hạn đăng ký</DialogTitle>
            <DialogDescription>
              Nhập số ngày muốn gia hạn thêm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="extend-days">Số ngày gia hạn</Label>
              <Input
                id="extend-days"
                type="number"
                min={1}
                value={extendDays}
                onChange={(e) =>
                  setExtendDays(Number(e.target.value) || 1)
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExtendDialogId(null)}
            >
              Hủy
            </Button>
            <Button
              onClick={() => {
                if (extendDialogId !== null)
                  extendMutation.mutate({
                    id: extendDialogId,
                    days: extendDays,
                  });
              }}
              disabled={extendMutation.isPending}
            >
              {extendMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Gia hạn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Confirm Dialog ────────────────────────────────────────── */}
      <Dialog
        open={cancelDialogId !== null}
        onOpenChange={(open) => !open && setCancelDialogId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hủy đăng ký</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn hủy đăng ký này? Hành động này không thể hoàn
              tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogId(null)}
            >
              Đóng
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (cancelDialogId !== null)
                  cancelMutation.mutate(cancelDialogId);
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Hủy đăng ký
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Subscription Dialog ─────────────────────────────────────── */}
      <Dialog open={editSub !== null} onOpenChange={(open) => !open && setEditSub(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa đăng ký</DialogTitle>
            <DialogDescription>
              Cập nhật thông tin đăng ký Premium cho guild{" "}
              <span className="font-mono">{editSub?.guild_id}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_BADGES).map(([key, info]) => (
                      <SelectItem key={key} value={key}>
                        {info.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-period-end">Ngày hết hạn</Label>
                <Input
                  id="edit-period-end"
                  type="date"
                  value={editPeriodEnd}
                  onChange={(e) => setEditPeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={editAutoRenew}
                  onCheckedChange={setEditAutoRenew}
                />
                <Label>Tự động gia hạn</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-reminder-days">
                  Nhắc nhở trước (ngày)
                </Label>
                <Input
                  id="edit-reminder-days"
                  type="number"
                  min={0}
                  value={editReminderDays}
                  onChange={(e) =>
                    setEditReminderDays(Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Ghi chú</Label>
              <Textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSub(null)}>
              Hủy
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={updateSubMutation.isPending}
            >
              {updateSubMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Record Payment Dialog ────────────────────────────────────────── */}
      <Dialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (!open) resetPaymentForm();
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ghi nhận thanh toán</DialogTitle>
            <DialogDescription>
              Thêm bản ghi thanh toán mới.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pay-guild-id">Guild ID</Label>
                <Input
                  id="pay-guild-id"
                  value={payGuildId}
                  onChange={(e) => setPayGuildId(e.target.value)}
                  placeholder="123456789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-plan-id">Gói</Label>
                <Select
                  value={payPlanId}
                  onValueChange={setPayPlanId}
                >
                  <SelectTrigger id="pay-plan-id">
                    <SelectValue placeholder="Chọn gói" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pay-amount">Số tiền</Label>
                <Input
                  id="pay-amount"
                  type="number"
                  min={0}
                  value={payAmount}
                  onChange={(e) =>
                    setPayAmount(Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Tiền tệ</Label>
                <Select
                  value={payCurrency}
                  onValueChange={setPayCurrency}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VND">VND</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phương thức</Label>
                <Select
                  value={payMethod}
                  onValueChange={setPayMethod}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Chuyển khoản</SelectItem>
                    <SelectItem value="payos">PayOS</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <Select
                  value={payStatus}
                  onValueChange={setPayStatus}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Hoàn thành</SelectItem>
                    <SelectItem value="pending">Chờ xử lý</SelectItem>
                    <SelectItem value="failed">Thất bại</SelectItem>
                    <SelectItem value="refunded">Hoàn tiền</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-notes">Ghi chú</Label>
              <Textarea
                id="pay-notes"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              onClick={handleCreatePayment}
              disabled={createPaymentMutation.isPending}
            >
              {createPaymentMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Ghi nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Coupon Create/Edit Dialog ────────────────────────────────────── */}
      <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editCoupon ? "Sửa coupon" : "Tạo coupon mới"}</DialogTitle>
            <DialogDescription>
              Coupon sẽ cấp Premium theo gói + số ngày khi guild nhập vào trang Gói Server.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Code */}
            {!editCoupon && (
              <div className="space-y-1.5">
                <Label>Mã coupon <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  <Input
                    value={cpCode}
                    onChange={e => setCpCode(e.target.value.toUpperCase())}
                    onBlur={e => setCpCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_\-]/g,""))}
                    placeholder="VIP30FREE"
                    className="font-mono tracking-wider uppercase"
                    maxLength={32}
                  />
                  <Button variant="outline" size="sm" onClick={() => setCpCode(randomCode())} title="Tạo ngẫu nhiên">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Chỉ chứa A-Z, 0-9, gạch dưới, gạch ngang</p>
              </div>
            )}
            {editCoupon && (
              <div className="space-y-1.5">
                <Label>Mã coupon</Label>
                <code className="block font-mono text-lg font-bold tracking-widest px-3 py-2 bg-muted rounded-md">{editCoupon.code}</code>
              </div>
            )}
            {/* Plan */}
            <div className="space-y-1.5">
              <Label>Gói áp dụng <span className="text-destructive">*</span></Label>
              <select
                value={cpPlanId}
                onChange={e => setCpPlanId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {plans.map(p => (
                  <option key={p.id} value={String(p.id)} className="bg-background">{p.name}</option>
                ))}
              </select>
            </div>
            {/* Duration */}
            <div className="space-y-1.5">
              <Label>Thời hạn (ngày) <span className="text-destructive">*</span></Label>
              <Input
                type="number" min={1} max={3650}
                value={cpDays}
                onChange={e => setCpDays(e.target.value)}
              />
              {Number(cpDays) > 0 && (
                <p className="text-xs text-muted-foreground">
                  ≈ {Math.floor(Number(cpDays)/30)} tháng {Number(cpDays)%30 > 0 ? `${Number(cpDays)%30} ngày` : ""}
                </p>
              )}
            </div>
            {/* Max uses */}
            <div className="space-y-1.5">
              <Label>Số lần sử dụng tối đa</Label>
              <Input
                type="number" min={0}
                value={cpMaxUses}
                onChange={e => setCpMaxUses(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">0 = không giới hạn</p>
            </div>
            {/* Expires */}
            <div className="space-y-1.5">
              <Label>Hết hạn (tùy chọn)</Label>
              <Input
                type="datetime-local"
                value={cpExpiresAt}
                onChange={e => setCpExpiresAt(e.target.value)}
              />
            </div>
            {/* Note */}
            <div className="space-y-1.5">
              <Label>Ghi chú nội bộ</Label>
              <Input value={cpNote} onChange={e => setCpNote(e.target.value)} placeholder="Dành cho event tháng 6..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCouponDialogOpen(false)}>Hủy</Button>
            <Button
              onClick={handleSaveCoupon}
              disabled={createCouponMutation.isPending || updateCouponMutation.isPending || !cpPlanId || !cpDays}
            >
              {(createCouponMutation.isPending || updateCouponMutation.isPending) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editCoupon ? "Lưu thay đổi" : "Tạo coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Coupon Detail/Redemption History Dialog ──────────────────────── */}
      <Dialog open={detailCoupon !== null} onOpenChange={open => { if (!open) setDetailCoupon(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Lịch sử sử dụng</DialogTitle>
            {detailQuery.data && (
              <DialogDescription>
                <code className="font-mono font-bold">{detailQuery.data.code}</code>
                {" — "}{detailQuery.data.used_count}/{detailQuery.data.max_uses === 0 ? "∞" : detailQuery.data.max_uses} lần dùng
              </DialogDescription>
            )}
          </DialogHeader>
          {detailQuery.isLoading ? (
            <div className="space-y-2 py-4">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
          ) : (detailQuery.data?.redemptions ?? []).length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Chưa có server nào sử dụng mã này.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guild ID</TableHead>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Thời gian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(detailQuery.data?.redemptions ?? []).map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.guild_id}</TableCell>
                    <TableCell className="text-xs">{r.redeemed_by ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.redeemed_at ? new Date(r.redeemed_at).toLocaleString("vi-VN") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
