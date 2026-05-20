import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useT } from "@/i18n";
import { useCurrency } from "@/hooks/useCurrency";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Copy, Tag } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/infinity";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";


interface Coupon {
  id: number;
  code: string;
  discount_type: string;
  discount_percent: number | null;
  discount_amount: number | null;
  buy_x: number | null;
  get_y: number | null;
  apply_mode: string;
  max_uses: number;
  used_count: number;
  is_public: boolean;
}

export function CouponsManager() {
  const { t } = useT();
  const navigate = useNavigate();
  const { selectedGuildId } = useGuild();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const { formatPrice } = useCurrency();

  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ["coupons", selectedGuildId],
    queryFn: () => apiFetch("/api/coupons").then((r) => r.json()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["coupons", selectedGuildId] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/coupons/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast({ title: t("toast_couponDeleted") }); },
    onError: () => toast({ variant: "destructive", title: t("error") }),
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: t("copied") + ": " + code });
  };

  const usageColor = (c: Coupon) => {
    if (c.max_uses === 0) return "";
    const ratio = c.used_count / c.max_uses;
    if (ratio >= 1) return "text-destructive";
    if (ratio >= 0.8) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <PageContainer size="sm">
      <PageHeader title={t("coupons_title")} icon={Tag}>
        <Button size="sm" onClick={() => navigate('/coupons/new')}>
          <Plus className="mr-2 h-4 w-4" /> {t("coupons_add")}
        </Button>
      </PageHeader>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t("loading")}</p>
      ) : coupons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Tag className="h-10 w-10 opacity-30" />
          <p className="text-sm">{t("coupons_empty")}</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/coupons/new')}>{t("create")}</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {coupons.map((c) => {
            const exhausted = c.used_count >= c.max_uses;
            return (
              <Card key={c.id} className={cn("overflow-hidden", exhausted && "opacity-60")}>
                <CardContent className="p-3 sm:p-4 flex flex-wrap items-center gap-3 justify-between">
                  {/* Code + badges */}
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => copyCode(c.code)}
                      className="font-mono font-bold text-base tracking-widest hover:text-primary transition-colors flex items-center gap-1"
                      title={t("copy")}
                    >
                      {c.code}
                      <Copy className="h-3 w-3 opacity-50" />
                    </button>
                    {c.is_public && <Badge variant="secondary" className="text-xs">{t("all")}</Badge>}
                    {exhausted && <Badge variant="destructive" className="text-xs">{t("expired")}</Badge>}
                  </div>

                  {/* Discount info */}
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">{t("coupons_discount")}</p>
                      <p className="font-semibold">
                        {(c.discount_type || "percent") === "percent" && c.discount_percent
                          ? `${c.discount_percent}%`
                          : (c.discount_type || "percent") === "fixed" && c.discount_amount
                          ? formatPrice(c.discount_amount)
                          : (c.discount_type) === "buy_x_get_y" && c.buy_x && c.get_y
                          ? `Buy ${c.buy_x} Get ${c.get_y}`
                          : c.discount_percent ? `${c.discount_percent}%`
                          : c.discount_amount ? formatPrice(c.discount_amount)
                          : "—"}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">{t("coupons_used")}</p>
                      <p className={cn("font-semibold tabular-nums", usageColor(c))}>
                        {c.used_count}/{c.max_uses}
                      </p>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/coupons/' + c.id + '/edit')}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(c)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Confirm delete ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{t("confirmDelete")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("coupons_code")} <strong className="font-mono">{deleteTarget?.code}</strong> {t("thisCannotBeUndone")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
