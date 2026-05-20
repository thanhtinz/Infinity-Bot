import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmojiTextarea } from "@/components/EmojiInput";
import { Pencil, Trash2, X, Package, Warehouse, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";
import { useCurrency } from "@/hooks/useCurrency";
import { useToast } from "@/hooks/use-toast";

interface InventoryStat {
  product_id: number;
  product_name: string | null;
  package_name: string;
  total: number;
  available: number;
  delivered: number;
}

interface InventoryItem {
  id: number;
  product_id: number;
  product_name: string | null;
  package_name: string;
  content: string;
  delivered_order_id: number | null;
  status: "available" | "delivered";
}

interface Props {
  product: Product | null;
  onClose: () => void;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  inventoryStats: InventoryStat[];
}

export function ProductDetailDialog({ product, onClose, onEdit, onDelete, inventoryStats }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();
  const { formatPrice } = useCurrency();
  const [inventoryTab, setInventoryTab] = useState<"list" | "upload">("list");
  const [listFilter, setListFilter] = useState<"all" | "available" | "delivered">("all");
  const [uploadContent, setUploadContent] = useState("");
  const [uploadPkg, setUploadPkg] = useState<string>("");

  const open = !!product;

  // Inventory packages for this product
  const inventoryPkgs = useMemo(
    () => product?.packages?.filter((p) => p.use_inventory) ?? [],
    [product]
  );

  const effectivePkg = uploadPkg || inventoryPkgs[0]?.name || "";

  // Stats for this product
  const productStats = useMemo(
    () => inventoryStats.filter((s) => s.product_id === product?.id),
    [inventoryStats, product?.id]
  );

  const totalAvailable = productStats.reduce((acc, s) => acc + s.available, 0);

  // Fetch inventory items for this product
  const { data: itemsRaw = [] } = useQuery<InventoryItem[]>({
    queryKey: ["inventory", selectedGuildId, product?.id],
    queryFn: () => apiFetch(`/api/inventory?product_id=${product!.id}`).then((r) => r.ok ? r.json() : []),
    enabled: open && !!selectedGuildId,
    staleTime: 15_000,
  });
  const items: InventoryItem[] = Array.isArray(itemsRaw) ? itemsRaw : [];

  // Fetch pending orders count for this product
  const { data: pendingCount = 0 } = useQuery<number>({
    queryKey: ["product-pending", selectedGuildId, product?.id],
    queryFn: async () => {
      const r = await apiFetch(`/api/orders?product_id=${product!.id}&status=PENDING`);
      if (!r.ok) return 0;
      const data = await r.json();
      return Array.isArray(data) ? data.length : (data?.orders?.length ?? 0);
    },
    enabled: open && !!selectedGuildId,
    staleTime: 30_000,
  });

  const filteredItems = useMemo(() => {
    if (listFilter === "all") return items;
    return items.filter((i) => i.status === listFilter);
  }, [items, listFilter]);

  const availableCount = items.filter((i) => i.status === "available").length;
  const deliveredCount = items.filter((i) => i.status === "delivered").length;

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: ({ product_id, package_name, contents }: { product_id: number; package_name: string; contents: string[] }) =>
      apiFetch("/api/inventory/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id, package_name, contents }),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-stats", selectedGuildId] });
      qc.invalidateQueries({ queryKey: ["inventory", selectedGuildId, product?.id] });
      setUploadContent("");
      setInventoryTab("list");
      toast({ title: "Stock uploaded." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/inventory/${id}`, { method: "DELETE" }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-stats", selectedGuildId] });
      qc.invalidateQueries({ queryKey: ["inventory", selectedGuildId, product?.id] });
      toast({ title: "Item deleted." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const uploadLines = uploadContent.split("\n").map((l) => l.trim()).filter(Boolean);

  const getMinPrice = (p: Product) => {
    const activePkgs = p.packages?.filter((pk) => pk.active) ?? [];
    if (activePkgs.length === 0) return p.price || 0;
    return Math.min(...activePkgs.map((pk) => pk.price));
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[90vh] overflow-y-auto">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 p-4 border-b">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            {product.emoji ? (
              <span className="text-xl">{product.emoji}</span>
            ) : (
              <Package className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg leading-tight truncate">{product.name}</h3>
            <p className="text-sm text-muted-foreground">
              {product.category_id ? "Category" : "Uncategorized"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onEdit(product)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => onDelete(product)}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Info Grid ── */}
        <div className="p-4 border-b">
          <div className="grid grid-cols-2 gap-y-4 gap-x-6">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Price</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatPrice(getMinPrice(product))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Stock (Available)</p>
              <p className="text-lg font-bold">{totalAvailable}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Pending Review</p>
              <p className="text-lg font-bold">{pendingCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Min / Max Purchase</p>
              <p className="text-lg font-bold">1 / 100</p>
            </div>
          </div>
        </div>

        {/* ── Inventory Section ── */}
        <div className="p-4">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-4">
            <Warehouse className="h-5 w-5 shrink-0" />
            <h4 className="font-bold text-base">Inventory</h4>
            <div className="flex-1" />
            <Button
              size="sm"
              variant={inventoryTab === "list" ? "default" : "outline"}
              className="h-8 rounded-full text-xs font-medium px-4"
              onClick={() => setInventoryTab("list")}
            >
              Stock List
            </Button>
            <Button
              size="sm"
              variant={inventoryTab === "upload" ? "default" : "outline"}
              className="h-8 rounded-full text-xs font-medium px-4"
              onClick={() => setInventoryTab("upload")}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Add Stock
            </Button>
          </div>

          {inventoryTab === "list" && (
            <>
              {/* Sub-filter pills */}
              <div className="flex gap-2 mb-3">
                {([
                  { key: "all" as const, label: "All", count: items.length },
                  { key: "available" as const, label: "Available", count: availableCount },
                  { key: "delivered" as const, label: "Delivered", count: deliveredCount },
                ]).map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setListFilter(key)}
                    className={cn(
                      "inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors border",
                      listFilter === key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {label} ({count})
                  </button>
                ))}
              </div>

              {/* Items list */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {filteredItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No items.</p>
                ) : (
                  filteredItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 group">
                      <span className={cn(
                        "h-2.5 w-2.5 rounded-full shrink-0",
                        item.status === "available" ? "bg-green-500" : "bg-gray-400"
                      )} />
                      <span className="text-sm flex-1 truncate" title={item.content}>{item.content}</span>
                      {item.status === "available" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={() => deleteItemMutation.mutate(item.id)}
                          disabled={deleteItemMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {inventoryTab === "upload" && (
            <div className="space-y-3">
              {/* Package selector if multiple */}
              {inventoryPkgs.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Package</Label>
                  <div className="flex gap-2 flex-wrap">
                    {inventoryPkgs.map((pkg) => (
                      <button
                        key={pkg.name}
                        onClick={() => setUploadPkg(pkg.name)}
                        className={cn(
                          "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors border",
                          effectivePkg === pkg.name
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        {pkg.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Items <span className="text-muted-foreground">(one per line)</span></Label>
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
                          setUploadContent((prev) => prev ? prev + "\n" + text : text);
                        };
                        reader.readAsText(file);
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors cursor-pointer">
                      <Upload className="h-3 w-3" /> Import file
                    </span>
                  </label>
                </div>
                <EmojiTextarea
                  rows={6}
                  placeholder={"key1\nkey2\nhttps://example.com/code3"}
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {uploadLines.length} item{uploadLines.length !== 1 ? "s" : ""} to upload
                </p>
              </div>

              <Button
                className="w-full"
                disabled={uploadMutation.isPending || uploadLines.length === 0 || !effectivePkg}
                onClick={() => product && uploadMutation.mutate({
                  product_id: product.id,
                  package_name: effectivePkg,
                  contents: uploadLines,
                })}
              >
                {uploadMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Upload {uploadLines.length} item{uploadLines.length !== 1 ? "s" : ""}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
