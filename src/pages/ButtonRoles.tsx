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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { RoleSelect } from "@/components/RoleSelect";
import {
  MousePointerClick,
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
  created_at: string;
}

interface PanelForm {
  name: string;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  buttons: ButtonRoleItem[];
}

interface ButtonForm {
  label: string;
  emoji: string;
  role_id: string;
  style: string;
  row: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BUTTON_STYLES = [
  { key: "primary", label: "Primary", bg: "#5865F2", text: "#ffffff" },
  { key: "secondary", label: "Secondary", bg: "#4e5058", text: "#ffffff" },
  { key: "success", label: "Success", bg: "#57f287", text: "#000000" },
  { key: "danger", label: "Danger", bg: "#ed4245", text: "#ffffff" },
] as const;

const STYLE_RING: Record<string, string> = {
  primary: "ring-[#5865F2]",
  secondary: "ring-[#4e5058]",
  success: "ring-[#57f287]",
  danger: "ring-[#ed4245]",
};

const STYLE_CHECK: Record<string, string> = {
  primary: "text-[#5865F2]",
  secondary: "text-[#4e5058]",
  success: "text-[#57f287]",
  danger: "text-[#ed4245]",
};

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
  embed_title: "",
  embed_description: "",
  embed_color: DEFAULT_COLOR,
  buttons: [],
});

const emptyButtonForm = (): ButtonForm => ({
  label: "",
  emoji: "",
  role_id: "",
  style: "primary",
  row: 0,
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

function getButtonStyle(key: string) {
  return BUTTON_STYLES.find((s) => s.key === key) ?? BUTTON_STYLES[0];
}

// ─── Button Style Picker ─────────────────────────────────────────────────────

function ButtonStylePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {BUTTON_STYLES.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onChange(s.key)}
          className={cn(
            "relative flex items-center gap-2 rounded-lg border-2 p-3 transition-all",
            value === s.key
              ? cn(
                  "border-foreground",
                  STYLE_RING[s.key],
                  "ring-2 ring-offset-1 ring-offset-background"
                )
              : "border-transparent bg-muted/30 hover:bg-muted/50"
          )}
        >
          <div
            className="h-5 w-5 rounded-full shrink-0"
            style={{ backgroundColor: s.bg }}
          />
          <div className="text-left">
            <p className="text-xs font-medium">{s.label}</p>
          </div>
          {value === s.key && (
            <div className="absolute top-1.5 right-1.5">
              <CheckCircle2 className={cn("h-4 w-4", STYLE_CHECK[s.key])} />
            </div>
          )}
        </button>
      ))}
    </div>
  );
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

  // ── State ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<ButtonRolePanel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ButtonRolePanel | null>(null);
  const [form, setForm] = useState<PanelForm>(emptyPanelForm());

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

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/welcome/button-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["button-roles"] });
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
      fetch(`/api/welcome/button-roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["button-roles"] });
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
  } satisfies UseMutationOptions);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingPanel(null);
    setForm(emptyPanelForm());
    setDialogOpen(true);
  };

  const openEdit = (panel: ButtonRolePanel) => {
    setEditingPanel(panel);
    setForm({
      name: panel.name,
      embed_title: panel.embed_title ?? "",
      embed_description: panel.embed_description ?? "",
      embed_color: panel.embed_color ?? DEFAULT_COLOR,
      buttons: panel.buttons?.map((b) => ({ ...b })) ?? [],
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const body = {
      name: form.name,
      embed_title: form.embed_title,
      embed_description: form.embed_description,
      embed_color: form.embed_color,
      buttons: form.buttons,
    };
    if (editingPanel) {
      updateMutation.mutate({ id: editingPanel.id, ...body });
    } else {
      createMutation.mutate(body);
    }
  };

  // ── Button form helpers ──────────────────────────────────────────────────

  const addButton = () => {
    setForm((prev) => ({
      ...prev,
      buttons: [...prev.buttons, emptyButtonForm()],
    }));
  };

  const removeButton = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== idx),
    }));
  };

  const updateButton = (idx: number, patch: Partial<ButtonForm>) => {
    setForm((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    }));
  };

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
            <MousePointerClick className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium">Chưa có panel nào</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tạo panel button role để thành viên tự chọn role.
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
              {editingPanel ? "Chỉnh sửa Panel" : "Tạo Panel Button Role"}
            </DialogTitle>
            <DialogDescription>
              Tạo panel với các nút để thành viên tự chọn role khi nhấn.
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

            <Separator />

            {/* Embed settings */}
            <div className="space-y-4">
              <p className="text-sm font-medium">Cài đặt Embed</p>

              <div className="space-y-2">
                <Label>Tiêu đề embed</Label>
                <Input
                  value={form.embed_title}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, embed_title: e.target.value }))
                  }
                  placeholder="VD: Chọn role bạn muốn"
                />
              </div>

              <div className="space-y-2">
                <Label>Mô tả embed</Label>
                <Textarea
                  value={form.embed_description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, embed_description: e.target.value }))
                  }
                  placeholder="Nhấn nút bên dưới để nhận hoặc bỏ role."
                  rows={3}
                />
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

            {/* Buttons builder */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Nút Role</p>
                <Button variant="outline" size="sm" onClick={addButton}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Thêm nút
                </Button>
              </div>

              {form.buttons.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Chưa có nút nào. Nhấn "Thêm nút" để bắt đầu.
                </p>
              )}

              <div className="space-y-3">
                {form.buttons.map((btn, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border bg-muted/30 p-3 space-y-3"
                  >
                    {/* Button header */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Nút #{idx + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeButton(idx)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Label + Emoji */}
                    <div className="grid grid-cols-[1fr_80px] gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Nhãn</Label>
                        <Input
                          value={btn.label}
                          onChange={(e) =>
                            updateButton(idx, { label: e.target.value })
                          }
                          placeholder="VD: Đỏ"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Emoji</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            value={btn.emoji}
                            onChange={(e) =>
                              updateButton(idx, { emoji: e.target.value })
                            }
                            placeholder="🔴"
                            className="h-8 text-sm"
                          />
                          <EmojiPicker onSelect={(emoji) => updateButton(idx, { emoji })} />
                        </div>
                      </div>
                    </div>

                    {/* Role */}
                    <div className="space-y-1">
                      <Label className="text-xs">Role</Label>
                      <RoleSelect
                        value={btn.role_id}
                        onChange={(v) => updateButton(idx, { role_id: v })}
                      />
                    </div>

                    {/* Style + Row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Kiểu nút</Label>
                        <Select
                          value={btn.style}
                          onValueChange={(v) => updateButton(idx, { style: v })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BUTTON_STYLES.map((s) => (
                              <SelectItem key={s.key} value={s.key}>
                                <span className="flex items-center gap-2">
                                  <span
                                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: s.bg }}
                                  />
                                  {s.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hàng</Label>
                        <Select
                          value={String(btn.row)}
                          onValueChange={(v) =>
                            updateButton(idx, { row: Number(v) })
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2, 3, 4].map((r) => (
                              <SelectItem key={r} value={String(r)}>
                                Hàng {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
