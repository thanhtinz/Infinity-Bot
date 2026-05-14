import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, ImageIcon, PackagePlus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/EmojiPicker";
import type { Product, ProductPackage } from "../types";

const productSchema = z.object({
  name: z.string().min(1, "Tên không được để trống"),
  description: z.string().optional(),
  image_url: z.string().optional(),
  active: z.boolean().default(true),
});
type ProductForm = z.infer<typeof productSchema>;

const emptyPackage = (): ProductPackage => ({ name: "", price: 0, active: true });

export function ProductsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [packages, setPackages] = useState<ProductPackage[]>([emptyPackage()]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => fetch("/api/products", { credentials: "include" }).then((r) => r.json()),
    staleTime: 30_000,
  });

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", image_url: "", active: true },
  });

  const imageUrl = form.watch("image_url");

  // ── Upload ảnh ──────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/products/upload-image", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      form.setValue("image_url", data.url);
    } catch {
      toast({ variant: "destructive", title: "Upload thất bại" });
    } finally {
      setUploading(false);
    }
  };

  // ── Package helpers ─────────────────────────────────────────
  const updatePkg = (i: number, field: keyof ProductPackage, value: string | number | boolean) => {
    setPackages((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  };
  const removePkg = (i: number) => setPackages((prev) => prev.filter((_, idx) => idx !== i));
  const addPkg = () => setPackages((prev) => [...prev, emptyPackage()]);

  // ── Toggle product active ───────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: (p: Product) =>
      fetch(`/api/products/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...p, active: !p.active }),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
    onError: () => toast({ variant: "destructive", title: "Lỗi", description: "Không thể cập nhật." }),
  });

  // ── Save (create / edit) ────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (values: ProductForm & { packages: ProductPackage[] }) => {
      const method = editingProduct ? "PUT" : "POST";
      const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
      return fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
      toast({ title: editingProduct ? "Đã cập nhật sản phẩm." : "Đã thêm sản phẩm." });
    },
    onError: () => toast({ variant: "destructive", title: "Lỗi lưu sản phẩm." }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/products/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDeleteTarget(null);
      toast({ title: "Đã xóa sản phẩm." });
    },
    onError: () => toast({ variant: "destructive", title: "Lỗi xóa sản phẩm." }),
  });

  const openCreate = () => {
    setEditingProduct(null);
    form.reset({ name: "", description: "", image_url: "", active: true });
    setPackages([emptyPackage()]);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    form.reset({ name: p.name, description: p.description || "", image_url: p.image_url || "", active: p.active });
    setPackages(p.packages?.length ? p.packages.map((pkg) => ({ ...pkg })) : [emptyPackage()]);
    setDialogOpen(true);
  };

  const onSubmit = (values: ProductForm) => {
    const validPkgs = packages.filter((pk) => pk.name.trim());
    saveMutation.mutate({ ...values, packages: validPkgs });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sản phẩm</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Thêm sản phẩm
        </Button>
      </div>

      {/* Product cards grid */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Đang tải...</p>
      ) : products.length === 0 ? (
        <p className="text-muted-foreground text-sm">Chưa có sản phẩm nào.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <Card key={p.id} className={cn("overflow-hidden", !p.active && "opacity-60")}>
              {/* Ảnh */}
              <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold leading-tight">{p.name}</CardTitle>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={p.active}
                      onCheckedChange={() => toggleMutation.mutate(p)}
                      className="scale-75"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                {/* Gói giá */}
                {p.packages?.length > 0 ? (
                  <div className="space-y-1">
                    {p.packages.map((pkg, i) => (
                      <div key={i} className={cn("flex items-center justify-between text-xs rounded px-2 py-1 bg-muted/50", !pkg.active && "opacity-50 line-through")}>
                        <span>{pkg.name}</span>
                        <span className="font-medium">{pkg.price.toLocaleString("vi-VN")} đ</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Chưa có gói</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Dialog Thêm/Sửa ── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Sửa sản phẩm" : "Thêm sản phẩm"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Tên */}
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên sản phẩm</FormLabel>
                  <div className="flex items-center gap-1">
                    <FormControl><Input {...field} placeholder="VD: VIP Discord" /></FormControl>
                    <EmojiPicker onSelect={(em) => field.onChange(field.value + em)} />
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Mô tả */}
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mô tả</FormLabel>
                  <div className="flex items-start gap-1">
                    <FormControl><Textarea {...field} rows={2} placeholder="Mô tả ngắn..." className="flex-1" /></FormControl>
                    <EmojiPicker onSelect={(em) => field.onChange((field.value || "") + em)} />
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Ảnh */}
              <FormField control={form.control} name="image_url" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ảnh sản phẩm</FormLabel>
                  <div className="flex gap-2 items-start">
                    <div
                      className="w-24 h-20 rounded border bg-muted flex items-center justify-center cursor-pointer overflow-hidden shrink-0"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {imageUrl ? (
                        <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploading ? "Đang upload..." : "Chọn ảnh"}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                      <Input
                        {...field}
                        placeholder="hoặc nhập URL ảnh"
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <Separator />

              {/* Gói giá */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Gói sản phẩm</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={addPkg}>
                    <PackagePlus className="mr-1 h-3.5 w-3.5" /> Thêm gói
                  </Button>
                </div>
                {packages.map((pkg, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                    <Input
                      placeholder="Tên gói"
                      value={pkg.name}
                      onChange={(e) => updatePkg(i, "name", e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                    <Input
                      type="number"
                      placeholder="Giá"
                      value={pkg.price || ""}
                      onChange={(e) => updatePkg(i, "price", parseFloat(e.target.value) || 0)}
                      className="w-28 h-8 text-sm"
                    />
                    <Switch
                      checked={pkg.active}
                      onCheckedChange={(v) => updatePkg(i, "active", v)}
                      title="Bật/tắt gói"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive shrink-0"
                      onClick={() => removePkg(i)}
                      disabled={packages.length === 1}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Toggle sản phẩm */}
              <FormField control={form.control} name="active" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="cursor-pointer">Đang bán</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Đang lưu..." : "Lưu"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Xóa ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa sản phẩm?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sản phẩm <strong>{deleteTarget?.name}</strong> sẽ bị xóa vĩnh viễn.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Hủy</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
