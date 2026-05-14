import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
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
  Send,
  Layout,
  ChevronDown,
  ChevronRight,
  CalendarClock,
  FileText,
  X,
  User,
  Type,
  ImageIcon,
  Footprints,
  ToggleLeft,
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
  author_name: string;
  author_icon_url: string;
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
  author_name: "",
  author_icon_url: "",
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

function relativeTime(s: string): string {
  const now = Date.now();
  const target = new Date(s).getTime();
  const diff = target - now;
  const absDiff = Math.abs(diff);
  const isFuture = diff > 0;

  const minutes = Math.floor(absDiff / 60_000);
  const hours = Math.floor(absDiff / 3_600_000);
  const days = Math.floor(absDiff / 86_400_000);

  if (minutes < 1) return isFuture ? "ngay bây giờ" : "vừa xong";
  if (minutes < 60) return isFuture ? `trong ${minutes} phút` : `${minutes} phút trước`;
  if (hours < 24) return isFuture ? `trong ${hours} giờ` : `${hours} giờ trước`;
  if (days < 30) return isFuture ? `trong ${days} ngày` : `${days} ngày trước`;

  return formatDate(s);
}

// ─── Discord Embed Preview ───────────────────────────────────────────────────

function DiscordEmbedPreview({ data }: { data: EmbedData }) {
  const colorHex = data.color || DEFAULT_COLOR;
  const hasContent = data.title || data.description || data.fields.length > 0 || data.footer || data.author_name;

  if (!hasContent) {
    return (
      <div className="rounded-md bg-[#313338] p-6 text-center">
        <p className="text-sm text-[#B5BAC1]">Xem trước embed sẽ hiển thị ở đây</p>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-[#313338] p-4 flex gap-3">
      <div
        className="w-1 shrink-0 rounded-full"
        style={{ backgroundColor: colorHex }}
      />
      <div className="flex-1 min-w-0">
        {data.author_name && (
          <div className="flex items-center gap-2 mb-1">
            {data.author_icon_url && (
              <img
                src={data.author_icon_url}
                alt=""
                className="w-5 h-5 rounded-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <p className="text-[11px] font-medium text-[#B5BAC1]">{data.author_name}</p>
          </div>
        )}
        {data.title && (
          <p className="font-semibold text-[#F2F3F5] text-sm">{data.title}</p>
        )}
        {data.description && (
          <p className="text-[#B5BAC1] text-xs whitespace-pre-wrap mt-1">
            {data.description}
          </p>
        )}
        {data.fields.length > 0 && (
          <div className="grid gap-1 mt-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
            {data.fields.map((f, i) => (
              <div key={i} className={cn(!f.inline && "col-span-full")}>
                <p className="font-semibold text-[#F2F3F5] text-xs">{f.name}</p>
                <p className="text-[#B5BAC1] text-xs whitespace-pre-wrap">{f.value}</p>
              </div>
            ))}
          </div>
        )}
        {data.image_url && (
          <div className="pt-1">
            <img
              src={data.image_url}
              alt=""
              className="rounded max-h-48 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
        {data.footer && (
          <p className="text-[#B5BAC1] text-[11px] pt-1">{data.footer}</p>
        )}
      </div>
      {data.thumbnail_url && (
        <img
          src={data.thumbnail_url}
          alt=""
          className="w-16 h-16 rounded object-cover shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ScheduledMessages() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledMessage | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Embed collapsible sections
  const [embedBodyOpen, setEmbedBodyOpen] = useState(true);
  const [embedAuthorOpen, setEmbedAuthorOpen] = useState(false);
  const [embedFieldsOpen, setEmbedFieldsOpen] = useState(false);
  const [embedImagesOpen, setEmbedImagesOpen] = useState(false);
  const [embedFooterOpen, setEmbedFooterOpen] = useState(false);
  const [embedPreviewOpen, setEmbedPreviewOpen] = useState(true);

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

  // ── Embed field helpers ──────────────────────────────────────────────────

  const addEmbedField = () => {
    setForm((f) => ({
      ...f,
      embed_data: {
        ...f.embed_data,
        fields: [...f.embed_data.fields, { name: "", value: "", inline: false }],
      },
    }));
  };

  const removeEmbedField = (idx: number) => {
    setForm((f) => ({
      ...f,
      embed_data: {
        ...f.embed_data,
        fields: f.embed_data.fields.filter((_, i) => i !== idx),
      },
    }));
  };

  const updateEmbedField = (idx: number, patch: Partial<EmbedField>) => {
    setForm((f) => ({
      ...f,
      embed_data: {
        ...f.embed_data,
        fields: f.embed_data.fields.map((field, i) =>
          i === idx ? { ...field, ...patch } : field
        ),
      },
    }));
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
            <div className="relative mb-4">
              <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center">
                <CalendarClock className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Send className="h-3 w-3 text-primary/60" />
              </div>
            </div>
            <p className="text-sm font-medium">Chưa có lịch gửi nào</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tạo lịch gửi tin nhắn tự động để bot gửi đúng thời gian.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo lịch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => {
            const preview = m.embed_data
              ? truncate(m.embed_data.title || m.embed_data.description, 80)
              : truncate(m.content, 80);

            return (
              <Card
                key={m.id}
                className={cn(
                  "overflow-hidden transition-all cursor-pointer hover:shadow-md",
                  !m.enabled && "opacity-60"
                )}
                onClick={() => openEdit(m)}
              >
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Colored left border for embed messages */}
                    {m.embed_data && (
                      <div
                        className="w-1 shrink-0"
                        style={{ backgroundColor: m.embed_data.color || DEFAULT_COLOR }}
                      />
                    )}

                    <div className="flex-1 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* Left: status dot + content */}
                        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          {/* Status dot */}
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full shrink-0",
                                m.sent
                                  ? "bg-green-500"
                                  : m.enabled
                                    ? "bg-amber-500 animate-pulse"
                                    : "bg-muted-foreground/40"
                              )}
                            />
                            <span className="text-xs font-medium">
                              {m.sent ? "Đã gửi" : m.enabled ? "Chờ gửi" : "Tắt"}
                            </span>
                          </div>

                          {/* Channel */}
                          <Badge
                            variant="secondary"
                            className="w-fit gap-1 font-mono text-xs"
                          >
                            <Hash className="h-3 w-3" />
                            {m.channel_id}
                          </Badge>

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
                            <Badge className="bg-indigo-500/15 text-indigo-600 border-indigo-500/30 w-fit gap-1 text-xs">
                              <Layout className="h-3 w-3" />
                              Embed
                            </Badge>
                          )}

                          {/* Preview */}
                          <span className="truncate text-sm text-muted-foreground">
                            {preview || "(trống)"}
                          </span>
                        </div>

                        {/* Right: time + actions */}
                        <div className="flex items-center gap-3">
                          {/* Relative time */}
                          <div className="hidden flex-col gap-0.5 text-xs text-muted-foreground md:flex items-end">
                            <span className="font-medium text-foreground/80">
                              {relativeTime(m.send_at)}
                            </span>
                            <span>{formatDate(m.send_at)}</span>
                          </div>

                          {/* Mobile time */}
                          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground md:hidden">
                            <span>{relativeTime(m.send_at)}</span>
                          </div>

                          <Separator orientation="vertical" className="mx-1 h-8" />

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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Chỉnh sửa lịch gửi" : "Tạo lịch gửi"}
            </DialogTitle>
            <DialogDescription>
              Hẹn giờ bot gửi tin nhắn hoặc embed tự động.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* ── Section 1: Cài đặt gửi ── */}
            <div className="space-y-4">
              <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                ⏰ Cài đặt gửi
              </p>

              <div className="grid grid-cols-2 gap-4">
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

                {/* Time picker */}
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Repeat type */}
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

                {/* Enabled toggle — card style */}
                <div className="space-y-2">
                  <Label>Trạng thái</Label>
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 transition-colors cursor-pointer select-none",
                      form.enabled
                        ? "bg-primary/5 border-primary/20"
                        : "bg-muted/30 border-muted"
                    )}
                    onClick={() =>
                      setForm((f) => ({ ...f, enabled: !f.enabled }))
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setForm((f) => ({ ...f, enabled: !f.enabled }));
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <ToggleLeft className={cn("h-4 w-4", form.enabled ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("text-sm font-medium", form.enabled ? "text-primary" : "text-muted-foreground")}>
                        {form.enabled ? "Đang bật" : "Đang tắt"}
                      </span>
                    </div>
                    <Switch
                      checked={form.enabled}
                      onCheckedChange={(checked) =>
                        setForm((f) => ({ ...f, enabled: checked }))
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Section 2: Nội dung ── */}
            <div className="space-y-4">
              <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                📝 Nội dung
              </p>

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

              {/* Add embed toggle — styled button */}
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    add_embed: !f.add_embed,
                    embed_data: !f.add_embed ? f.embed_data : emptyEmbed(),
                  }))
                }
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border p-3 transition-all",
                  form.add_embed
                    ? "bg-indigo-500/10 border-indigo-500/30"
                    : "bg-muted/30 border-muted hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md",
                    form.add_embed ? "bg-indigo-500/20" : "bg-muted"
                  )}>
                    <Layout className={cn("h-4 w-4", form.add_embed ? "text-indigo-500" : "text-muted-foreground")} />
                  </div>
                  <div className="text-left">
                    <p className={cn("text-sm font-medium", form.add_embed ? "text-indigo-600 dark:text-indigo-400" : "text-foreground")}>
                      Thêm Embed
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Gửi kèm embed đẹp mắt cùng tin nhắn
                    </p>
                  </div>
                </div>
                <Switch
                  checked={form.add_embed}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({
                      ...f,
                      add_embed: checked,
                      embed_data: checked ? f.embed_data : emptyEmbed(),
                    }))
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              </button>
            </div>

            {/* ── Section 3: Cấu hình Embed ── */}
            {form.add_embed && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Layout className="h-3.5 w-3.5" />
                    🎨 Cấu hình Embed
                  </p>

                  {/* ── Embed Preview — collapsible ── */}
                  <div className="rounded-lg border">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
                      onClick={() => setEmbedPreviewOpen(!embedPreviewOpen)}
                    >
                      <span className="flex items-center gap-2">
                        <ChevronDown className={cn("h-4 w-4 transition-transform", embedPreviewOpen && "rotate-180")} />
                        Xem trước
                      </span>
                    </button>
                    {embedPreviewOpen && (
                      <div className="px-4 pb-4">
                        <DiscordEmbedPreview data={form.embed_data} />
                      </div>
                    )}
                  </div>

                  {/* ── Body — collapsible with colored left border ── */}
                  <div
                    className="rounded-lg border overflow-hidden"
                    style={{
                      borderLeftWidth: 4,
                      borderLeftColor: form.embed_data.color || DEFAULT_COLOR,
                    }}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
                      onClick={() => setEmbedBodyOpen(!embedBodyOpen)}
                    >
                      <span className="flex items-center gap-2">
                        <ChevronDown className={cn("h-4 w-4 transition-transform", embedBodyOpen && "rotate-180")} />
                        <Type className="h-3.5 w-3.5 text-muted-foreground" />
                        Nội dung chính
                        {form.embed_data.title && (
                          <span className="text-xs font-normal text-muted-foreground truncate max-w-[200px]">
                            — {form.embed_data.title}
                          </span>
                        )}
                      </span>
                    </button>
                    {embedBodyOpen && (
                      <div className="px-4 pb-4 space-y-4">
                        {/* Title */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Tiêu đề</Label>
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

                        {/* Description */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Mô tả</Label>
                            <span className="text-[11px] text-muted-foreground">
                              {form.embed_data.description.length}/4096
                            </span>
                          </div>
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
                            rows={4}
                          />
                        </div>

                        {/* Color */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Màu sắc</Label>
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
                                  "h-7 w-7 rounded-full border-2 transition-all",
                                  form.embed_data.color?.toLowerCase() === c.toLowerCase()
                                    ? "border-foreground scale-110"
                                    : "border-transparent hover:scale-105"
                                )}
                                style={{ backgroundColor: c }}
                                aria-label={`Chọn màu ${c}`}
                              />
                            ))}
                            <div className="flex items-center gap-1.5 ml-1">
                              <Input
                                type="color"
                                value={form.embed_data.color || DEFAULT_COLOR}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    embed_data: { ...f.embed_data, color: e.target.value },
                                  }))
                                }
                                className="h-7 w-9 p-0 border-0 cursor-pointer rounded"
                              />
                              <Input
                                value={form.embed_data.color || DEFAULT_COLOR}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    embed_data: { ...f.embed_data, color: e.target.value },
                                  }))
                                }
                                className="w-24 font-mono text-xs h-7"
                                maxLength={7}
                                placeholder="#5865F2"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Author — collapsible ── */}
                  <div className="rounded-lg border">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
                      onClick={() => setEmbedAuthorOpen(!embedAuthorOpen)}
                    >
                      <span className="flex items-center gap-2">
                        <ChevronDown className={cn("h-4 w-4 transition-transform", embedAuthorOpen && "rotate-180")} />
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        Tác giả
                      </span>
                      {form.embed_data.author_name && !embedAuthorOpen && (
                        <span className="text-xs font-normal text-muted-foreground truncate max-w-[200px]">
                          {form.embed_data.author_name}
                        </span>
                      )}
                    </button>
                    {embedAuthorOpen && (
                      <div className="px-4 pb-4 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Tên tác giả</Label>
                          <Input
                            value={form.embed_data.author_name}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                embed_data: { ...f.embed_data, author_name: e.target.value },
                              }))
                            }
                            placeholder="Tên tác giả (hiển thị phía trên tiêu đề)"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Icon URL</Label>
                          <Input
                            value={form.embed_data.author_icon_url}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                embed_data: { ...f.embed_data, author_icon_url: e.target.value },
                              }))
                            }
                            placeholder="https://example.com/icon.png"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Fields — collapsible with count ── */}
                  <div className="rounded-lg border">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
                      onClick={() => setEmbedFieldsOpen(!embedFieldsOpen)}
                    >
                      <span className="flex items-center gap-2">
                        <ChevronDown className={cn("h-4 w-4 transition-transform", embedFieldsOpen && "rotate-180")} />
                        <Type className="h-3.5 w-3.5 text-muted-foreground" />
                        Fields
                        <span className="text-xs text-muted-foreground font-normal">
                          ({form.embed_data.fields.length}/25)
                        </span>
                      </span>
                    </button>
                    {embedFieldsOpen && (
                      <div className="px-4 pb-4 space-y-3">
                        {form.embed_data.fields.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-3">
                            Chưa có field nào. Nhấn nút bên dưới để thêm.
                          </p>
                        )}
                        {form.embed_data.fields.map((field, idx) => (
                          <div
                            key={idx}
                            className="rounded-md border bg-muted/30 p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">
                                Field #{idx + 1}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => removeEmbedField(idx)}
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
                                    updateEmbedField(idx, { name: e.target.value })
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
                                    updateEmbedField(idx, { value: e.target.value })
                                  }
                                  placeholder="Nội dung"
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={field.inline}
                                onChange={(e) =>
                                  updateEmbedField(idx, { inline: e.target.checked })
                                }
                                className="rounded border-input"
                              />
                              Inline (hiển thị cùng dòng)
                            </label>
                          </div>
                        ))}
                        {form.embed_data.fields.length < 25 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addEmbedField}
                            className="w-full border-dashed"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Thêm field
                          </Button>
                        )}
                        {form.embed_data.fields.length >= 25 && (
                          <p className="text-xs text-muted-foreground text-center">
                            Đã đạt giới hạn 25 fields
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Images — collapsible ── */}
                  <div className="rounded-lg border">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
                      onClick={() => setEmbedImagesOpen(!embedImagesOpen)}
                    >
                      <span className="flex items-center gap-2">
                        <ChevronDown className={cn("h-4 w-4 transition-transform", embedImagesOpen && "rotate-180")} />
                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        Hình ảnh
                      </span>
                    </button>
                    {embedImagesOpen && (
                      <div className="px-4 pb-4 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Thumbnail URL</Label>
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
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Ảnh lớn URL</Label>
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
                      </div>
                    )}
                  </div>

                  {/* ── Footer — collapsible ── */}
                  <div className="rounded-lg border">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
                      onClick={() => setEmbedFooterOpen(!embedFooterOpen)}
                    >
                      <span className="flex items-center gap-2">
                        <ChevronDown className={cn("h-4 w-4 transition-transform", embedFooterOpen && "rotate-180")} />
                        <Footprints className="h-3.5 w-3.5 text-muted-foreground" />
                        Chân trang
                      </span>
                      {form.embed_data.footer && !embedFooterOpen && (
                        <span className="text-xs font-normal text-muted-foreground truncate max-w-[200px]">
                          {form.embed_data.footer}
                        </span>
                      )}
                    </button>
                    {embedFooterOpen && (
                      <div className="px-4 pb-4 space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Nội dung chân trang</Label>
                            <span className="text-[11px] text-muted-foreground">
                              {form.embed_data.footer.length}/2048
                            </span>
                          </div>
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
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
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
