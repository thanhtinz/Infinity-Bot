import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ChannelSelect } from "@/components/ChannelSelect";
import { RoleSelect } from "@/components/RoleSelect";
import { EmbedBuilder, EMBED_DEFAULTS } from "@/components/EmbedBuilder";
import type { EmbedFormData, EmbedField } from "@/components/EmbedBuilder";
import {
  Smile,
  Plus,
  Pencil,
  Trash2,
  Send,
  CheckCircle2,
  Calendar,
  Hash,
  X,
} from "lucide-react";
import { EmojiPicker } from "@/components/EmojiPicker";

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

interface PanelForm {
  name: string;
  channel_id: string;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  embed_footer: string;
  embed_image_url: string;
  embed_thumbnail_url: string;
  embed_fields: EmbedField[];
  mappings: ReactionMapping[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const emptyPanelForm = (): PanelForm => ({
  name: "",
  channel_id: "",
  embed_title: "",
  embed_description: "",
  embed_color: EMBED_DEFAULTS.color,
  embed_footer: "",
  embed_image_url: "",
  embed_thumbnail_url: "",
  embed_fields: [],
  mappings: [],
});

const emptyMapping = (): ReactionMapping => ({
  emoji: "",
  role_id: "",
  label: "",
});

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
              Đã gửi
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-muted-foreground shrink-0 text-[10px] px-1.5"
            >
              Chưa gửi
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

        {/* Mapping chips row */}
        <div className="mx-4 mb-3 flex flex-wrap gap-1.5">
          {mappings.map((m, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium"
            >
              {m.emoji && <span>{m.emoji}</span>}
              {m.label || "Role"}
            </span>
          ))}
          {mappings.length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              0 mapping
            </span>
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
            {mappings.length} mapping
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
            <span>Chưa chọn kênh</span>
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
              {sendPending ? "Đang gửi..." : "Gửi"}
            </Button>
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

export function ReactionRoles() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── State ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<ReactionRolePanel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReactionRolePanel | null>(null);
  const [form, setForm] = useState<PanelForm>(emptyPanelForm());

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: panels = [], isLoading } = useQuery<ReactionRolePanel[]>({
    queryKey: ["reaction-roles"],
    queryFn: () =>
      fetch("/api/reaction-roles", { credentials: "include" }).then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation<any, Error, Record<string, unknown>>({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/reaction-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reaction-roles"] });
      setDialogOpen(false);
      toast({ title: "Đã tạo panel thành công" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi tạo panel",
        description: e.message,
      }),
  });

  const updateMutation = useMutation<any, Error, { id: number } & Record<string, unknown>>({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/reaction-roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reaction-roles"] });
      setDialogOpen(false);
      setEditingPanel(null);
      toast({ title: "Đã cập nhật panel" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật",
        description: e.message,
      }),
  });

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: (id: number) =>
      fetch(`/api/reaction-roles/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reaction-roles"] });
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

  const sendMutation = useMutation<any, Error, number>({
    mutationFn: (id: number) =>
      fetch(`/api/reaction-roles/${id}/send`, {
        method: "POST",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reaction-roles"] });
      toast({ title: "Đã gửi panel lên Discord" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi gửi panel",
        description: e.message,
      }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingPanel(null);
    setForm(emptyPanelForm());
    setDialogOpen(true);
  };

  const openEdit = (panel: ReactionRolePanel) => {
    setEditingPanel(panel);
    setForm({
      name: panel.name,
      channel_id: panel.channel_id ?? "",
      embed_title: panel.embed_title ?? "",
      embed_description: panel.embed_description ?? "",
      embed_color: panel.embed_color ?? EMBED_DEFAULTS.color,
      embed_footer: panel.embed_footer ?? "",
      embed_image_url: panel.embed_image_url ?? "",
      embed_thumbnail_url: panel.embed_thumbnail_url ?? "",
      embed_fields: panel.embed_fields ?? [],
      mappings: panel.mappings?.map((m) => ({ ...m })) ?? [],
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const body = {
      name: form.name,
      channel_id: form.channel_id,
      embed_title: form.embed_title,
      embed_description: form.embed_description,
      embed_color: form.embed_color,
      embed_footer: form.embed_footer,
      embed_image_url: form.embed_image_url,
      embed_thumbnail_url: form.embed_thumbnail_url,
      embed_fields: form.embed_fields,
      mappings: form.mappings,
    };
    if (editingPanel) {
      updateMutation.mutate({ id: editingPanel.id, ...body });
    } else {
      createMutation.mutate(body);
    }
  };

  // ── Mapping form helpers ──────────────────────────────────────────────────

  const addMapping = () => {
    setForm((prev) => ({
      ...prev,
      mappings: [...prev.mappings, emptyMapping()],
    }));
  };

  const removeMapping = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      mappings: prev.mappings.filter((_, i) => i !== idx),
    }));
  };

  const updateMapping = (idx: number, patch: Partial<ReactionMapping>) => {
    setForm((prev) => ({
      ...prev,
      mappings: prev.mappings.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    }));
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Smile className="w-6 h-6" />
            Reaction Roles
          </h2>
          <p className="text-muted-foreground mt-1">
            Tạo panel reaction role để thành viên tự nhận role bằng emoji.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo Panel
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      )}

      {/* Empty state */}
      {!isLoading && panels.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Smile className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium">Chưa có panel nào</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tạo panel reaction role để thành viên tự nhận role bằng emoji.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
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
              onEdit={() => openEdit(panel)}
              onDelete={() => setDeleteTarget(panel)}
              onSend={() => sendMutation.mutate(panel.id)}
              sendPending={sendMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            setEditingPanel(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPanel ? "Chỉnh sửa Panel" : "Tạo Panel Reaction Role"}
            </DialogTitle>
            <DialogDescription>
              Tạo panel reaction role để thành viên tự nhận role khi thả emoji.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label>Tên Panel</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="VD: Chọn màu sắc"
              />
            </div>

            {/* Channel */}
            <div className="space-y-2">
              <Label>Kênh</Label>
              <ChannelSelect
                value={form.channel_id}
                onChange={(v) => setForm((p) => ({ ...p, channel_id: v }))}
                placeholder="Chọn kênh gửi panel"
                filter="text"
              />
            </div>

            <Separator />

            {/* Embed settings */}
            <div className="space-y-4">
              <p className="text-sm font-medium">Cài đặt Embed</p>
              <EmbedBuilder
                data={{
                  title: form.embed_title,
                  description: form.embed_description,
                  color: form.embed_color,
                  footer: form.embed_footer,
                  image_url: form.embed_image_url,
                  thumbnail_url: form.embed_thumbnail_url,
                  fields: form.embed_fields,
                }}
                onChange={(ed: EmbedFormData) => {
                  setForm((p) => ({
                    ...p,
                    embed_title: ed.title,
                    embed_description: ed.description,
                    embed_color: ed.color,
                    embed_footer: ed.footer,
                    embed_image_url: ed.image_url,
                    embed_thumbnail_url: ed.thumbnail_url,
                    embed_fields: ed.fields,
                  }));
                }}
                compact
              />
            </div>

            <Separator />

            {/* Mappings builder */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Emoji → Role</p>
                <Button variant="outline" size="sm" onClick={addMapping}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Thêm
                </Button>
              </div>

              {form.mappings.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Chưa có mapping nào. Nhấn "Thêm" để bắt đầu.
                </p>
              )}

              <div className="space-y-3">
                {form.mappings.map((mapping, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border bg-muted/30 p-3 space-y-3"
                  >
                    {/* Mapping header */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Mapping #{idx + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeMapping(idx)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Emoji + Label */}
                    <div className="grid grid-cols-[80px_1fr] gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Emoji</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            value={mapping.emoji}
                            onChange={(e) =>
                              updateMapping(idx, { emoji: e.target.value })
                            }
                            placeholder="🔴"
                            className="h-8 text-sm"
                          />
                          <EmojiPicker
                            onSelect={(emoji) => updateMapping(idx, { emoji })}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Nhãn</Label>
                        <Input
                          value={mapping.label}
                          onChange={(e) =>
                            updateMapping(idx, { label: e.target.value })
                          }
                          placeholder="VD: Đỏ"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    {/* Role */}
                    <div className="space-y-1">
                      <Label className="text-xs">Role</Label>
                      <RoleSelect
                        value={mapping.role_id}
                        onChange={(v) => updateMapping(idx, { role_id: v })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditingPanel(null);
              }}
            >
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Đang lưu..."
                : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
