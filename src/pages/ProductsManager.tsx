import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Package, Settings2, Loader2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/infinity";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Product, ProductCategory } from "../types";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";
import { useGuild } from "@/contexts/GuildContext";
import { useCurrency } from "@/hooks/useCurrency";

export function ProductsManager() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useT();
  const queryClient = useQueryClient();
  const { selectedGuildId } = useGuild();
  const { formatPrice } = useCurrency();
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");
  const [categoriesOpen, setCategoriesOpen] = useState(false);

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

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const filteredProducts =
    categoryFilter === "all"
      ? products
      : products.filter((p) => p.category_id === categoryFilter);

  // ── Toggle product active ───────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: (p: Product) =>
      apiFetch(`/api/products/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...p, active: !p.active }),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
    onError: () => toast({ variant: "destructive", title: t("error"), description: t("toast_couldNotUpdate") }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/products/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDeleteTarget(null);
      toast({ title: t("toast_productDeleted") });
    },
    onError: () => toast({ variant: "destructive", title: t("error"), description: t("toast_productDeleteFailed") }),
  });

  return (
    <PageContainer size="md">
      <PageHeader title={t("products_title")} icon={Package}>
        <Button size="sm" onClick={() => navigate('/products/new')}>
          <Plus className="mr-2 h-4 w-4" /> {t("products_add")}
        </Button>
      </PageHeader>

      {/* ── Category filter bar ── */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <button
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
              categoryFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
                categoryFilter === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {cat.name}
            </button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 ml-1"
            onClick={() => setCategoriesOpen(true)}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {categories.length === 0 && (
        <div className="flex items-center gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={() => setCategoriesOpen(true)}>
            <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Manage Categories
          </Button>
        </div>
      )}

      {/* Product cards grid */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t("loading")}</p>
      ) : filteredProducts.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("products_empty")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => (
            <Card key={p.id} className={cn("overflow-hidden", !p.active && "opacity-60")}>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.emoji && <span className="text-xl shrink-0">{p.emoji}</span>}
                    <CardTitle className="text-sm font-semibold leading-tight truncate">{p.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={p.active}
                      onCheckedChange={() => toggleMutation.mutate(p)}
                      className="scale-75"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/products/' + p.id + '/edit')}>
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
                <div className="flex items-center gap-2">
                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{p.description}</p>
                  )}
                </div>
                {p.category_id && categoryMap.has(p.category_id) && (
                  <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 py-0 h-4 font-normal">
                    {categoryMap.get(p.category_id)!.name}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                {/* Package price */}
                {p.packages?.length > 0 ? (
                  <div className="space-y-1">
                    {p.packages.map((pkg, i) => (
                      <div key={i} className={cn("flex items-center justify-between text-xs rounded px-2 py-1 bg-muted/50", !pkg.active && "opacity-50 line-through")}>
                        <span>{pkg.name}</span>
                        <span className="font-medium">{formatPrice(pkg.price)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">{t("products_noPackages")}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Confirm Delete ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("products_deleteConfirm")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("products_willBeDeleted")} <strong>{deleteTarget?.name}</strong>
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manage Categories Dialog ── */}
      <CategoriesDialog
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={categories}
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
