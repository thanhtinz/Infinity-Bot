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
  MousePointerClick,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Calendar,
  Hash,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ButtonRoleItem {
  label: string;
  emoji: string;
  role_id: string;
  style: string;
  row: number;
}

interface ButtonRolePanel {
  id: number;
  name: string;
  buttons: ButtonRoleItem[];
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

const BUTTON_STYLES = [
  { key: "primary", label: "Primary", bg: "#5865F2", text: "#ffffff" },
  { key: "secondary", label: "Secondary", bg: "#4e5058", text: "#ffffff" },
  { key: "success", label: "Success", bg: "#57f287", text: "#000000" },
  { key: "danger", label: "Danger", bg: "#ed4245", text: "#ffffff" },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(s?: string) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getButtonStyle(key: string) {
  return BUTTON_STYLES.find((s) => s.key === key) ?? BUTTON_STYLES[0];
}

// ─── Panel Card ──────────────────────────────────────────────────────────────

function PanelCard({
  panel,
  onEdit,
  onDelete,
}: {
  panel: ButtonRolePanel;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isDeployed = !!panel.message_id;
  const btns = panel.buttons ?? [];

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
              Đã triển khai
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-muted-foreground shrink-0 text-[10px] px-1.5"
            >
              Chưa triển khai
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
                {panel.embed_title || "Tiêu đề"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                {panel.embed_description || "Mô tả..."}
              </p>
            </div>
          </div>
        </div>

        {/* Button chips row */}
        <div className="mx-4 mb-3 flex flex-wrap gap-1.5">
          {btns.map((btn, idx) => {
            const s = getButtonStyle(btn.style);
            return (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium"
                style={{ backgroundColor: s.bg, color: s.text }}
              >
                {btn.emoji && <span>{btn.emoji}</span>}
                {btn.label || "Nút"}
              </span>
            );
          })}
          {btns.length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              0 buttons
            </span>
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
            {btns.length} nút
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
            <span>Chưa gửi</span>
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
              Sửa
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Xóa
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ButtonRoles() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // ── State ──
  const [deleteTarget, setDeleteTarget] = useState<ButtonRolePanel | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: panels = [], isLoading } = useQuery<ButtonRolePanel[]>({
    queryKey: ["button-roles"],
    queryFn: () =>
      fetch("/api/welcome/button-roles", { credentials: "include" }).then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: (id: number) =>
      fetch(`/api/welcome/button-roles/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["button-roles"] });
      setDeleteTarget(null);
      toast({ title: "Đã xóa panel" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi xóa panel",
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
            <MousePointerClick className="w-6 h-6" />
            Button Roles
          </h2>
          <p className="text-muted-foreground mt-1">
            Tạo panel với các nút để thành viên tự chọn role.
          </p>
        </div>
        <Button onClick={() => navigate('/button-roles/new')}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo Panel
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading...</p>
      )}

      {/* Empty state */}
      {!isLoading && panels.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MousePointerClick className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium">Chưa có panel nào</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tạo panel button role để thành viên tự chọn role.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/button-roles/new')}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo Panel
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
              onEdit={() => navigate('/button-roles/' + panel.id + '/edit')}
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
            <DialogTitle>Xóa panel?</DialogTitle>
            <DialogDescription>
              Panel <strong>{deleteTarget?.name}</strong> sẽ bị xóa vĩnh viễn.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
