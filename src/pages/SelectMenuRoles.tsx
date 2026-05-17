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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { EMBED_DEFAULTS } from "@/components/EmbedBuilder";
import type { EmbedField } from "@/components/EmbedBuilder";
import {
  ListChecks,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Calendar,
  Hash,
} from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SelectMenuOption {
  label: string;
  emoji: string;
  role_id: string;
  description: string;
}

interface SelectRolePanel {
  id: number;
  name: string;
  placeholder: string;
  options: SelectMenuOption[];
  min_values: number;
  max_values: number;
  channel_id?: string;
  message_id?: string;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  embed_footer: string;
  embed_image_url: string;
  embed_thumbnail_url: string;
  embed_fields: EmbedField[];
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(s?: string) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Panel Card ──────────────────────────────────────────────────────────────

function PanelCard({
  panel,
  onEdit,
  onDelete,
}: {
  panel: SelectRolePanel;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useT();
  const isDeployed = !!panel.message_id;
  const opts = panel.options ?? [];

  return (
    <Card className="overflow-hidden group transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        {/* Top: name + status */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold truncate text-sm">{panel.name}</span>
            <Badge
              variant="outline"
              className="text-[10px] font-mono shrink-0 px-1.5"
            >
              #{panel.id}
            </Badge>
          </div>
          {isDeployed ? (
            <Badge className="bg-green-500/15 text-green-600 border border-green-500/30 shrink-0 text-[10px] px-1.5">
              <CheckCircle2 className="h-3 w-3 mr-0.5" />
              {t("selectMenu_deployed")}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-muted-foreground shrink-0 text-[10px] px-1.5"
            >
              {t("selectMenu_notDeployed")}
            </Badge>
          )}
        </div>

        {/* Discord-style embed preview */}
        <div className="mx-4 mb-3 rounded overflow-hidden border border-border/50">
          <div className="flex">
            <div
              className="w-1 shrink-0"
              style={{ backgroundColor: panel.embed_color || EMBED_DEFAULTS.color }}
            />
            <div className="p-2.5 flex-1 min-w-0 bg-muted/30">
              <p className="font-semibold text-xs leading-tight">
                {panel.embed_title || t("selectMenu_titleFallback")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                {panel.embed_description || t("selectMenu_descFallback")}
              </p>
            </div>
          </div>
        </div>

        {/* Option chips row */}
        <div className="mx-4 mb-3 flex flex-wrap gap-1.5">
          {opts.map((opt, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium bg-[#5865F2] text-white"
            >
              {opt.emoji && <span>{opt.emoji}</span>}
              {opt.label || t("selectMenu_optionFallback")}
            </span>
          ))}
          {opts.length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              {t("selectMenu_zeroOptions")}
            </span>
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
            {opts.length} {t("selectMenu_optionCount")}
          </Badge>
        </div>

        {/* Channel */}
        <div className="mx-4 mb-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Hash className="h-3 w-3 shrink-0" />
          {panel.channel_id ? (
            <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">
              {panel.channel_id}
            </code>
          ) : (
            <span>{t("selectMenu_notSent")}</span>
          )}
        </div>

        <Separator />

        {/* Footer: date + actions */}
        <div className="flex items-center justify-between px-4 py-2.5">
          {panel.created_at ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(panel.created_at)}
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              {t("edit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {t("delete")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SelectMenuRoles() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t } = useT();

  // ── State ──
  const [deleteTarget, setDeleteTarget] = useState<SelectRolePanel | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: panels = [], isLoading } = useQuery<SelectRolePanel[]>({
    queryKey: ["select-roles"],
    queryFn: () =>
      apiFetch("/api/welcome/select-roles").then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: (id: number) =>
      apiFetch(`/api/welcome/select-roles/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["select-roles"] });
      setDeleteTarget(null);
      toast({ title: t("selectMenu_deletedPanel") });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: t("selectMenu_deleteErrorPanel"),
        description: e.message,
      }),
  });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ListChecks className="w-6 h-6" />
            {t("smr_title")}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t("selectMenu_desc")}
          </p>
        </div>
        <Button onClick={() => navigate('/select-roles/new')}>
          <Plus className="h-4 w-4 mr-1.5" />
          {t("selectMenu_createPanel")}
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}

      {/* Empty state */}
      {!isLoading && panels.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ListChecks className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium">{t("selectMenu_empty")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("selectMenu_emptyDesc")}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/select-roles/new')}>
              <Plus className="h-4 w-4 mr-1.5" />
              {t("selectMenu_createPanel")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grid of panels */}
      {!isLoading && panels.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {panels.map((panel) => (
            <PanelCard
              key={panel.id}
              panel={panel}
              onEdit={() => navigate('/select-roles/' + panel.id + '/edit')}
              onDelete={() => setDeleteTarget(panel)}
            />
          ))}
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("selectMenu_deleteConfirm")}</DialogTitle>
            <DialogDescription>
              {t("selectMenu_deleteDesc")}
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
