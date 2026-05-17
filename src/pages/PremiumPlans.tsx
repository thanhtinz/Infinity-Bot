import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import {
  Plus,
  Pencil,
  Archive,
  Loader2,
  Gem,
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

// ── Constants ──────────────────────────────────────────────────────────────

const INTERVAL_LABELS: Record<string, string> = {
  monthly: "Hàng tháng",
  quarterly: "Hàng quý",
  yearly: "Hàng năm",
  lifetime: "Vĩnh viễn",
};

const CURRENCY_OPTIONS = [
  { code: "VND", label: "VND" },
  { code: "USD", label: "USD" },
  { code: "EUR", label: "EUR" },
];

const INTERVAL_OPTIONS = [
  { value: "monthly", label: "Hàng tháng" },
  { value: "quarterly", label: "Hàng quý" },
  { value: "yearly", label: "Hàng năm" },
  { value: "lifetime", label: "Vĩnh viễn" },
];

const FEATURE_KEYS = [
  { key: "custom_bot", label: "Custom Bot", type: "boolean" as const },
  { key: "advanced_captcha", label: "Advanced Captcha", type: "boolean" as const },
  { key: "scheduled_backup", label: "Scheduled Backup", type: "boolean" as const },
  { key: "backup_retention", label: "Backup Retention (ngày)", type: "number" as const },
  { key: "remove_branding", label: "Remove Branding", type: "boolean" as const },
  { key: "priority_support", label: "Priority Support", type: "boolean" as const },
];

interface PlanFormState {
  code: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  badge_text: string;
  color: string;
  sort_order: number;
  active: boolean;
  is_public: boolean;
  features: Record<string, boolean | number | string>;
}

const EMPTY_PLAN: PlanFormState = {
  code: "",
  name: "",
  description: "",
  price: 0,
  currency: "VND",
  interval: "monthly",
  badge_text: "",
  color: "#6366f1",
  sort_order: 0,
  active: true,
  is_public: true,
  features: {
    custom_bot: false,
    advanced_captcha: false,
    scheduled_backup: false,
    backup_retention: 0,
    remove_branding: false,
    priority_support: false,
  },
};

// ── API ────────────────────────────────────────────────────────────────────

async function fetchPlans(): Promise<PremiumPlan[]> {
  const res = await apiFetch("/api/premium/plans");
  if (!res.ok) throw new Error("Failed to load plans");
  return res.json();
}

async function createPlan(plan: Partial<PremiumPlan>): Promise<PremiumPlan> {
  const res = await apiFetch("/api/premium/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });
  if (!res.ok) throw new Error("Failed to create plan");
  return res.json();
}

async function updatePlan(id: number, plan: Partial<PremiumPlan>): Promise<PremiumPlan> {
  const res = await apiFetch(`/api/premium/plans/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });
  if (!res.ok) throw new Error("Failed to update plan");
  return res.json();
}

async function archivePlan(id: number): Promise<void> {
  const res = await apiFetch(`/api/premium/plans/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to archive plan");
}

// ── Main Component ─────────────────────────────────────────────────────────

export function PremiumPlans() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PremiumPlan | null>(null);
  const [form, setForm] = useState<PlanFormState>({ ...EMPTY_PLAN });
  const [confirmArchiveId, setConfirmArchiveId] = useState<number | null>(null);

  const plansQuery = useQuery({
    queryKey: ["premium-plans"],
    queryFn: fetchPlans,
  });

  const createMutation = useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      toast({ title: "Đã tạo gói mới" });
      qc.invalidateQueries({ queryKey: ["premium-plans"] });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Tạo gói thất bại", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: number; plan: Partial<PremiumPlan> }) =>
      updatePlan(args.id, args.plan),
    onSuccess: () => {
      toast({ title: "Đã cập nhật gói" });
      qc.invalidateQueries({ queryKey: ["premium-plans"] });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Cập nhật thất bại", variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archivePlan,
    onSuccess: () => {
      toast({ title: "Đã lưu trữ gói" });
      qc.invalidateQueries({ queryKey: ["premium-plans"] });
      setConfirmArchiveId(null);
    },
    onError: () => {
      toast({ title: "Lưu trữ thất bại", variant: "destructive" });
    },
  });

  const updateField = useCallback(
    <K extends keyof PlanFormState>(key: K, value: PlanFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateFeature = useCallback((key: string, value: boolean | number | string) => {
    setForm((prev) => ({
      ...prev,
      features: { ...prev.features, [key]: value },
    }));
  }, []);

  const openCreateDialog = () => {
    setEditingPlan(null);
    setForm({ ...EMPTY_PLAN, features: { ...EMPTY_PLAN.features } });
    setDialogOpen(true);
  };

  const openEditDialog = (plan: PremiumPlan) => {
    setEditingPlan(plan);
    setForm({
      code: plan.code,
      name: plan.name,
      description: plan.description ?? "",
      price: plan.price,
      currency: plan.currency,
      interval: plan.interval,
      badge_text: plan.badge_text ?? "",
      color: plan.color || "#6366f1",
      sort_order: plan.sort_order,
      active: plan.active,
      is_public: plan.is_public,
      features: {
        custom_bot: (plan.features?.custom_bot as boolean) ?? false,
        advanced_captcha: (plan.features?.advanced_captcha as boolean) ?? false,
        scheduled_backup: (plan.features?.scheduled_backup as boolean) ?? false,
        backup_retention: (plan.features?.backup_retention as number) ?? 0,
        remove_branding: (plan.features?.remove_branding as boolean) ?? false,
        priority_support: (plan.features?.priority_support as boolean) ?? false,
      },
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
  };

  const handleSubmit = () => {
    const payload: Partial<PremiumPlan> = {
      code: form.code,
      name: form.name,
      description: form.description || undefined,
      price: form.price,
      currency: form.currency,
      interval: form.interval,
      badge_text: form.badge_text || undefined,
      color: form.color,
      sort_order: form.sort_order,
      active: form.active,
      is_public: form.is_public,
      features: form.features,
    };

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, plan: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Loading ────────────────────────────────────────────────────────────

  if (plansQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
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

  const plans = plansQuery.data ?? [];

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Quản lý gói Premium
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tạo và quản lý các gói đăng ký Premium.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Tạo gói mới
        </Button>
      </div>

      {/* Plans table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên gói</TableHead>
                <TableHead>Giá / Chu kỳ</TableHead>
                <TableHead>Badge</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thứ tự</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Chưa có gói nào. Nhấn "Tạo gói mới" để bắt đầu.
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: plan.color || "#6366f1" }}
                        />
                        {plan.name}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {plan.code}
                      </span>
                    </TableCell>
                    <TableCell>
                      {plan.price.toLocaleString()} {plan.currency} / {INTERVAL_LABELS[plan.interval] || plan.interval}
                    </TableCell>
                    <TableCell>
                      {plan.badge_text ? (
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: plan.color || "#6366f1",
                            color: "#fff",
                          }}
                        >
                          {plan.badge_text}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {plan.active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                          Hoạt động
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Lưu trữ</Badge>
                      )}
                    </TableCell>
                    <TableCell>{plan.sort_order}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(plan)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {plan.active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmArchiveId(plan.id)}
                          >
                            <Archive className="h-4 w-4" />
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

      {/* ── Create / Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gem className="h-5 w-5" />
              {editingPlan ? "Chỉnh sửa gói" : "Tạo gói mới"}
            </DialogTitle>
            <DialogDescription>
              {editingPlan
                ? "Cập nhật thông tin gói Premium."
                : "Điền thông tin để tạo gói Premium mới."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-code">Mã gói</Label>
                <Input
                  id="plan-code"
                  value={form.code}
                  onChange={(e) => updateField("code", e.target.value)}
                  disabled={!!editingPlan}
                  placeholder="premium_pro"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-name">Tên gói</Label>
                <Input
                  id="plan-name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Premium Pro"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-description">Mô tả</Label>
              <Textarea
                id="plan-description"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Mô tả ngắn về gói..."
                rows={2}
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-price">Giá</Label>
                <Input
                  id="plan-price"
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) =>
                    updateField("price", Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-currency">Tiền tệ</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) => updateField("currency", v)}
                >
                  <SelectTrigger id="plan-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-interval">Chu kỳ</Label>
                <Select
                  value={form.interval}
                  onValueChange={(v) => updateField("interval", v)}
                >
                  <SelectTrigger id="plan-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Badge & Color */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-badge">Badge text</Label>
                <Input
                  id="plan-badge"
                  value={form.badge_text}
                  onChange={(e) => updateField("badge_text", e.target.value)}
                  placeholder="PRO"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-color">Màu sắc</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => updateField("color", e.target.value)}
                    className="h-9 w-12 rounded border cursor-pointer"
                  />
                  <Input
                    value={form.color}
                    onChange={(e) => updateField("color", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-sort-order">Thứ tự</Label>
                <Input
                  id="plan-sort-order"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    updateField("sort_order", Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => updateField("active", v)}
                />
                <Label>Hoạt động</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_public}
                  onCheckedChange={(v) => updateField("is_public", v)}
                />
                <Label>Công khai</Label>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Tính năng</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FEATURE_KEYS.map((feat) => (
                  <div
                    key={feat.key}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <Label htmlFor={`feat-${feat.key}`} className="text-sm cursor-pointer">
                      {feat.label}
                    </Label>
                    {feat.type === "boolean" ? (
                      <Switch
                        id={`feat-${feat.key}`}
                        checked={!!form.features[feat.key]}
                        onCheckedChange={(v) => updateFeature(feat.key, v)}
                      />
                    ) : (
                      <Input
                        id={`feat-${feat.key}`}
                        type="number"
                        min={0}
                        value={Number(form.features[feat.key]) || 0}
                        onChange={(e) =>
                          updateFeature(feat.key, Number(e.target.value) || 0)
                        }
                        className="w-20 h-8 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPlan ? "Cập nhật" : "Tạo mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Archive Dialog ───────────────────────────────────────── */}
      <Dialog
        open={confirmArchiveId !== null}
        onOpenChange={(open) => !open && setConfirmArchiveId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lưu trữ gói</DialogTitle>
            <DialogDescription>
              Gói sẽ bị đánh dấu là không hoạt động. Bạn có thể kích hoạt lại
              sau bằng cách chỉnh sửa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmArchiveId(null)}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmArchiveId !== null)
                  archiveMutation.mutate(confirmArchiveId);
              }}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Lưu trữ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
