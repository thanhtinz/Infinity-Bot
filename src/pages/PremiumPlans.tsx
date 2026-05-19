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
import { EmojiTextarea } from "@/components/EmojiInput";
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

// ── Constants ──────────────────────────────────────────────────────────────

const INTERVAL_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  lifetime: "Lifetime",
};

const INTERVAL_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "lifetime", label: "Lifetime" },
];

const FEATURE_KEYS = [
  { key: "custom_bot", label: "Custom Bot", type: "boolean" as const },
  { key: "advanced_captcha", label: "Advanced Captcha", type: "boolean" as const },
  { key: "scheduled_backup", label: "Scheduled Backup", type: "boolean" as const },
  { key: "backup_retention", label: "Backup Retention (days)", type: "number" as const },
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
  currency: "USD",
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
      toast({ title: "Plan created" });
      qc.invalidateQueries({ queryKey: ["premium-plans"] });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Failed to create plan", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: number; plan: Partial<PremiumPlan> }) =>
      updatePlan(args.id, args.plan),
    onSuccess: () => {
      toast({ title: "Plan updated" });
      qc.invalidateQueries({ queryKey: ["premium-plans"] });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Failed to update plan", variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archivePlan,
    onSuccess: () => {
      toast({ title: "Plan archived" });
      qc.invalidateQueries({ queryKey: ["premium-plans"] });
      setConfirmArchiveId(null);
    },
    onError: () => {
      toast({ title: "Failed to archive plan", variant: "destructive" });
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
    <PageContainer size="md">
      <PageHeader title="Premium Plan Management" description="Create and manage Premium subscription plans." icon={Gem}>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Plan
        </Button>
      </PageHeader>

      {/* Plans table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan Name</TableHead>
                <TableHead>Price / Interval</TableHead>
                <TableHead>Badge</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No plans yet. Click "Create New Plan" to get started.
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
                      ${plan.price.toFixed(2)} USD / {INTERVAL_LABELS[plan.interval] || plan.interval}
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
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Archived</Badge>
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
              {editingPlan ? "Edit Plan" : "Create New Plan"}
            </DialogTitle>
            <DialogDescription>
              {editingPlan
                ? "Update Premium plan details."
                : "Fill in the details to create a new Premium plan."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-code">Plan Code</Label>
                <Input
                  id="plan-code"
                  value={form.code}
                  onChange={(e) => updateField("code", e.target.value)}
                  disabled={!!editingPlan}
                  placeholder="premium_pro"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-name">Plan Name</Label>
                <Input
                  id="plan-name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Premium Pro"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-description">Description</Label>
              <EmojiTextarea
                id="plan-description"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Brief description of the plan..."
                rows={2}
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-price">Price</Label>
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
                <Label htmlFor="plan-currency">Currency</Label>
                <div className="flex items-center h-9 px-3 rounded-md border border-input bg-muted text-sm text-muted-foreground">
                  USD — PayPal only
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-interval">Interval</Label>
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
                <Label htmlFor="plan-color">Color</Label>
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
                <Label htmlFor="plan-sort-order">Order</Label>
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
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_public}
                  onCheckedChange={(v) => updateField("is_public", v)}
                />
                <Label>Public</Label>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Features</Label>
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
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPlan ? "Update" : "Create"}
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
            <DialogTitle>Archive Plan</DialogTitle>
            <DialogDescription>
              The plan will be marked as inactive. You can reactivate it
              later by editing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmArchiveId(null)}
            >
              Cancel
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
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
