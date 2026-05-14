import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { MultiRoleSelect } from "@/components/RoleSelect";
import {
  Terminal,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  X,
  Type,
  Layout,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

interface ResponseEmbed {
  title: string;
  description: string;
  color: string;
  fields: EmbedField[];
}

interface CustomCommand {
  id: number;
  name: string;
  description: string;
  response_type: "text" | "embed";
  response_text: string;
  response_embed: ResponseEmbed;
  ephemeral: boolean;
  required_roles: string[];
  enabled: boolean;
  created_at: string;
}

interface CommandForm {
  name: string;
  description: string;
  response_type: "text" | "embed";
  response_text: string;
  response_embed: ResponseEmbed;
  ephemeral: boolean;
  required_roles: string[];
  enabled: boolean;
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

const emptyEmbed = (): ResponseEmbed => ({
  title: "",
  description: "",
  color: DEFAULT_COLOR,
  fields: [],
});

const emptyField = (): EmbedField => ({
  name: "",
  value: "",
  inline: false,
});

const emptyForm = (): CommandForm => ({
  name: "",
  description: "",
  response_type: "text",
  response_text: "",
  response_embed: emptyEmbed(),
  ephemeral: false,
  required_roles: [],
  enabled: true,
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

// ─── Command Card ────────────────────────────────────────────────────────────

function CommandCard({
  command,
  onEdit,
  onDelete,
  onToggle,
  togglePending,
}: {
  command: CustomCommand;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  togglePending: boolean;
}) {
  return (
    <Card className="overflow-hidden group transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        {/* Top: name + badges */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge className="bg-indigo-500/15 text-indigo-600 border border-indigo-500/30 shrink-0 text-[11px] font-mono px-2">
              !{command.name}
            </Badge>
            {command.response_type === "text" ? (
              <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
                <Type className="h-3 w-3 mr-0.5" />
                Text
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
                <Layout className="h-3 w-3 mr-0.5" />
                Embed
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={command.enabled}
              onCheckedChange={onToggle}
              disabled={togglePending}
              className="scale-75"
            />
          </div>
        </div>

        {/* Description */}
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground line-clamp-2">
            {command.description || "Không có mô tả"}
          </p>
        </div>

        {/* Response preview */}
        {command.response_type === "embed" && command.response_embed && (
          <div className="mx-4 mb-3 rounded overflow-hidden border border-border/50">
            <div className="flex">
              <div
                className="w-1 shrink-0"
                style={{ backgroundColor: command.response_embed.color || DEFAULT_COLOR }}
              />
              <div className="p-2.5 flex-1 min-w-0 bg-muted/30">
                <p className="font-semibold text-xs leading-tight">
                  {command.response_embed.title || "Tiêu đề"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                  {command.response_embed.description || "Mô tả..."}
                </p>
              </div>
            </div>
          </div>
        )}

        {command.response_type === "text" && command.response_text && (
          <div className="mx-4 mb-3 rounded bg-muted/30 p-2.5 border border-border/50">
            <p className="text-[11px] text-muted-foreground line-clamp-2">
              {command.response_text}
            </p>
          </div>
        )}

        {/* Meta row */}
        <div className="mx-4 mb-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          {command.ephemeral && (
            <span className="flex items-center gap-1">
              Ẩn (Ephemeral)
            </span>
          )}
          {command.required_roles?.length > 0 && (
            <span>{command.required_roles.length} role yêu cầu</span>
          )}
        </div>

        <Separator />

        {/* Footer: date + actions */}
        <div className="flex items-center justify-between px-4 py-2.5">
          {command.created_at ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(command.created_at)}
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

export function CustomCommands() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── State ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<CustomCommand | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomCommand | null>(null);
  const [form, setForm] = useState<CommandForm>(emptyForm());

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: commands = [], isLoading } = useQuery<CustomCommand[]>({
    queryKey: ["custom-commands"],
    queryFn: () =>
      fetch("/api/custom-commands", { credentials: "include" }).then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/custom-commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-commands"] });
      setDialogOpen(false);
      toast({ title: "Đã tạo command thành công" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi tạo command",
        description: e.message,
      }),
  } satisfies UseMutationOptions);

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/custom-commands/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-commands"] });
      setDialogOpen(false);
      setEditingCommand(null);
      toast({ title: "Đã cập nhật command" });
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
      fetch(`/api/custom-commands/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-commands"] });
      setDeleteTarget(null);
      toast({ title: "Đã xóa command" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi xóa command",
        description: e.message,
      }),
  } satisfies UseMutationOptions);

  const toggleMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/custom-commands/${id}/toggle`, {
        method: "PUT",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-commands"] });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi toggle",
        description: e.message,
      }),
  } satisfies UseMutationOptions);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingCommand(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (cmd: CustomCommand) => {
    setEditingCommand(cmd);
    setForm({
      name: cmd.name,
      description: cmd.description ?? "",
      response_type: cmd.response_type ?? "text",
      response_text: cmd.response_text ?? "",
      response_embed: cmd.response_embed
        ? {
            title: cmd.response_embed.title ?? "",
            description: cmd.response_embed.description ?? "",
            color: cmd.response_embed.color ?? DEFAULT_COLOR,
            fields: cmd.response_embed.fields?.map((f) => ({ ...f })) ?? [],
          }
        : emptyEmbed(),
      ephemeral: cmd.ephemeral ?? false,
      required_roles: cmd.required_roles ?? [],
      enabled: cmd.enabled ?? true,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const body = {
      name: form.name,
      description: form.description,
      response_type: form.response_type,
      response_text: form.response_type === "text" ? form.response_text : "",
      response_embed:
        form.response_type === "embed" ? form.response_embed : null,
      ephemeral: form.ephemeral,
      required_roles: form.required_roles,
      enabled: form.enabled,
    };
    if (editingCommand) {
      updateMutation.mutate({ id: editingCommand.id, ...body });
    } else {
      createMutation.mutate(body);
    }
  };

  // ── Embed field helpers ──────────────────────────────────────────────────

  const addField = () => {
    setForm((prev) => ({
      ...prev,
      response_embed: {
        ...prev.response_embed,
        fields: [...prev.response_embed.fields, emptyField()],
      },
    }));
  };

  const removeField = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      response_embed: {
        ...prev.response_embed,
        fields: prev.response_embed.fields.filter((_, i) => i !== idx),
      },
    }));
  };

  const updateField = (idx: number, patch: Partial<EmbedField>) => {
    setForm((prev) => ({
      ...prev,
      response_embed: {
        ...prev.response_embed,
        fields: prev.response_embed.fields.map((f, i) =>
          i === idx ? { ...f, ...patch } : f
        ),
      },
    }));
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Terminal className="w-6 h-6" />
            Custom Commands
          </h2>
          <p className="text-muted-foreground mt-1">
            Tạo command tùy chỉnh từ dashboard
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo Command
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      )}

      {/* Empty state */}
      {!isLoading && commands.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Terminal className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium">Chưa có command nào</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tạo lệnh tùy chỉnh để bot phản hồi tự động.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo Command
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grid of commands */}
      {!isLoading && commands.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {commands.map((cmd) => (
            <CommandCard
              key={cmd.id}
              command={cmd}
              onEdit={() => openEdit(cmd)}
              onDelete={() => setDeleteTarget(cmd)}
              onToggle={() => toggleMutation.mutate(cmd.id)}
              togglePending={toggleMutation.isPending}
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
            setEditingCommand(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCommand ? "Chỉnh sửa Command" : "Tạo Custom Command"}
            </DialogTitle>
            <DialogDescription>
              Tạo lệnh tùy chỉnh để bot phản hồi khi người dùng dùng !&lt;tên&gt;.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label>Tên Command</Label>
              <div className="flex items-center gap-0">
                <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 h-9 text-sm font-mono text-muted-foreground">
                  !
                </span>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      name: e.target.value.replace(/\s/g, "").toLowerCase(),
                    }))
                  }
                  placeholder="tên_command"
                  className="rounded-l-none"
                />
              </div>
              {form.name && (
                <p className="text-xs text-muted-foreground">
                  Preview: <span className="font-mono font-medium">!{form.name}</span>
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Mô tả ngắn về lệnh này"
              />
            </div>

            <Separator />

            {/* Response type toggle */}
            <div className="space-y-2">
              <Label>Loại phản hồi</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, response_type: "text" }))
                  }
                  className={cn(
                    "flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 transition-all text-sm",
                    form.response_type === "text"
                      ? "border-foreground bg-foreground/5"
                      : "border-transparent bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  <Type className="h-4 w-4" />
                  Văn bản
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, response_type: "embed" }))
                  }
                  className={cn(
                    "flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 transition-all text-sm",
                    form.response_type === "embed"
                      ? "border-foreground bg-foreground/5"
                      : "border-transparent bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  <Layout className="h-4 w-4" />
                  Embed
                </button>
              </div>
            </div>

            {/* Text response */}
            {form.response_type === "text" && (
              <div className="space-y-2">
                <Label>Nội dung</Label>
                <Textarea
                  value={form.response_text}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, response_text: e.target.value }))
                  }
                  placeholder="Nội dung bot sẽ gửi khi dùng lệnh..."
                  rows={5}
                />
              </div>
            )}

            {/* Embed response */}
            {form.response_type === "embed" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tiêu đề Embed</Label>
                  <Input
                    value={form.response_embed.title}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        response_embed: {
                          ...p.response_embed,
                          title: e.target.value,
                        },
                      }))
                    }
                    placeholder="Tiêu đề embed"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Mô tả</Label>
                  <Textarea
                    value={form.response_embed.description}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        response_embed: {
                          ...p.response_embed,
                          description: e.target.value,
                        },
                      }))
                    }
                    placeholder="Nội dung embed"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Màu</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              response_embed: { ...p.response_embed, color: c },
                            }))
                          }
                          className={cn(
                            "h-7 w-7 rounded-full border-2 transition-all",
                            form.response_embed.color === c
                              ? "border-foreground scale-110"
                              : "border-transparent hover:scale-105"
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <Input
                      type="color"
                      value={form.response_embed.color}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          response_embed: {
                            ...p.response_embed,
                            color: e.target.value,
                          },
                        }))
                      }
                      className="h-7 w-10 p-0 border-0 cursor-pointer"
                    />
                  </div>
                </div>

                <Separator />

                {/* Fields builder */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Fields</p>
                    <Button variant="outline" size="sm" onClick={addField}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Thêm field
                    </Button>
                  </div>

                  {form.response_embed.fields.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Chưa có field nào. Nhấn "Thêm field" để bắt đầu.
                    </p>
                  )}

                  <div className="space-y-3">
                    {form.response_embed.fields.map((field, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border bg-muted/30 p-3 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            Field #{idx + 1}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => removeField(idx)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Tên</Label>
                            <Input
                              value={field.name}
                              onChange={(e) =>
                                updateField(idx, { name: e.target.value })
                              }
                              placeholder="Tên field"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Giá trị</Label>
                            <Input
                              value={field.value}
                              onChange={(e) =>
                                updateField(idx, { value: e.target.value })
                              }
                              placeholder="Nội dung"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={field.inline}
                            onCheckedChange={(checked) =>
                              updateField(idx, { inline: checked })
                            }
                            className="scale-75"
                          />
                          <Label className="text-xs">Inline</Label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Ephemeral toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Ẩn (Ephemeral)</Label>
                <p className="text-[11px] text-muted-foreground">
                  Chỉ người dùng lệnh mới thấy phản hồi.
                </p>
              </div>
              <Switch
                checked={form.ephemeral}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, ephemeral: checked }))
                }
              />
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Kích hoạt</Label>
                <p className="text-[11px] text-muted-foreground">
                  Bật/tắt command này.
                </p>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, enabled: checked }))
                }
              />
            </div>

            {/* Required roles */}
            <div className="space-y-2">
              <Label>Role yêu cầu</Label>
              <MultiRoleSelect
                value={form.required_roles}
                onChange={(roles) =>
                  setForm((p) => ({ ...p, required_roles: roles }))
                }
                placeholder="Chọn role yêu cầu..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditingCommand(null);
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
            <DialogTitle>Xóa command?</DialogTitle>
            <DialogDescription>
              Command <strong>!{deleteTarget?.name}</strong> sẽ bị xóa vĩnh viễn.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
