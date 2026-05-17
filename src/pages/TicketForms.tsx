import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { FileQuestion, Plus, Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormQuestion {
  label: string;
  placeholder: string;
  required: boolean;
  style: "short" | "paragraph";
}

interface TicketFormType {
  id: number;
  guild_id?: string;
  panel_id?: number | null;
  name: string;
  questions: FormQuestion[];
  created_at?: string;
}

interface TicketPanel {
  id: number;
  name: string;
  title?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TicketForms() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { t } = useT();

  const [deleteTarget, setDeleteTarget] = useState<TicketFormType | null>(null);

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: forms, isLoading } = useQuery({
    queryKey: ["ticket-forms"],
    queryFn: () => apiFetch("/api/ticket-forms").then((r) => r.json()),
    staleTime: 30_000,
  });

  const { data: panels } = useQuery({
    queryKey: ["ticket-panels"],
    queryFn: () => apiFetch("/api/ticket-panels").then((r) => r.json()),
    staleTime: 30_000,
  });

  // ─── Mutations ───────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/ticket-forms/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-forms"] });
      toast({ title: t("toast_formDeleted") });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: t("ticketForms_deleteFailed"), variant: "destructive" }),
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function getPanelName(panelId: number | null | undefined): string {
    if (!panelId || !panels) return "—";
    const p = (panels as TicketPanel[]).find((pp) => pp.id === panelId);
    return p ? p.name : "—";
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const formList = (forms as TicketFormType[] | undefined) ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("ticketForms_title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("ticketForms_desc")}
          </p>
        </div>
        <Button onClick={() => navigate('/ticket-forms/new')}>
          <Plus className="mr-2 h-4 w-4" />
          {t("ticketForms_newForm")}
        </Button>
      </div>

      {/* Grid */}
      {formList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileQuestion className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">{t("ticketForms_empty")}</p>
          <p className="text-sm">{t("ticketForms_emptyDesc")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {formList.map((f) => (
            <Card
              key={f.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate('/ticket-forms/' + f.id + '/edit')}
            >
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{f.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t("ticketForms_panel")} {getPanelName(f.panel_id)}
                    </p>
                  </div>
                  <Badge variant="secondary">{f.questions?.length ?? 0} {t("ticketForms_questions")}</Badge>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/ticket-forms/' + f.id + '/edit');
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(f);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Delete Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("ticketForms_deleteConfirm")}</DialogTitle>
            <DialogDescription>
              {t("ticketForms_deleteDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? t("deleting") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
