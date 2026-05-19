import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGuild } from "@/contexts/GuildContext";
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
import { apiFetch } from "@/hooks/useApi";
import {
  Smile,
  Plus,
  Pencil,
  Trash2,
  Send,
  CheckCircle2,
  Calendar,
  Hash,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/yuri";
import { useT } from "@/i18n";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReactionMapping {
  emoji: string;
  role_id: string;
  label: string;
}

interface ReactionRolePanel {
  id: number;
  name: string;
  channel_id?: string;
  message_id?: string;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  embed_footer: string;
  embed_image_url: string;
  embed_thumbnail_url: string;
  embed_fields: EmbedField[];
  mappings: ReactionMapping[];
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
  onSend,
  sendPending,
}: {
  panel: ReactionRolePanel;
  onEdit: () => void;
  onDelete: () => void;
  onSend: () => void;
  sendPending: boolean;
}) {
  const { t } = useT();
  const isSent = !!panel.message_id;
  const mappings = panel.mappings ?? [];

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
          {isSent ? (
            <Badge className="bg-green-500/15 text-green-600 border border-green-500/30 shrink-0 text-[10px] px-1.5">
              <CheckCircle2 className="h-3 w-3 mr-0.5" />
              {t("reaction_sent")}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-muted-foreground shrink-0 text-[10px] px-1.5"
            >
              {t("reaction_notSent")}
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
                {panel.embed_title || t("reaction_titleFallback")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                {panel.embed_description || t("reaction_descFallback")}
              </p>
            </div>
          </div>
        </div>

        {/* Mapping chips row */}
        <div className="mx-4 mb-3 flex flex-wrap gap-1.5">
          {mappings.map((m, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium"
            >
              {m.emoji && <span>{m.emoji}</span>}
              {m.label || t("reaction_roleFallback")}
            </span>
          ))}
          {mappings.length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              {t("reaction_zeroMapping")}
            </span>
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
            {mappings.length} {t("reaction_mappingCount")}
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
            <span>{t("reaction_noChannel")}</span>
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
              onClick={onSend}
              disabled={sendPending}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              {sendPending ? t("reaction_sending") : t("reaction_send")}
            </Button>
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

export function ReactionRoles() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t } = useT();
  const { selectedGuildId } = useGuild();

  // ── State ──
  const [deleteTarget, setDeleteTarget] = useState<ReactionRolePanel | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: panels = [], isLoading } = useQuery<ReactionRolePanel[]>({
    queryKey: ["reaction-roles", selectedGuildId],
    queryFn: () =>
      apiFetch("/api/reaction-roles").then((r) =>
        r.json()
      ),
    staleTime: 60_000,
    enabled: !!selectedGuildId,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: (id: number) =>
      apiFetch(`/api/reaction-roles/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reaction-roles", selectedGuildId] });
      setDeleteTarget(null);
      toast({ title: t("reaction_deletedPanel") });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: t("reaction_deleteErrorPanel"),
        description: e.message,
      }),
  });

  const sendMutation = useMutation<any, Error, number>({
    mutationFn: (id: number) =>
      apiFetch(`/api/reaction-roles/${id}/send`, {
        method: "POST",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reaction-roles", selectedGuildId] });
      toast({ title: t("reaction_panelSent") });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: t("reaction_sendError"),
        description: e.message,
      }),
  });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <PageContainer size="md">
      <PageHeader title={t("rr_title")} description={t("reaction_desc")} icon={Smile}>
        <Button onClick={() => navigate('/reaction-roles/new')}>
          <Plus className="h-4 w-4 mr-1.5" />
          {t("reaction_createPanel")}
        </Button>
      </PageHeader>

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}

      {/* Empty state */}
      {!isLoading && panels.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Smile className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium">{t("reaction_empty")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("reaction_desc")}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/reaction-roles/new')}>
              <Plus className="h-4 w-4 mr-1.5" />
              {t("reaction_createPanel")}
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
              onEdit={() => navigate('/reaction-roles/' + panel.id + '/edit')}
              onDelete={() => setDeleteTarget(panel)}
              onSend={() => sendMutation.mutate(panel.id)}
              sendPending={sendMutation.isPending}
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
            <DialogTitle>{t("reaction_deleteConfirm")}</DialogTitle>
            <DialogDescription>
              {t("reaction_deleteDesc")}
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
    </PageContainer>
  );
}
