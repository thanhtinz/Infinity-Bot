import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ChannelSelect } from "@/components/ChannelSelect";
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Repeat,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

interface EmbedData {
  title: string;
  description: string;
  color: string;
  footer: string;
  image_url: string;
  thumbnail_url: string;
  fields: EmbedField[];
}

interface ScheduledMessage {
  id: number;
  channel_id: string;
  content: string;
  embed_data: EmbedData | null;
  send_at: string;
  repeat_type: "none" | "hourly" | "daily" | "weekly" | "monthly";
  sent: boolean;
  last_sent_at: string | null;
  enabled: boolean;
  created_by: string;
  created_at: string;
}

interface FormState {
  channel_id: string;
  content: string;
  add_embed: boolean;
  embed_data: EmbedData;
  send_at: string;
  repeat_type: "none" | "hourly" | "daily" | "weekly" | "monthly";
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

const emptyEmbed = (): EmbedData => ({
  title: "",
  description: "",
  color: DEFAULT_COLOR,
  footer: "",
  image_url: "",
  thumbnail_url: "",
  fields: [],
});

const emptyForm = (): FormState => ({
  channel_id: "",
  content: "",
  add_embed: false,
  embed_data: emptyEmbed(),
  send_at: "",
  repeat_type: "none",
  enabled: true,
});

const REPEAT_LABELS: Record<ScheduledMessage["repeat_type"], string> = {
  none: "Không lặp",
  hourly: "Mỗi giờ",
  daily: "Mỗi ngày",
  weekly: "Mỗi tuần",
  monthly: "Mỗi tháng",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDatetimeLocal(s: string) {
  if (!s) return "";
  const d = new Date(s);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function truncate(s?: string | null, len = 80) {
  if (!s) return "";
  return s.length > len ? s.slice(0, len) + "…" : s;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ScheduledMessages() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledMessage | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: messages = [], isLoading } = useQuery<ScheduledMessage[]>({
    queryKey: ["scheduled-messages"],
    queryFn: () =>
      fetch("/api/scheduled-messages", { credentials: "include" }).then((r) =>
        r.json()
      ),
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: Partial<FormState>) =>
      fetch("/api/scheduled-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
      setDialogOpen(false);
      toast({ title: "Đã tạo lịch gửi tin nhắn." });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Partial<FormState>) =>
      fetch(`/api/scheduled-messages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
      setDialogOpen(false);
      toast({ title: "Đã cập nhật lịch gửi." });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/scheduled-messages/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
      setConfirmDeleteId(null);
      toast({ title: "Đã xóa lịch gửi." });
    },
    onError: () =>
      toast({ variant: "destructive", title: "Lỗi khi xóa lịch gửi." }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      fetch(`/api/scheduled-messages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: ["scheduled-messages"] });
      const prev = qc.getQueryData<ScheduledMessage[]>(["scheduled-messages"]);
      qc.setQueryData<ScheduledMessage[]>(["scheduled-messages"], (old) =>
        old?.map((m) => (m.id === id ? { ...m, enabled } : m))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["scheduled-messages"], ctx.prev);
      toast({ variant: "destructive", title: "Lỗi khi chuyển trạng thái." });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
    },
  });

  // ── Dialog helpers ───────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (m: ScheduledMessage) => {
    setEditing(m);
    setForm({
      channel_id: m.channel_id,
      content: m.content ?? "",
      add_embed: !!m.embed_data,
      embed_data: m.embed_data ?? emptyEmbed(),
      send_at: toDatetimeLocal(m.send_at),
      repeat_type: m.repeat_type,
      enabled: m.enabled,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const body: Record<string, unknown> = {
      channel_id: form.channel_id,
      content: form.content,
      embed_data: form.add_embed ? form.embed_data : null,
      send_at: form.send_at,
      repeat_type: form.repeat_type,
      enabled: form.enabled,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, ...body });
    } else {
      createMutation.mutate(body);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-2xl font-bold leading-none">
              Scheduled Messages
            </h2>
            <p className="text-sm text-muted-foreground">
              Hẹn giờ gửi tin nhắn / embed
            </p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Tạo lịch
        </Button>
      </div>

      {/* Message list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-6 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-6 w-16 animate-pulse rounded bg-muted" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Clock className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">
              Chưa có lịch gửi nào. Nhấn Tạo lịch để bắt đầu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => {
            const preview = m.embed_data
              ? truncate(m.embed_data.title, 80)
              : truncate(m.content, 80);

            return (
              <Card
                key={m.id}
                className={cn(
                  "transition-colors cursor-pointer hover:border-primary/30",
                  !m.enabled && "opacity-60"
                )}
                onClick={() => openEdit(m)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left + Middle */}
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      {/* Channel badge */}
                      <Badge
                        variant="secondary"
                        className="w-fit gap-1 font-mono text-xs"
                      >
                        <Hash className="h-3 w-3" />
                        {m.channel_id}
                      </Badge>

                      {/* Sent status */}
                      {m.sent ? (
                        <Badge className="bg-green-500/15 text-green-600 border-green-500/30 gap-1 text-xs">
                          <CheckCircle className="h-3 w-3" />
                          Đã gửi
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30 gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          Chờ gửi
                        </Badge>
                      )}

                      {/* Repeat badge */}
                      {m.repeat_type !== "none" && (
                        <Badge
                          variant="outline"
                          className="w-fit gap-1 text-xs"
                        >
                          <Repeat className="h-3 w-3" />
                          {REPEAT_LABELS[m.repeat_type]}
                        </Badge>
                      )}

                      {/* Embed badge */}
                      {m.embed_data && (
                        <Badge variant="default" className="w-fit text-xs">
                          Embed
                        </Badge>
                      )}

                      {/* Preview */}
                      <span className="truncate text-sm text-muted-foreground">
                        {preview || "(trống)"}
                      </span>
                    </div>

                    {/* Right info + actions */}
                    <div className="flex items-center gap-3">
                      {/* Info */}
                      <div className="hidden flex-col gap-0.5 text-xs text-muted-foreground md:flex">
                        <span>Gửi lúc: {formatDate(m.send_at)}</span>
                        {m.last_sent_at && (
                          <span>Lần cuối: {formatDate(m.last_sent_at)}</span>
                        )}
                      </div>

                      {/* Mobile info */}
                      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground md:hidden">
                        <span>{formatDate(m.send_at)}</span>
                      </div>

                      <Separator
                        orientation="vertical"
                        className="mx-1 h-8"
                      />

                      {/* Enabled toggle */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMutation.mutate({
                            id: m.id,
                            enabled: !m.enabled,
                          });
                        }}
                        disabled={toggleMutation.isPending}
                        title={m.enabled ? "Tắt" : "Bật"}
                      >
                        {m.enabled ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>

                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(m);
                        }}
                        title="Chỉnh sửa"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {/* Delete */}
                      {confirmDeleteId === m.id ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(m.id);
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          Xác nhận?
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(m.id);
                          }}
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Chỉnh sửa lịch gửi" : "Tạo lịch gửi"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Channel select */}
            <div className="space-y-2">
              <Label>Channel</Label>
              <ChannelSelect
                filter="text"
                value={form.channel_id}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    channel_id: v === "__clear__" ? "" : v,
                  }))
                }
                placeholder="Chọn channel..."
              />
            </div>

            {/* Message content */}
            <div className="space-y-2">
              <Label>Nội dung tin nhắn</Label>
              <Textarea
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
                placeholder="Nội dung tin nhắn sẽ gửi..."
                rows={4}
              />
            </div>

            {/* Add embed checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="add-embed"
                checked={form.add_embed}
                onCheckedChange={(checked) =>
                  setForm((f) => ({
                    ...f,
                    add_embed: !!checked,
                    embed_data: checked ? f.embed_data : emptyEmbed(),
                  }))
                }
              />
              <Label htmlFor="add-embed" className="cursor-pointer">
                Thêm Embed
              </Label>
            </div>

            {/* Embed fields */}
            {form.add_embed && (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Cấu hình Embed</p>

                <div className="space-y-2">
                  <Label>Tiêu đề</Label>
                  <Input
                    value={form.embed_data.title}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        embed_data: { ...f.embed_data, title: e.target.value },
                      }))
                    }
                    placeholder="Tiêu đề embed"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Mô tả</Label>
                  <Textarea
                    value={form.embed_data.description}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        embed_data: {
                          ...f.embed_data,
                          description: e.target.value,
                        },
                      }))
                    }
                    placeholder="Mô tả embed..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Màu embed</Label>
                  <div className="flex items-center gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            embed_data: { ...f.embed_data, color: c },
                          }))
                        }
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-all",
                          form.embed_data.color?.toLowerCase() ===
                            c.toLowerCase()
                            ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                            : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: c }}
                        aria-label={`Chọn màu ${c}`}
                      />
                    ))}
                    <Input
                      className="w-24 h-8 text-xs font-mono"
                      value={form.embed_data.color}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          embed_data: {
                            ...f.embed_data,
                            color: e.target.value,
                          },
                        }))
                      }
                      placeholder="#5865F2"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Footer</Label>
                  <Input
                    value={form.embed_data.footer}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        embed_data: {
                          ...f.embed_data,
                          footer: e.target.value,
                        },
                      }))
                    }
                    placeholder="Chân trang embed"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <Input
                    value={form.embed_data.image_url}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        embed_data: {
                          ...f.embed_data,
                          image_url: e.target.value,
                        },
                      }))
                    }
                    placeholder="https://example.com/image.png"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Thumbnail URL</Label>
                  <Input
                    value={form.embed_data.thumbnail_url}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        embed_data: {
                          ...f.embed_data,
                          thumbnail_url: e.target.value,
                        },
                      }))
                    }
                    placeholder="https://example.com/thumb.png"
                  />
                </div>
              </div>
            )}

            <Separator />

            {/* Schedule settings */}
            <p className="text-sm font-medium">Cài đặt lịch</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Thời gian gửi</Label>
                <Input
                  type="datetime-local"
                  value={form.send_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, send_at: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Lặp lại</Label>
                <Select
                  value={form.repeat_type}
                  onValueChange={(v: ScheduledMessage["repeat_type"]) =>
                    setForm((f) => ({ ...f, repeat_type: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không lặp</SelectItem>
                    <SelectItem value="hourly">Mỗi giờ</SelectItem>
                    <SelectItem value="daily">Mỗi ngày</SelectItem>
                    <SelectItem value="weekly">Mỗi tuần</SelectItem>
                    <SelectItem value="monthly">Mỗi tháng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enabled-toggle">Bật lịch gửi</Label>
                <p className="text-[11px] text-muted-foreground">
                  Bật/tắt lịch gửi này.
                </p>
              </div>
              <Switch
                id="enabled-toggle"
                checked={form.enabled}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, enabled: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !form.channel_id ||
                !form.send_at ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Đang lưu..."
                : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
