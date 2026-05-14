import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Copy, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function CouponsManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [form, setForm] = useState(empty());

  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ["coupons"],
    queryFn: () => fetch("/api/coupons", { credentials: "include" }).then((r) => r.json()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["coupons"] });

  const saveMutation = useMutation({
    mutationFn: (body: object) => {
      const url = editing ? `/api/coupons/${editing.id}` : "/api/coupons";
      const method = editing ? "PUT" : "POST";
      return fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); });
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast({ title: editing ? "Đã cập nhật coupon." : "Đã tạo coupon." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/coupons/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast({ title: "Đã xóa coupon." }); },
    onError: () => toast({ variant: "destructive", title: "Lỗi xóa." }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(empty());
    setDialogOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      code: c.code,
      discount_percent: c.discount_percent,
      discount_amount: c.discount_amount,
      max_uses: c.max_uses,
      is_public: c.is_public,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.code.trim()) {
      toast({ variant: "destructive", title: "Nhập mã coupon" });
      return;
    }
    saveMutation.mutate({
      code: form.code.trim().toUpperCase(),
      discount_percent: form.discount_percent || null,
      discount_amount: form.discount_amount || null,
      max_uses: form.max_uses,
      is_public: form.is_public,
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Đã copy: " + code });
  };

  const usageColor = (c: Coupon) => {
    if (c.max_uses === 0) return "";
    const ratio = c.used_count / c.max_uses;
    if (ratio >= 1) return "text-destructive";
    if (ratio >= 0.8) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Coupon</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Tạo coupon
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Đang tải...</p>
      ) : coupons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Tag className="h-10 w-10 opacity-30" />
          <p className="text-sm">Chưa có coupon nào</p>
          <Button variant="outline" size="sm" onClick={openCreate}>Tạo ngay</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {coupons.map((c) => {
            const exhausted = c.used_count >= c.max_uses;
            return (
              <Card key={c.id} className={cn("overflow-hidden", exhausted && "opacity-60")}>
                <CardContent className="p-3 sm:p-4 flex flex-wrap items-center gap-3 justify-between">
                  {/* Code + badges */}
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => copyCode(c.code)}
                      className="font-mono font-bold text-base tracking-widest hover:text-primary transition-colors flex items-center gap-1"
                      title="Click để copy"
                    >
                      {c.code}
                      <Copy className="h-3 w-3 opacity-50" />
                    </button>
                    {c.is_public && <Badge variant="secondary" className="text-xs">Công khai</Badge>}
                    {exhausted && <Badge variant="destructive" className="text-xs">Hết lượt</Badge>}
                  </div>

                  {/* Discount info */}
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Giảm</p>
                      <p className="font-semibold">
                        {c.discount_percent
                          ? `${c.discount_percent}%`
                          : c.discount_amount
                          ? `${c.discount_amount.toLocaleString("vi-VN")} đ`
                          : "—"}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Đã dùng</p>
                      <p className={cn("font-semibold tabular-nums", usageColor(c))}>
                        {c.used_count}/{c.max_uses}
                      </p>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(c)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Dialog tạo/sửa ── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa coupon" : "Tạo coupon mới"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Mã */}
            <div className="space-y-1.5">
              <Label>Mã coupon <span className="text-destructive">*</span></Label>
              <Input
                placeholder="VD: SUMMER30"
                value={form.code}
                disabled={!!editing}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm xóa ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Xóa coupon?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Mã <strong className="font-mono">{deleteTarget?.code}</strong> sẽ bị xóa vĩnh viễn.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Hủy</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
