import { useState, useEffect, useRef } from "react";
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
import { ImageIcon, PackagePlus, X, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EmojiPicker } from "@/components/EmojiPicker";
import type { Product, ProductPackage } from "../../types";
import { apiFetch } from "@/hooks/useApi";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  note: z.string().optional(),
  image_url: z.string().optional(),
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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch("/api/products").then((r) => r.json()),
    enabled: !isNew,
    staleTime: 60_000,
  });

  const item = id ? products?.find((p) => String(p.id) === id) : undefined;

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", note: "", image_url: "", active: true },
  });

  const imageUrl = form.watch("image_url");

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        description: item.description || "",
        note: item.note || "",
        image_url: item.image_url || "",
        active: item.active,
      });
      setPackages(item.packages?.length ? item.packages.map((pkg) => ({ ...pkg })) : [emptyPackage()]);
    }
  }, [item?.id]);

  // ── Upload image ──────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/products/upload-image", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      form.setValue("image_url", data.url);
    } catch {
      toast({ variant: "destructive", title: "Upload failed" });
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
      fetch(`/api/products/${values.id}`, {
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
        <h1 className="font-semibold text-lg">{isNew ? "Create" : "Edit"}</h1>
        <div className="ml-auto">
          <Button onClick={form.handleSubmit(onSubmit)} disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
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

            {/* Ảnh */}
            <FormField control={form.control} name="image_url" render={({ field }) => (
              <FormItem>
                <FormLabel>Product image</FormLabel>
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
                      {uploading ? "Uploading..." : "Choose image"}
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
                      placeholder="or enter Image URL"
                      className="text-xs h-8"
                    />
                  </div>
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
      </div>
    </div>
  );
}
