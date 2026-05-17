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
    </div>
  );
}
