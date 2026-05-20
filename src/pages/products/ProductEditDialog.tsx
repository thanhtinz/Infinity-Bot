import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmojiInput, EmojiTextarea } from "@/components/EmojiInput";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PackagePlus, X, Save, Loader2, Warehouse, Zap, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EmojiPicker } from "@/components/EmojiPicker";
import type { Product, ProductPackage, ProductCategory } from "@/types";

/** Render emoji — handles both Unicode and Discord custom format <:name:id> / <a:name:id> */
function EmojiDisplay({ emoji, className }: { emoji: string; className?: string }) {
  const match = emoji.match(/^<(a?):(\w+):(\d+)>$/);
  if (match) {
    const [, animated, , id] = match;
    return <img src={`https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "webp"}?size=48`} alt="" className={`inline-block ${className ?? ""}`} />;
  }
  return <span className={className}>{emoji}</span>;
}
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  note: z.string().optional(),
  emoji: z.string().optional(),
  category_id: z.number().nullable().optional(),
  active: z.boolean(),
});
type ProductForm = z.infer<typeof productSchema>;

const emptyPackage = (): ProductPackage => ({ name: "", price: 0, active: true });

interface Props {
  product: Product | null; // null = create new
  open: boolean;
  onClose: () => void;
}

export function ProductEditDialog({ product, open, onClose }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();
  const isNew = !product;

  const [packages, setPackages] = useState<ProductPackage[]>([emptyPackage()]);
  // Stock content per package index (for new products with inventory enabled)
  const [stockDrafts, setStockDrafts] = useState<Record<number, string>>({});

  const { data: categories = [] } = useQuery<ProductCategory[]>({
    queryKey: ["categories", selectedGuildId],
    queryFn: () => apiFetch("/api/categories").then((r) => r.json()),
    staleTime: 60_000,
    enabled: !!selectedGuildId && open,
  });

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", note: "", emoji: "", category_id: null, active: true },
  });

  // Reset form when product changes
  useEffect(() => {
    if (!open) return;
    if (product) {
      form.reset({
        name: product.name,
        description: product.description || "",
        note: product.note || "",
        emoji: product.emoji || "",
        category_id: product.category_id ?? null,
        active: product.active,
      });
      setPackages(product.packages?.length ? product.packages.map((pkg) => ({ ...pkg })) : [emptyPackage()]);
    } else {
      form.reset({ name: "", description: "", note: "", emoji: "", category_id: null, active: true });
      setPackages([emptyPackage()]);
    }
    setStockDrafts({});
  }, [product?.id, open]);

  // ── Package helpers ─────────────────────────────────────────
  const updatePkg = (i: number, field: keyof ProductPackage, value: string | number | boolean) => {
    setPackages((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  };
  const removePkg = (i: number) => {
    setPackages((prev) => prev.filter((_, idx) => idx !== i));
    setStockDrafts((prev) => {
      const next = { ...prev };
      delete next[i];
      return next;
    });
  };
  const addPkg = () => setPackages((prev) => [...prev, emptyPackage()]);

  // ── Mutations ───────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (values: ProductForm & { packages: ProductPackage[] }) => {
      const r = await apiFetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: async (data) => {
      // Upload stock for packages with use_inventory
      const productId = data.id;
      if (productId) {
        const uploads: Promise<unknown>[] = [];
        packages.forEach((pkg, i) => {
          if (pkg.use_inventory && stockDrafts[i]) {
            const lines = stockDrafts[i].split("\n").map((l) => l.trim()).filter(Boolean);
            if (lines.length > 0) {
              uploads.push(
                apiFetch("/api/inventory/bulk", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ product_id: productId, package_name: pkg.name, contents: lines }),
                })
              );
            }
          }
        });
        if (uploads.length > 0) await Promise.all(uploads);
      }
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      onClose();
      toast({ title: "Product created." });
    },
    onError: () => toast({ variant: "destructive", title: "Error saving product." }),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ProductForm & { packages: ProductPackage[] } & { id: number }) => {
      const r = await apiFetch(`/api/products/${values.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: async (data) => {
      // Upload stock for newly-enabled inventory packages
      const productId = data.id || product?.id;
      if (productId) {
        const uploads: Promise<unknown>[] = [];
        packages.forEach((pkg, i) => {
          if (pkg.use_inventory && stockDrafts[i]) {
            const lines = stockDrafts[i].split("\n").map((l) => l.trim()).filter(Boolean);
            if (lines.length > 0) {
              uploads.push(
                apiFetch("/api/inventory/bulk", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ product_id: productId, package_name: pkg.name, contents: lines }),
                })
              );
            }
          }
        });
        if (uploads.length > 0) await Promise.all(uploads);
      }
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inventory-stats"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      onClose();
      toast({ title: "Product updated." });
    },
    onError: () => toast({ variant: "destructive", title: "Error saving product." }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: ProductForm) => {
    const validPkgs = packages.filter((pk) => pk.name.trim());
    const payload = { ...values, packages: validPkgs };
    if (!isNew && product) {
      updateMutation.mutate({ ...payload, id: product.id });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background z-10">
          <h3 className="font-semibold">{isNew ? "Create Product" : "Edit Product"}</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={form.handleSubmit(onSubmit)} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Name */}
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product name</FormLabel>
                  <FormControl><EmojiInput {...field} placeholder="e.g. VIP Discord" wrapperClassName="w-full" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Emoji */}
              <FormField control={form.control} name="emoji" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emoji <span className="text-xs text-muted-foreground font-normal">(shown in menu)</span></FormLabel>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-10 rounded border bg-muted flex items-center justify-center text-xl shrink-0">
                      {field.value ? <EmojiDisplay emoji={field.value} className="h-6 w-6" /> : "—"}
                    </div>
                    <EmojiPicker onSelect={(em) => field.onChange(em)} />
                    {field.value && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange("")}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </FormItem>
              )} />

              {/* Category */}
              <FormField control={form.control} name="category_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    value={field.value == null ? "none" : String(field.value)}
                    onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="No Category" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No Category</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              {/* Description */}
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><EmojiTextarea {...field} rows={2} placeholder="Short description..." wrapperClassName="w-full" /></FormControl>
                </FormItem>
              )} />

              {/* Note */}
              <FormField control={form.control} name="note" render={({ field }) => (
                <FormItem>
                  <FormLabel>Note <span className="text-xs text-muted-foreground font-normal">(internal / post-purchase)</span></FormLabel>
                  <FormControl><EmojiTextarea {...field} rows={2} placeholder="Delivery instructions, download links..." wrapperClassName="w-full" /></FormControl>
                </FormItem>
              )} />

              <Separator />

              {/* Packages */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Packages</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={addPkg}>
                    <PackagePlus className="mr-1 h-3.5 w-3.5" /> Add Package
                  </Button>
                </div>
                <div className="space-y-3">
                  {packages.map((pkg, i) => (
                    <div key={i} className="rounded-lg border bg-card p-3 space-y-3">
                      {/* Row 1: Name + Price + Delete */}
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Package name"
                          value={pkg.name}
                          onChange={(e) => updatePkg(i, "name", e.target.value)}
                          className="flex-1 h-8 text-sm"
                        />
                        <Input
                          type="number"
                          placeholder="Price"
                          value={pkg.price || ""}
                          onChange={(e) => updatePkg(i, "price", parseFloat(e.target.value) || 0)}
                          className="w-28 h-8 text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive shrink-0"
                          onClick={() => removePkg(i)}
                          disabled={packages.length === 1}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {/* Row 2: Toggles */}
                      <div className="flex items-center gap-4 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <Switch checked={pkg.auto_buy ?? false} onCheckedChange={(v) => updatePkg(i, "auto_buy", v)} />
                          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Auto-buy</span>
                          {pkg.auto_buy && (
                            <span className="text-[10px] font-medium text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 px-1.5 py-0.5 rounded">Auto-buy</span>
                          )}
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <Switch checked={pkg.active} onCheckedChange={(v) => updatePkg(i, "active", v)} />
                          <span className="text-xs text-muted-foreground">Active</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <Switch checked={pkg.use_inventory ?? false} onCheckedChange={(v) => updatePkg(i, "use_inventory", v)} />
                          <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Inventory</span>
                          {pkg.use_inventory && (
                            <span className="text-[10px] font-medium text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded">Auto-delivery</span>
                          )}
                        </label>
                      </div>

                      {/* Inline stock upload when inventory enabled */}
                      {pkg.use_inventory && (
                        <div className="border-t pt-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs flex items-center gap-1.5">
                              <Upload className="h-3 w-3" /> Upload stock <span className="text-muted-foreground">(one per line)</span>
                            </Label>
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                accept=".txt,.csv"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = (ev) => {
                                    const text = ev.target?.result as string;
                                    setStockDrafts((prev) => ({
                                      ...prev,
                                      [i]: prev[i] ? prev[i] + "\n" + text : text,
                                    }));
                                  };
                                  reader.readAsText(file);
                                  e.target.value = "";
                                }}
                              />
                              <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium hover:bg-muted transition-colors cursor-pointer">
                                <Upload className="h-2.5 w-2.5" /> File
                              </span>
                            </label>
                          </div>
                          <EmojiTextarea
                            rows={3}
                            placeholder={"key1\nkey2\nhttps://example.com"}
                            value={stockDrafts[i] || ""}
                            onChange={(e) => setStockDrafts((prev) => ({ ...prev, [i]: e.target.value }))}
                          />
                          {stockDrafts[i] && (
                            <p className="text-[10px] text-muted-foreground">
                              {stockDrafts[i].split("\n").map((l) => l.trim()).filter(Boolean).length} items to upload on save
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Active toggle */}
              <FormField control={form.control} name="active" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="cursor-pointer">Active</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
