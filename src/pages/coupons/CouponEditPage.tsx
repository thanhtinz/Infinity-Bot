import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

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
    queryFn: () => fetch("/api/coupons", { credentials: "include" }).then((r) => r.json()),
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
      fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons"] });
      navigate(-1);
      toast({ title: "Đã tạo coupon." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: (body: object & { id: number }) =>
      fetch(`/api/coupons/${body.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons"] });
      navigate(-1);
      toast({ title: "Đã cập nhật coupon." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSave = () => {
    if (!form.code.trim()) {
      toast({ variant: "destructive", title: "Nhập mã coupon" });
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
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-card px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold text-lg">{isNew ? "Tạo mới" : "Chỉnh sửa"}</h1>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Mã */}
        <div className="space-y-1.5">
          <Label>Mã coupon <span className="text-destructive">*</span></Label>
          <Input
            placeholder="VD: SUMMER30"
            value={form.code}
            disabled={!isNew}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            className="font-mono"
          />
        </div>
        <Separator />
        {/* Giảm theo % */}
        <div className="space-y-1.5">
          <Label>Giảm theo % (để trống nếu dùng số tiền)</Label>
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
        {/* Giảm theo số tiền */}
        <div className="space-y-1.5">
          <Label>Giảm theo số tiền (để trống nếu dùng %)</Label>
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
        {/* Giới hạn dùng */}
        <div className="space-y-1.5">
          <Label>Giới hạn số lượt dùng</Label>
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
            <Label className="cursor-pointer">Công khai</Label>
            <p className="text-xs text-muted-foreground">Bot có thể hiển thị mã này cho user</p>
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
