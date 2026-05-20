import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmojiInput, EmojiTextarea } from "@/components/EmojiInput";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PackagePlus, X, Save, Loader2, Warehouse, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EmojiPicker } from "@/components/EmojiPicker";
import { PageContainer, PageEditHeader } from "@/components/infinity";
import type { Product, ProductPackage, ProductCategory } from "../../types";
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  note: z.string().optional(),
  emoji: z.string().optional(),
  category_id: z.number({ required_error: "Category is required" }).min(1, "Category is required"),
  active: z.boolean(),
});
type ProductForm = z.infer<typeof productSchema>;

const emptyPackage = (): ProductPackage => ({ name: "", price: 0, active: true });

export function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !id;

  const [packages, setPackages] = useState<ProductPackage[]>([emptyPackage()]);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch("/api/products").then((r) => r.json()),
    enabled: !isNew,
    staleTime: 60_000,
  });

  const { selectedGuildId } = useGuild();

  const { data: categories = [] } = useQuery<ProductCategory[]>({
    queryKey: ["categories", selectedGuildId],
    queryFn: () => apiFetch("/api/categories").then((r) => r.json()),
    staleTime: 60_000,
    enabled: !!selectedGuildId,
  });

  const item = id ? products?.find((p) => String(p.id) === id) : undefined;

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", note: "", emoji: "", category_id: undefined as unknown as number, active: true },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        description: item.description || "",
        note: item.note || "",
        emoji: item.emoji || "",
        category_id: item.category_id ?? (undefined as unknown as number),
        active: item.active,
      });
      setPackages(item.packages?.length ? item.packages.map((pkg) => ({ ...pkg })) : [emptyPackage()]);
    }
  }, [item?.id]);

  // ── Package helpers ─────────────────────────────────────────
  const updatePkg = (i: number, field: keyof ProductPackage, value: string | number | boolean) => {
    setPackages((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  };
  const removePkg = (i: number) => setPackages((prev) => prev.filter((_, idx) => idx !== i));
  const addPkg = () => setPackages((prev) => [...prev, emptyPackage()]);

  // ── Mutations ───────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (values: ProductForm & { packages: ProductPackage[] }) =>
      apiFetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      navigate(-1);
      toast({ title: "Product added." });
    },
    onError: () => toast({ variant: "destructive", title: "Error saving product." }),
  });

  const updateMutation = useMutation({
    mutationFn: (values: ProductForm & { packages: ProductPackage[] } & { id: number }) =>
      apiFetch(`/api/products/${values.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      navigate(-1);
      toast({ title: "Product updated." });
    },
    onError: () => toast({ variant: "destructive", title: "Error saving product." }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: ProductForm) => {
    const validPkgs = packages.filter((pk) => pk.name.trim());
    const payload = { ...values, packages: validPkgs };
    if (!isNew && id) {
      updateMutation.mutate({ ...payload, id: Number(id) });
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
    <PageContainer size="sm">
      <PageEditHeader
        title={isNew ? "Create product" : "Edit product"}
        description={isNew ? "Create new product" : "Edit product details"}
        onBack={() => navigate(-1)}
      >
        <Button className="rounded-xl gap-2" onClick={form.handleSubmit(onSubmit)} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="hidden sm:inline">{isPending ? "Saving..." : "Save"}</span>
        </Button>
      </PageEditHeader>

      {isNew ? (
        /* ── Create mode: no tabs, just the form ── */
        <ProductInfoForm
            form={form}
            packages={packages}
            categories={categories}
            addPkg={addPkg}
            updatePkg={updatePkg}
            removePkg={removePkg}
            onSubmit={onSubmit}
          />
      ) : (
        /* ── Edit mode: Info only (no Embed tab) ── */
          <ProductInfoForm
            form={form}
            packages={packages}
            categories={categories}
            addPkg={addPkg}
            updatePkg={updatePkg}
            removePkg={removePkg}
            onSubmit={onSubmit}
          />
      )}
    </PageContainer>
  );
}

/* ── Extracted form fields ─────────────────────────────────────────────── */
interface ProductInfoFormProps {
  form: ReturnType<typeof useForm<ProductForm>>;
  packages: ProductPackage[];
  categories: ProductCategory[];
  addPkg: () => void;
  updatePkg: (i: number, field: keyof ProductPackage, value: string | number | boolean) => void;
  removePkg: (i: number) => void;
  onSubmit: (values: ProductForm) => void;
}

function ProductInfoForm({ form, packages, categories, addPkg, updatePkg, removePkg, onSubmit }: ProductInfoFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Name */}
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Product name</FormLabel>
            <FormControl><EmojiInput {...field} placeholder="VD: VIP Discord" wrapperClassName="w-full" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Emoji icon for dropdown */}
        <FormField control={form.control} name="emoji" render={({ field }) => (
          <FormItem>
            <FormLabel>Dropdown emoji <span className="text-xs text-muted-foreground font-normal">(shown in price list menu)</span></FormLabel>
            <div className="flex items-center gap-2">
              <div className="w-12 h-10 rounded border bg-muted flex items-center justify-center text-xl shrink-0">
                {field.value || "—"}
              </div>
              <EmojiPicker onSelect={(em) => field.onChange(em)} />
              {field.value && (
                <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange("")}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <FormMessage />
          </FormItem>
        )} />

        {/* Category */}
        <FormField control={form.control} name="category_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Category <span className="text-destructive">*</span></FormLabel>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories yet. Create a category first before adding products.</p>
            ) : (
              <Select
                value={field.value ? String(field.value) : ""}
                onValueChange={(v) => field.onChange(Number(v))}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FormMessage />
          </FormItem>
        )} />

        {/* Description */}
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl><EmojiTextarea {...field} rows={2} placeholder="Short description..." wrapperClassName="w-full" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Note */}
        <FormField control={form.control} name="note" render={({ field }) => (
          <FormItem>
            <FormLabel>Note <span className="text-xs text-muted-foreground font-normal">(internal / post-purchase instructions)</span></FormLabel>
            <FormControl><EmojiTextarea {...field} rows={3} placeholder="e.g. Delivery instructions, download links, activation info..." wrapperClassName="w-full" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Separator />

        {/* Package price */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <FormLabel>Package product</FormLabel>
            <Button type="button" variant="outline" size="sm" onClick={addPkg}>
              <PackagePlus className="mr-1 h-3.5 w-3.5" /> Add Package
            </Button>
          </div>
          <div className="space-y-2">
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
                  <Switch
                    checked={pkg.auto_buy ?? false}
                    onCheckedChange={(v) => updatePkg(i, "auto_buy", v)}
                  />
                  <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Auto-buy</span>
                  {pkg.auto_buy && (
                    <span className="text-[10px] font-medium text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 px-1.5 py-0.5 rounded">Auto-buy</span>
                  )}
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Switch
                    checked={pkg.active}
                    onCheckedChange={(v) => updatePkg(i, "active", v)}
                  />
                  <span className="text-xs text-muted-foreground">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Switch
                    checked={pkg.use_inventory ?? false}
                    onCheckedChange={(v) => updatePkg(i, "use_inventory", v)}
                  />
                  <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Inventory</span>
                  {pkg.use_inventory && (
                    <span className="text-[10px] font-medium text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded">Auto-delivery</span>
                  )}
                </label>
              </div>
            </div>
          ))}
          </div>
        </div>

        <Separator />

        {/* Toggle product */}
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
  );
}
