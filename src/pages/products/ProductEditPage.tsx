import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PackagePlus, X, ArrowLeft, Info, MessageSquare, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EmojiPicker } from "@/components/EmojiPicker";
import type { Product, ProductPackage } from "../../types";
import { apiFetch } from "@/hooks/useApi";
import { EmbedsManager } from "@/pages/EmbedsManager";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  note: z.string().optional(),
  emoji: z.string().optional(),
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

  const item = id ? products?.find((p) => String(p.id) === id) : undefined;

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", note: "", emoji: "", active: true },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        description: item.description || "",
        note: item.note || "",
        emoji: item.emoji || "",
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
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-card px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold text-lg">{isNew ? "Create product" : "Edit product"}</h1>
        <div className="ml-auto">
          <Button onClick={form.handleSubmit(onSubmit)} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <Save className="h-4 w-4 sm:mr-2" />}
            <span className="hidden sm:inline">{isPending ? "Saving..." : "Save"}</span>
          </Button>
        </div>
      </div>

      {isNew ? (
        /* ── Create mode: no tabs, just the form ── */
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          <ProductInfoForm
            form={form}
            packages={packages}
            addPkg={addPkg}
            updatePkg={updatePkg}
            removePkg={removePkg}
            onSubmit={onSubmit}
          />
        </div>
      ) : (
        /* ── Edit mode: Info + Embed tabs ── */
        <Tabs defaultValue="info" className="flex flex-col h-[calc(100vh-73px)]">
          <div className="border-b bg-card px-6">
            <TabsList className="h-10 bg-transparent gap-1 p-0">
              <TabsTrigger
                value="info"
                className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 gap-1.5"
              >
                <Info className="h-3.5 w-3.5" />
                Info
              </TabsTrigger>
              <TabsTrigger
                value="embed"
                className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 gap-1.5"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Embed
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="info" className="flex-1 overflow-auto m-0">
            <div className="max-w-2xl mx-auto p-6 space-y-6">
              <ProductInfoForm
                form={form}
                packages={packages}
                addPkg={addPkg}
                updatePkg={updatePkg}
                removePkg={removePkg}
                onSubmit={onSubmit}
              />
            </div>
          </TabsContent>

          <TabsContent value="embed" className="flex-1 overflow-hidden m-0">
            <EmbedsManager eventKeys={[`product_${id}`]} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/* ── Extracted form fields ─────────────────────────────────────────────── */
interface ProductInfoFormProps {
  form: ReturnType<typeof useForm<ProductForm>>;
  packages: ProductPackage[];
  addPkg: () => void;
  updatePkg: (i: number, field: keyof ProductPackage, value: string | number | boolean) => void;
  removePkg: (i: number) => void;
  onSubmit: (values: ProductForm) => void;
}

function ProductInfoForm({ form, packages, addPkg, updatePkg, removePkg, onSubmit }: ProductInfoFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Name */}
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Product name</FormLabel>
            <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
              <FormControl><Input {...field} placeholder="VD: VIP Discord" className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0" /></FormControl>
              <EmojiPicker onSelect={(em) => field.onChange(field.value + em)} />
            </div>
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

        {/* Description */}
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
              <FormControl><Textarea {...field} rows={2} placeholder="Short description..." className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1" /></FormControl>
              <EmojiPicker onSelect={(em) => field.onChange((field.value || "") + em)} />
            </div>
            <FormMessage />
          </FormItem>
        )} />

        {/* Note */}
        <FormField control={form.control} name="note" render={({ field }) => (
          <FormItem>
            <FormLabel>Note <span className="text-xs text-muted-foreground font-normal">(internal / post-purchase instructions)</span></FormLabel>
            <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
              <FormControl><Textarea {...field} rows={3} placeholder="e.g. Delivery instructions, download links, activation info..." className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1" /></FormControl>
              <EmojiPicker onSelect={(em) => field.onChange((field.value || "") + em)} />
            </div>
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
          {packages.map((pkg, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
              <Input
                placeholder="Name package"
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
              <Switch
                checked={pkg.active}
                onCheckedChange={(v) => updatePkg(i, "active", v)}
                title="Toggle package"
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
