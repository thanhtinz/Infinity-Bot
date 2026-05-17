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
import { UserCheck, Plus, Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TicketTeamType {
  id: number;
  guild_id?: string;
  name: string;
  description?: string;
  role_ids: string[];
  panel_ids: number[];
  color: string;
  created_at?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TicketTeams() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { t } = useT();

  const [deleteTarget, setDeleteTarget] = useState<TicketTeamType | null>(null);

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: teams, isLoading } = useQuery({
    queryKey: ["ticket-teams"],
    queryFn: () => apiFetch("/api/ticket-teams").then((r) => r.json()),
    staleTime: 30_000,
  });



  // ─── Mutations ───────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/ticket-teams/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-teams"] });
      toast({ title: t("toast_teamDeleted") });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: t("ticketTeams_deleteFailed"), variant: "destructive" }),
  });

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

  const teamList = (teams as TicketTeamType[] | undefined) ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("ticketTeams_title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("ticketTeams_desc")}
          </p>
        </div>
        <Button onClick={() => navigate('/ticket-teams/new')}>
          <Plus className="mr-2 h-4 w-4" />
          {t("ticketTeams_createTeam")}
        </Button>
      </div>

      {/* Grid */}
      {teamList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <UserCheck className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">{t("ticketTeams_empty")}</p>
          <p className="text-sm">{t("ticketTeams_emptyDesc")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamList.map((t) => (
            <Card
              key={t.id}
              className="cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
              onClick={() => navigate('/ticket-teams/' + t.id + '/edit')}
            >
              <div
                className="h-1.5"
                style={{ backgroundColor: t.color || "#5865F2" }}
              />
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{t.name}</h3>
                    {t.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {t.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">{t.role_ids?.length ?? 0} {t("ticketTeams_roles")}</Badge>
                  <Badge variant="outline">{t.panel_ids?.length ?? 0} {t("ticketTeams_panels")}</Badge>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/ticket-teams/' + t.id + '/edit');
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
                      setDeleteTarget(t);
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
            <DialogTitle>{t("ticketTeams_deleteConfirm")}</DialogTitle>
            <DialogDescription>
              {t("ticketTeams_deleteDesc")}
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
