import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Product } from "../types";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";

export function ProductsManager() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useT();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch("/api/products").then((r) => r.json()),
    staleTime: 30_000,
  });

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
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("products_title")}</h1>
        <Button size="sm" onClick={() => navigate('/products/new')}>
          <Plus className="mr-2 h-4 w-4" /> {t("products_add")}
        </Button>
      </div>

      {/* Product cards grid */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t("loading")}</p>
      ) : products.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("products_empty")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <Card key={p.id} className={cn("overflow-hidden", !p.active && "opacity-60")}>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {p.emoji && <span className="text-xl">{p.emoji}</span>}
                    <CardTitle className="text-sm font-semibold leading-tight">{p.name}</CardTitle>
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
                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                {/* Package price */}
                {p.packages?.length > 0 ? (
                  <div className="space-y-1">
                    {p.packages.map((pkg, i) => (
                      <div key={i} className={cn("flex items-center justify-between text-xs rounded px-2 py-1 bg-muted/50", !pkg.active && "opacity-50 line-through")}>
                        <span>{pkg.name}</span>
                        <span className="font-medium">{pkg.price.toLocaleString()} VND</span>
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
    </div>
  );
}
