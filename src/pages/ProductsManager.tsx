import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Package, Settings2, Loader2, Search, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/infinity";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Product, ProductCategory } from "../types";
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";
import { useCurrency } from "@/hooks/useCurrency";
import { ProductDetailDialog } from "./products/ProductDetailDialog";
import { ProductEditDialog } from "./products/ProductEditDialog";

/** Render emoji — handles both Unicode and Discord custom format <:name:id> / <a:name:id> */
function EmojiDisplay({ emoji, className }: { emoji: string; className?: string }) {
  const match = emoji.match(/^<(a?):(\w+):(\d+)>$/);
  if (match) {
    const [, animated, , id] = match;
    return <img src={`https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "webp"}?size=48`} alt="" className={cn("inline-block", className)} />;
  }
  return <span className={className}>{emoji}</span>;
}

interface InventoryStat {
  product_id: number;
  product_name: string | null;
  package_name: string;
  total: number;
  available: number;
  delivered: number;
}

export function ProductsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedGuildId } = useGuild();
  const { formatPrice } = useCurrency();

  // ── State ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null | "new">(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  // ── Queries ─────────────────────────────────────────────────
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products", selectedGuildId],
    queryFn: () => apiFetch("/api/products").then((r) => r.json()),
    staleTime: 30_000,
    enabled: !!selectedGuildId,
  });

  const { data: categories = [] } = useQuery<ProductCategory[]>({
    queryKey: ["categories", selectedGuildId],
    queryFn: () => apiFetch("/api/categories").then((r) => r.json()),
    staleTime: 30_000,
    enabled: !!selectedGuildId,
  });

  const { data: inventoryStats = [] } = useQuery<InventoryStat[]>({
    queryKey: ["inventory-stats", selectedGuildId],
    queryFn: () => apiFetch("/api/inventory/stats").then((r) => r.ok ? r.json() : []),
    staleTime: 30_000,
    enabled: !!selectedGuildId,
  });

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // Build stock map: product_id → total available
  const stockMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of inventoryStats) {
      m.set(s.product_id, (m.get(s.product_id) || 0) + s.available);
    }
    return m;
  }, [inventoryStats]);

  // Check if product has inventory packages
  const hasInventory = (p: Product) =>
    p.packages?.some((pkg) => pkg.use_inventory);

  // ── Filtering ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = products;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    if (categoryFilter !== "all") {
      result = result.filter((p) => p.category_id === Number(categoryFilter));
    }
    if (statusFilter === "active") result = result.filter((p) => p.active);
    else if (statusFilter === "inactive") result = result.filter((p) => !p.active);
    if (stockFilter === "in_stock") result = result.filter((p) => (stockMap.get(p.id) || 0) > 0);
    else if (stockFilter === "out") result = result.filter((p) => hasInventory(p) && (stockMap.get(p.id) || 0) === 0);
    return result;
  }, [products, searchQuery, categoryFilter, statusFilter, stockFilter, stockMap]);

  // ── Pagination ──────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  // ── Mutations ───────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/products/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDeleteTarget(null);
      toast({ title: "Product deleted." });
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Could not delete product." }),
  });

  const handleRowClick = (p: Product) => {
    if (hasInventory(p)) {
      setDetailProduct(p);
    } else {
      setEditProduct(p);
    }
  };

  const getMinPrice = (p: Product) => {
    const activePkgs = p.packages?.filter((pk) => pk.active) ?? [];
    if (activePkgs.length === 0) return p.price || 0;
    return Math.min(...activePkgs.map((pk) => pk.price));
  };

  return (
    <PageContainer size="md">
      <PageHeader title="Products" icon={Package} description={`${products.length} product${products.length !== 1 ? "s" : ""}`}>
        <Button size="sm" onClick={() => setEditProduct("new")}>
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </PageHeader>

      {/* ── Filters ── */}
      <div className="rounded-xl border bg-card p-4 space-y-3 mb-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Search */}
          <div className="col-span-2 sm:col-span-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>

          {/* Category */}
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status */}
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {/* Stock */}
          <Select value={stockFilter} onValueChange={(v) => { setStockFilter(v); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="All stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock</SelectItem>
              <SelectItem value="in_stock">In stock</SelectItem>
              <SelectItem value="out">Out of stock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Manage categories button */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCategoriesOpen(true)}>
            <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Manage Categories
          </Button>
        </div>
      </div>

      {/* ── Product List ── */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">No products found.</p>
      ) : (
        <div className="space-y-2">
          {paginated.map((p) => {
            const stock = stockMap.get(p.id) ?? 0;
            const hasInv = hasInventory(p);
            return (
              <div
                key={p.id}
                className={cn(
                  "rounded-xl border bg-card p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                  !p.active && "opacity-60"
                )}
                onClick={() => handleRowClick(p)}
              >
                {/* Row 1: Icon + Name + Price + Stock */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {p.emoji ? (
                      <EmojiDisplay emoji={p.emoji} className="h-5 w-5 text-lg" />
                    ) : (
                      <Package className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{p.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {p.category_id && categoryMap.has(p.category_id) ? categoryMap.get(p.category_id)!.name : "Uncategorized"}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-medium text-sm text-green-600 dark:text-green-400">
                      {formatPrice(getMinPrice(p))}
                    </div>
                    {hasInv && (
                      <span className="text-xs text-muted-foreground">Stock: {stock}</span>
                    )}
                  </div>
                </div>

                {/* Row 2: Status + Actions */}
                <div className="flex items-center justify-between mt-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      p.active
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    )}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    {p.active ? "Active" : "Inactive"}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); setEditProduct(p); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">
            Page {page}/{totalPages} · {filtered.length} item{filtered.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[20, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manage Categories Dialog ── */}
      <CategoriesDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} categories={categories} />

      {/* ── Product Detail Dialog (with inventory) ── */}
      <ProductDetailDialog
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        onEdit={(p) => { setDetailProduct(null); setEditProduct(p); }}
        onDelete={(p) => { setDetailProduct(null); setDeleteTarget(p); }}
        inventoryStats={inventoryStats}
      />

      {/* ── Product Edit Dialog ── */}
      <ProductEditDialog
        product={editProduct === "new" ? null : editProduct}
        open={editProduct !== null}
        onClose={() => setEditProduct(null)}
      />
    </PageContainer>
  );
}

/* ── Categories Management Dialog ─────────────────────────────────────── */
interface CategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ProductCategory[];
}

function CategoriesDialog({ open, onOpenChange, categories: initialCategories }: CategoriesDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const createMutation = useMutation({
    mutationFn: (body: { name: string }) =>
      apiFetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNewName("");
      toast({ title: "Category created." });
    },
    onError: () => toast({ variant: "destructive", title: "Error creating category." }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string }) =>
      apiFetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingId(null);
      toast({ title: "Category updated." });
    },
    onError: () => toast({ variant: "destructive", title: "Error updating category." }),
  });

  const deleteCatMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/categories/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Category deleted." });
    },
    onError: () => toast({ variant: "destructive", title: "Error deleting category." }),
  });

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    createMutation.mutate({ name });
  };

  const startEdit = (cat: ProductCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const saveEdit = () => {
    const name = editName.trim();
    if (!name || editingId === null) return;
    updateMutation.mutate({ id: editingId, name });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {initialCategories.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No categories yet.</p>
          )}
          {initialCategories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2">
              {editingId === cat.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                  />
                  <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm truncate">{cat.name}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(cat)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteCatMutation.mutate(cat.id)}
                    disabled={deleteCatMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex items-center gap-2 w-full">
            <Input
              placeholder="New category name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button size="sm" onClick={handleAdd} disabled={createMutation.isPending || !newName.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
