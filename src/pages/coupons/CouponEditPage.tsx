import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";

interface Coupon {
  id: number;
  code: string;
  discount_percent: number | null;
  discount_amount: number | null;
  max_uses: number;
  used_count: number;
  is_public: boolean;
}

const empty = (): Omit<Coupon, "id" | "used_count"> => ({
  code: "",
  discount_percent: null,
  discount_amount: null,
  max_uses: 1,
  is_public: false,
});

export function CouponEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !id;

  const [form, setForm] = useState(empty());

  const { data: coupons, isLoading } = useQuery<Coupon[]>({
    queryKey: ["coupons"],
    queryFn: () => apiFetch("/api/coupons").then((r) => r.json()),
    enabled: !isNew,
    staleTime: 60_000,
  });

  const item = id ? coupons?.find((c) => String(c.id) === id) : undefined;

  useEffect(() => {
    if (item) {
      setForm({
        code: item.code,
        discount_percent: item.discount_percent,
        discount_amount: item.discount_amount,
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
        credentials: "include",
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
        credentials: "include",
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
    const payload = {
      code: form.code.trim().toUpperCase(),
      discount_percent: form.discount_percent || null,
      discount_amount: form.discount_amount || null,
      max_uses: form.max_uses,
      is_public: form.is_public,
    };
    if (!isNew && id) {
      updateMutation.mutate({ id: Number(id), ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b px-6 py-3.5 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg tracking-tight">{isNew ? "Create coupon" : "Edit coupon"}</h1>
          <p className="text-xs text-muted-foreground">{isNew ? "Create new coupon" : "Edit coupon details"}</p>
        </div>
        <Button className="rounded-xl gap-2" onClick={handleSave} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="hidden sm:inline">{isPending ? "Saving..." : "Save"}</span>
        </Button>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* Code */}
        <div className="space-y-1.5">
          <Label>Coupon code <span className="text-destructive">*</span></Label>
          <Input
            placeholder="VD: SUMMER30"
            value={form.code}
            disabled={!isNew}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            className="font-mono"
          />
        </div>
        <Separator />
        {/* Percent discount */}
        <div className="space-y-1.5">
          <Label>% discount (leave empty if using fixed amount)</Label>
          <Input
            type="number"
            placeholder="VD: 20"
            value={form.discount_percent ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                discount_percent: e.target.value ? parseFloat(e.target.value) : null,
                discount_amount: e.target.value ? null : f.discount_amount,
              }))
            }
          />
        </div>
        {/* Fixed discount */}
        <div className="space-y-1.5">
          <Label>Fixed discount (leave empty if using %)</Label>
          <Input
            type="number"
            placeholder="VD: 50000"
            value={form.discount_amount ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                discount_amount: e.target.value ? parseFloat(e.target.value) : null,
                discount_percent: e.target.value ? null : f.discount_percent,
              }))
            }
          />
        </div>
        <Separator />
        {/* Usage limit */}
        <div className="space-y-1.5">
          <Label>Usage limit</Label>
          <Input
            type="number"
            min={1}
            value={form.max_uses}
            onChange={(e) => setForm((f) => ({ ...f, max_uses: parseInt(e.target.value) || 1 }))}
          />
        </div>
        {/* Public */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="cursor-pointer">Public</Label>
            <p className="text-xs text-muted-foreground">The bot can display this code to users</p>
          </div>
          <Switch
            checked={form.is_public}
            onCheckedChange={(v) => setForm((f) => ({ ...f, is_public: v }))}
          />
        </div>
      </div>
    </div>
  );
}
