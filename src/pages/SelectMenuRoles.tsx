import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { RoleSelect } from "@/components/RoleSelect";
import {
  ListChecks,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Calendar,
  Hash,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/EmojiPicker";

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
  created_at: string;
}

interface PanelForm {
  name: string;
  placeholder: string;
  min_values: number;
  max_values: number;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  options: SelectMenuOption[];
}

interface OptionForm {
  label: string;
  emoji: string;
  role_id: string;
  description: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#5865F2",
  "#57f287",
  "#fee75c",
  "#ed4245",
  "#eb459e",
  "#2b2d31",
];

const DEFAULT_COLOR = "#5865F2";

const emptyPanelForm = (): PanelForm => ({
  name: "",
  placeholder: "Chọn role...",
  min_values: 1,
  max_values: 1,
  embed_title: "",
  embed_description: "",
  embed_color: DEFAULT_COLOR,
  options: [],
});

const emptyOptionForm = (): OptionForm => ({
  label: "",
  emoji: "",
  role_id: "",
  description: "",
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
}: {
  panel: SelectRolePanel;
  onEdit: () => void;
  onDelete: () => void;
}) {
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
              style={{ backgroundColor: panel.embed_color || DEFAULT_COLOR }}
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

        {/* Option chips row */}
        <div className="mx-4 mb-3 flex flex-wrap gap-1.5">
          {opts.map((opt, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium bg-[#5865F2] text-white"
            >
              {opt.emoji && <span>{opt.emoji}</span>}
              {opt.label || "Option"}
            </span>
          ))}
          {opts.length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              0 options
            </span>
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
            {opts.length} lựa chọn
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

export function SelectMenuRoles() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── State ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<SelectRolePanel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SelectRolePanel | null>(null);
  const [form, setForm] = useState<PanelForm>(emptyPanelForm());

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: panels = [], isLoading } = useQuery<SelectRolePanel[]>({
    queryKey: ["select-roles"],
    queryFn: () =>
      fetch("/api/welcome/select-roles", { credentials: "include" }).then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/welcome/select-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["select-roles"] });
      setDialogOpen(false);
      toast({ title: "Đã tạo panel thành công" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi tạo panel",
        description: e.message,
      }),
  } satisfies UseMutationOptions);

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/welcome/select-roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["select-roles"] });
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
  } satisfies UseMutationOptions);

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/welcome/select-roles/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["select-roles"] });
      setDeleteTarget(null);
      toast({ title: "Đã xóa panel" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi xóa panel",
        description: e.message,
      }),
  } satisfies UseMutationOptions);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingPanel(null);
    setForm(emptyPanelForm());
    setDialogOpen(true);
  };

  const openEdit = (panel: SelectRolePanel) => {
    setEditingPanel(panel);
    setForm({
      name: panel.name,
      placeholder: panel.placeholder ?? "Chọn role...",
      min_values: panel.min_values ?? 1,
      max_values: panel.max_values ?? 1,
      embed_title: panel.embed_title ?? "",
      embed_description: panel.embed_description ?? "",
      embed_color: panel.embed_color ?? DEFAULT_COLOR,
      options: panel.options?.map((o) => ({ ...o })) ?? [],
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const body = {
      name: form.name,
      placeholder: form.placeholder,
      min_values: form.min_values,
      max_values: form.max_values,
      embed_title: form.embed_title,
      embed_description: form.embed_description,
      embed_color: form.embed_color,
      options: form.options,
    };
    if (editingPanel) {
      updateMutation.mutate({ id: editingPanel.id, ...body });
    } else {
      createMutation.mutate(body);
    }
  };

  // ── Option form helpers ──────────────────────────────────────────────────

  const addOption = () => {
    setForm((prev) => ({
      ...prev,
      options: [...prev.options, emptyOptionForm()],
    }));
  };

  const removeOption = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== idx),
    }));
  };

  const updateOption = (idx: number, patch: Partial<OptionForm>) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    }));
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ListChecks className="w-6 h-6" />
            Select Menu Roles
          </h2>
          <p className="text-muted-foreground mt-1">
            Tạo panel dropdown để thành viên chọn role từ menu.
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
            <ListChecks className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium">Chưa có panel nào</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tạo panel select menu role để thành viên tự chọn role từ dropdown.
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
              {editingPanel ? "Chỉnh sửa Panel" : "Tạo Panel Select Menu Role"}
            </DialogTitle>
            <DialogDescription>
              Tạo panel dropdown để thành viên tự chọn role từ menu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label>Tên panel</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="VD: Chọn màu sắc"
              />
            </div>

            {/* Placeholder */}
            <div className="space-y-2">
              <Label>Placeholder</Label>
              <Input
                value={form.placeholder}
                onChange={(e) => setForm((p) => ({ ...p, placeholder: e.target.value }))}
                placeholder="VD: Chọn role bạn muốn..."
              />
            </div>

            {/* Min / Max values */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Giá trị tối thiểu</Label>
                <Input
                  type="number"
                  min={0}
                  max={25}
                  value={form.min_values}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, min_values: Number(e.target.value) }))
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label>Giá trị tối đa</Label>
                <Input
                  type="number"
                  min={1}
                  max={25}
                  value={form.max_values}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, max_values: Number(e.target.value) }))
                  }
                  className="h-9"
                />
              </div>
            </div>

            <Separator />

            {/* Embed settings */}
            <div className="space-y-4">
              <p className="text-sm font-medium">Cài đặt Embed</p>

              <div className="space-y-2">
                <Label>Tiêu đề embed</Label>
                <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                  <Input
                    value={form.embed_title}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, embed_title: e.target.value }))
                    }
                    placeholder="VD: Chọn role bạn muốn"
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <EmojiPicker onSelect={(em) => setForm((p) => ({ ...p, embed_title: p.embed_title + em }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mô tả embed</Label>
                <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                  <Textarea
                    value={form.embed_description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, embed_description: e.target.value }))
                    }
                    placeholder="Chọn role từ menu dropdown bên dưới."
                    rows={3}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                  />
                  <EmojiPicker onSelect={(em) => setForm((p) => ({ ...p, embed_description: p.embed_description + em }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Màu embed</Label>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, embed_color: c }))}
                        className={cn(
                          "h-7 w-7 rounded-full border-2 transition-all",
                          form.embed_color === c
                            ? "border-foreground scale-110"
                            : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <Input
                    type="color"
                    value={form.embed_color}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, embed_color: e.target.value }))
                    }
                    className="h-7 w-10 p-0 border-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Options builder */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Lựa chọn Menu</p>
                <Button variant="outline" size="sm" onClick={addOption}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Thêm lựa chọn
                </Button>
              </div>

              {form.options.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Chưa có lựa chọn nào. Nhấn "Thêm lựa chọn" để bắt đầu.
                </p>
              )}

              <div className="space-y-3">
                {form.options.map((opt, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border bg-muted/30 p-3 space-y-3"
                  >
                    {/* Option header */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Lựa chọn #{idx + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeOption(idx)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Label + Emoji */}
                    <div className="grid grid-cols-[1fr_80px] gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Nhãn</Label>
                        <Input
                          value={opt.label}
                          onChange={(e) =>
                            updateOption(idx, { label: e.target.value })
                          }
                          placeholder="VD: Đỏ"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Emoji</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            value={opt.emoji}
                            onChange={(e) =>
                              updateOption(idx, { emoji: e.target.value })
                            }
                            placeholder="🔴"
                            className="h-8 text-sm"
                          />
                          <EmojiPicker onSelect={(emoji) => updateOption(idx, { emoji })} />
                        </div>
                      </div>
                    </div>

                    {/* Role */}
                    <div className="space-y-1">
                      <Label className="text-xs">Role</Label>
                      <RoleSelect
                        value={opt.role_id}
                        onChange={(v) => updateOption(idx, { role_id: v })}
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                      <Label className="text-xs">Mô tả</Label>
                      <Input
                        value={opt.description}
                        onChange={(e) =>
                          updateOption(idx, { description: e.target.value })
                        }
                        placeholder="Mô tả ngắn cho lựa chọn này"
                        className="h-8 text-sm"
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
