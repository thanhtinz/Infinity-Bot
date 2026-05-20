import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  // Set default upload package
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
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {product.emoji ? (
              <span className="text-xl">{product.emoji}</span>
            ) : (
              <Package className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">{product.name}</h3>
            <p className="text-sm text-muted-foreground">
              {product.category_id ? "Category" : "Uncategorized"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(product)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(product)}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Info Section ── */}
        <div className="p-4 border-b">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Price</p>
              <p className="font-semibold text-green-600 dark:text-green-400">{formatPrice(getMinPrice(product))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Stock (Available)</p>
              <p className="font-semibold">{totalAvailable}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Packages</p>
              <p className="font-semibold">{product.packages?.length || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs mt-0.5",
                  product.active
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                )}
              >
                {product.active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>

        {/* ── Inventory Section ── */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Warehouse className="h-4 w-4" />
            <h4 className="font-semibold text-sm">Inventory</h4>
            <div className="flex-1" />
            <Button
              size="sm"
              variant={inventoryTab === "list" ? "default" : "outline"}
              className="h-7 text-xs rounded-full"
              onClick={() => setInventoryTab("list")}
            >
              Stock List
            </Button>
            <Button
              size="sm"
              variant={inventoryTab === "upload" ? "default" : "outline"}
              className="h-7 text-xs rounded-full"
              onClick={() => setInventoryTab("upload")}
            >
              <Upload className="h-3 w-3 mr-1" /> Add Stock
            </Button>
          </div>

          {inventoryTab === "list" && (
            <>
              {/* Sub-filter tabs */}
              <div className="flex gap-2 mb-3">
                {(["all", "available", "delivered"] as const).map((f) => {
                  const count = f === "all" ? items.length : f === "available" ? availableCount : deliveredCount;
                  return (
                    <button
                      key={f}
                      onClick={() => setListFilter(f)}
                      className={cn(
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        listFilter === f
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {f === "all" ? "All" : f === "available" ? "Available" : "Delivered"} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Items list */}
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filteredItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No items.</p>
                ) : (
                  filteredItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 group">
                      <span className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        item.status === "available" ? "bg-green-500" : "bg-gray-400"
                      )} />
                      <span className="text-sm flex-1 truncate" title={item.content}>{item.content}</span>
                      <span className="text-[10px] text-muted-foreground">{item.package_name}</span>
                      {item.status === "available" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={() => deleteItemMutation.mutate(item.id)}
                          disabled={deleteItemMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
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
                <div className="space-y-1">
                  <Label className="text-xs">Package</Label>
                  <div className="flex gap-2 flex-wrap">
                    {inventoryPkgs.map((pkg) => (
                      <button
                        key={pkg.name}
                        onClick={() => setUploadPkg(pkg.name)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                          effectivePkg === pkg.name
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {pkg.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
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
                    <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted transition-colors cursor-pointer">
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
