import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, X } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { PageContainer, PageEditHeader } from "@/components/infinity";
import { useGuild } from "@/contexts/GuildContext";
import type { Product, ProductCategory } from "../../types";

interface Coupon {
  id: number;
  code: string;
  discount_type: string;
  discount_percent: number | null;
  discount_amount: number | null;
  buy_x: number | null;
  get_y: number | null;
  apply_mode: string;
  apply_category_id: number | null;
  apply_product_id: number | null;
  customer_mode: string;
  customer_ids: string[];
  max_uses: number;
  used_count: number;
  is_public: boolean;
}

type CouponForm = Omit<Coupon, "id" | "used_count">;

const empty = (): CouponForm => ({
  code: "",
  discount_type: "percent",
  discount_percent: null,
  discount_amount: null,
  buy_x: null,
  get_y: null,
  apply_mode: "all",
  apply_category_id: null,
  apply_product_id: null,
  customer_mode: "all",
  customer_ids: [],
  max_uses: 1,
  is_public: false,
});

export function CouponEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();
  const isNew = !id;

  const [form, setForm] = useState<CouponForm>(empty());
  const [customerInput, setCustomerInput] = useState("");

  const { data: coupons, isLoading } = useQuery<Coupon[]>({
    queryKey: ["coupons"],
    queryFn: () => apiFetch("/api/coupons").then((r) => r.json()),
    enabled: !isNew,
    staleTime: 60_000,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products", selectedGuildId],
    queryFn: () => apiFetch("/api/products").then((r) => r.json()),
    staleTime: 60_000,
    enabled: !!selectedGuildId,
  });

  const { data: categories = [] } = useQuery<ProductCategory[]>({
    queryKey: ["categories", selectedGuildId],
    queryFn: () => apiFetch("/api/categories").then((r) => r.json()),
    staleTime: 60_000,
    enabled: !!selectedGuildId,
  });

  const item = id ? coupons?.find((c) => String(c.id) === id) : undefined;

  useEffect(() => {
    if (item) {
      setForm({
        code: item.code,
        discount_type: item.discount_type || "percent",
        discount_percent: item.discount_percent,
        discount_amount: item.discount_amount,
        buy_x: item.buy_x,
        get_y: item.get_y,
        apply_mode: item.apply_mode || "all",
        apply_category_id: item.apply_category_id,
        apply_product_id: item.apply_product_id,
        customer_mode: item.customer_mode || "all",
        customer_ids: item.customer_ids || [],
        max_uses: item.max_uses,
        is_public: item.is_public,
      });
    }
  }, [item?.id]);

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons"] });
      navigate(-1);
      toast({ title: "Coupon created." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: (body: object & { id: number }) =>
      apiFetch(`/api/coupons/${body.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons"] });
      navigate(-1);
      toast({ title: "Coupon updated." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSave = () => {
    if (!form.code.trim()) {
      toast({ variant: "destructive", title: "Enter coupon code" });
      return;
    }
    const payload: Record<string, unknown> = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_percent: form.discount_type === "percent" ? (form.discount_percent || null) : null,
      discount_amount: form.discount_type === "fixed" ? (form.discount_amount || null) : null,
      buy_x: form.discount_type === "buy_x_get_y" ? (form.buy_x || null) : null,
      get_y: form.discount_type === "buy_x_get_y" ? (form.get_y || null) : null,
      apply_mode: form.apply_mode,
      apply_category_id: form.apply_mode === "category" ? form.apply_category_id : null,
      apply_product_id: form.apply_mode === "product" ? form.apply_product_id : null,
      customer_mode: form.customer_mode,
      customer_ids: form.customer_mode === "specific" ? form.customer_ids : [],
      max_uses: form.max_uses,
      is_public: form.is_public,
    };
    if (!isNew && id) {
      updateMutation.mutate({ id: Number(id), ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const set = <K extends keyof CouponForm>(key: K, val: CouponForm[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const addCustomerId = () => {
    const trimmed = customerInput.trim();
    if (trimmed && !form.customer_ids.includes(trimmed)) {
      set("customer_ids", [...form.customer_ids, trimmed]);
    }
    setCustomerInput("");
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <PageContainer size="sm">
      <PageEditHeader
        title={isNew ? "Create coupon" : "Edit coupon"}
        description={isNew ? "Create new coupon" : "Edit coupon details"}
        onBack={() => navigate(-1)}
      >
        <Button className="rounded-xl gap-2" onClick={handleSave} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="hidden sm:inline">{isPending ? "Saving..." : "Save"}</span>
        </Button>
      </PageEditHeader>

      <div className="space-y-6">
        {/* ── Code ── */}
        <div className="space-y-1.5">
          <Label>Coupon code <span className="text-destructive">*</span></Label>
          <Input
            placeholder="e.g. SUMMER30"
            value={form.code}
            disabled={!isNew}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            className="font-mono"
          />
        </div>

        <Separator />

        {/* ── Discount Type ── */}
        <div className="space-y-1.5">
          <Label>Discount type</Label>
          <Select value={form.discount_type} onValueChange={(v) => set("discount_type", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Percentage (%)</SelectItem>
              <SelectItem value="fixed">Fixed amount</SelectItem>
              <SelectItem value="buy_x_get_y">Buy X Get Y free</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Percent */}
        {form.discount_type === "percent" && (
          <div className="space-y-1.5">
            <Label>Discount percentage</Label>
            <Input
              type="number"
              placeholder="e.g. 20"
              min={0}
              max={100}
              value={form.discount_percent ?? ""}
              onChange={(e) => set("discount_percent", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
        )}

        {/* Fixed */}
        {form.discount_type === "fixed" && (
          <div className="space-y-1.5">
            <Label>Discount amount</Label>
            <Input
              type="number"
              placeholder="e.g. 50000"
              min={0}
              value={form.discount_amount ?? ""}
              onChange={(e) => set("discount_amount", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </div>
        )}

        {/* Buy X Get Y */}
        {form.discount_type === "buy_x_get_y" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Buy (X)</Label>
              <Input
                type="number"
                placeholder="e.g. 3"
                min={1}
                value={form.buy_x ?? ""}
                onChange={(e) => set("buy_x", e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Get free (Y)</Label>
              <Input
                type="number"
                placeholder="e.g. 1"
                min={1}
                value={form.get_y ?? ""}
                onChange={(e) => set("get_y", e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
          </div>
        )}

        <Separator />

        {/* ── Apply Mode ── */}
        <div className="space-y-1.5">
          <Label>Applies to</Label>
          <Select value={form.apply_mode} onValueChange={(v) => set("apply_mode", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              <SelectItem value="category">Specific category</SelectItem>
              <SelectItem value="product">Specific product</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.apply_mode === "category" && (
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={form.apply_category_id != null ? String(form.apply_category_id) : ""}
              onValueChange={(v) => set("apply_category_id", v ? Number(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {form.apply_mode === "product" && (
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select
              value={form.apply_product_id != null ? String(form.apply_product_id) : ""}
              onValueChange={(v) => set("apply_product_id", v ? Number(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Separator />

        {/* ── Customer Mode ── */}
        <div className="space-y-1.5">
          <Label>Eligible customers</Label>
          <Select value={form.customer_mode} onValueChange={(v) => set("customer_mode", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              <SelectItem value="specific">Specific customers</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.customer_mode === "specific" && (
          <div className="space-y-2">
            <Label>Discord user IDs</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter Discord user ID"
                value={customerInput}
                onChange={(e) => setCustomerInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomerId(); } }}
                className="font-mono"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustomerId}>Add</Button>
            </div>
            {form.customer_ids.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.customer_ids.map((uid) => (
                  <span key={uid} className="inline-flex items-center gap-1 bg-muted rounded-md px-2 py-1 text-xs font-mono">
                    {uid}
                    <button
                      type="button"
                      onClick={() => set("customer_ids", form.customer_ids.filter((x) => x !== uid))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* ── Usage & Public ── */}
        <div className="space-y-1.5">
          <Label>Usage limit</Label>
          <Input
            type="number"
            min={1}
            value={form.max_uses}
            onChange={(e) => set("max_uses", parseInt(e.target.value) || 1)}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="cursor-pointer">Public</Label>
            <p className="text-xs text-muted-foreground">The bot can display this code to users</p>
          </div>
          <Switch
            checked={form.is_public}
            onCheckedChange={(v) => set("is_public", v)}
          />
        </div>
      </div>
    </PageContainer>
  );
}
