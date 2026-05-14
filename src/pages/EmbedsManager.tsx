import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Palette, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

interface EmbedTemplate {
  id: number;
  name: string;
  event_type: string;
  title: string;
  description: string;
  color: string;
  author: string;
  footer: string;
  thumbnail_url: string;
  image_url: string;
  fields: EmbedField[];
  enabled: boolean;
}

const EMBED_EVENTS = [
  { key: "don_hang_moi",  label: "Đơn hàng mới",            icon: "🛒", desc: "Gửi khi admin tạo đơn bằng /tao_don" },
  { key: "thanh_toan",    label: "Thanh toán thành công",    icon: "✅", desc: "Gửi khi webhook PayOS xác nhận PAID" },
  { key: "giao_hang",     label: "Giao hàng",                icon: "📦", desc: "Gửi khi admin nhấn Giao hàng trên Dashboard" },
  { key: "feedback",      label: "Feedback từ user",         icon: "⭐", desc: "Gửi vào feedback channel khi user dùng /feedback" },
  { key: "giveaway",      label: "Giveaway",                 icon: "🎉", desc: "Embed khi tạo giveaway bằng /giveaway" },
  { key: "welcome",       label: "Chào mừng thành viên",     icon: "👋", desc: "Gửi vào welcome channel khi member join" },
] as const;

const emptyForm = (eventKey: string): Omit<EmbedTemplate, "id"> => ({
  name: EMBED_EVENTS.find(e => e.key === eventKey)?.label ?? eventKey,
  event_type: eventKey,
  title: "",
  description: "",
  color: "#5865F2",
  author: "",
  footer: "",
  thumbnail_url: "",
  image_url: "",
  fields: [],
  enabled: true,
});

function parseVariables(text: string): string {
  const today = new Date().toLocaleDateString("vi-VN");
  return text
    .replace(/\{user\.mention\}/g, "@TestUser")
    .replace(/\{user\.id\}/g, "123456789")
    .replace(/\{user\}/g, "TestUser")
    .replace(/\{order\.id\}/g, "#12345")
    .replace(/\{order\.total\}/g, "100,000đ")
    .replace(/\{product\.name\}/g, "VIP Package")
    .replace(/\{package\}/g, "VIP Package")
    .replace(/\{date\}/g, today)
    .replace(/\{server\}/g, "Test Server");
}

function DiscordPreview({ embed }: { embed: Omit<EmbedTemplate, "id"> }) {
  return (
    <div className="rounded-lg overflow-hidden border border-border/50 max-w-md">
      <div className="bg-[#2f3136] p-4">
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            {/* Left color bar */}
            <div
              className="w-1 rounded-full self-stretch mb-2"
              style={{ backgroundColor: embed.color || "#5865F2", height: 4 }}
            />
            {embed.author && (
              <p className="text-xs text-[#b5bac1] mb-1 font-medium">{parseVariables(embed.author)}</p>
            )}
            {embed.title && (
              <p className="text-sm font-bold text-[#f2f3f5] mb-1">{parseVariables(embed.title)}</p>
            )}
            {embed.description && (
              <p className="text-xs text-[#b5bac1] whitespace-pre-wrap mb-2">
                {parseVariables(embed.description)}
              </p>
            )}
            {embed.fields.length > 0 && (
              <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
                {embed.fields.map((f, i) => (
                  <div key={i} className={cn(!f.inline && "col-span-full")}>
                    <p className="text-xs font-bold text-[#f2f3f5]">{parseVariables(f.name)}</p>
                    <p className="text-xs text-[#b5bac1]">{parseVariables(f.value)}</p>
                  </div>
                ))}
              </div>
            )}
            {embed.footer && (
              <p className="text-[10px] text-[#b5bac1] italic mt-2">{parseVariables(embed.footer)}</p>
            )}
          </div>
          {embed.thumbnail_url && (
            <img
              src={embed.thumbnail_url}
              alt="thumbnail"
              className="w-16 h-16 rounded object-cover flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function EmbedsManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<string>("don_hang_moi");
  const [existingId, setExistingId] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<EmbedTemplate, "id">>(emptyForm("don_hang_moi"));

  const { data: embeds = [], isLoading } = useQuery<EmbedTemplate[]>({
    queryKey: ["embeds"],
    queryFn: () => fetch("/api/embeds", { credentials: "include" }).then((r) => r.json()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["embeds"] });

  const saveMutation = useMutation({
    mutationFn: (body: object) => {
      const url = existingId ? `/api/embeds/${existingId}` : "/api/embeds";
      const method = existingId ? "PUT" : "POST";
      return fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); });
    },
    onSuccess: (data) => {
      invalidate();
      if (!existingId && data?.id) {
        setExistingId(data.id);
      }
      toast({ title: existingId ? "Đã cập nhật embed." : "Đã tạo embed." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const resetMutation = useMutation({
    mutationFn: () => fetch(`/api/embeds/${existingId}`, { method: "DELETE", credentials: "include" })
      .then(async (r) => { if (!r.ok) throw new Error(await r.text()); }),
    onSuccess: () => {
      invalidate();
      setExistingId(null);
      setForm(emptyForm(selectedEvent));
      toast({ title: "Đã reset về mặc định." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const handleSelectEvent = (key: string) => {
    const existing = embeds.find(e => e.event_type === key);
    setSelectedEvent(key);
    setExistingId(existing?.id ?? null);
    if (existing) {
      setForm({
        name: existing.name,
        event_type: existing.event_type,
        title: existing.title,
        description: existing.description,
        color: existing.color,
        author: existing.author,
        footer: existing.footer,
        thumbnail_url: existing.thumbnail_url,
        image_url: existing.image_url,
        fields: existing.fields,
        enabled: existing.enabled,
      });
    } else {
      setForm(emptyForm(key));
    }
  };

  const handleSave = () => {
    saveMutation.mutate(form);
  };

  const addField = () => {
    setForm((f) => ({ ...f, fields: [...f.fields, { name: "", value: "", inline: false }] }));
  };

  const removeField = (index: number) => {
    setForm((f) => ({ ...f, fields: f.fields.filter((_, i) => i !== index) }));
  };

  const updateField = (index: number, key: keyof EmbedField, value: string | boolean) => {
    setForm((f) => ({
      ...f,
      fields: f.fields.map((field, i) => (i === index ? { ...field, [key]: value } : field)),
    }));
  };

  const currentEventInfo = EMBED_EVENTS.find(e => e.key === selectedEvent);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Đang tải...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Palette className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Embed Templates</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Event Cards (fixed, no scroll) ── */}
        <div className="lg:col-span-1 space-y-2">
          <p className="text-sm font-medium text-muted-foreground mb-3">Loại embed</p>
          {EMBED_EVENTS.map((ev) => {
            const existing = embeds.find(e => e.event_type === ev.key);
            const isSelected = selectedEvent === ev.key;
            return (
              <Card
                key={ev.key}
                className={cn(
                  "cursor-pointer transition-all hover:bg-accent/50",
                  isSelected && "ring-2 ring-primary bg-accent/30"
                )}
                onClick={() => handleSelectEvent(ev.key)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl leading-none mt-0.5">{ev.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{ev.label}</p>
                        {existing ? (
                          <Badge variant="default" className="text-[10px] bg-primary/15 text-primary border-primary/30">
                            Đã tùy chỉnh
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Mặc định
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{ev.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Right: Editor + Preview ── */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">
                  Chỉnh sửa: {currentEventInfo?.icon} {currentEventInfo?.label}
                </p>
                {existingId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={resetMutation.isPending}
                    onClick={() => resetMutation.mutate()}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {resetMutation.isPending ? "Đang reset..." : "Reset về mặc định"}
                  </Button>
                )}
              </div>

              <Separator />

              {/* Title */}
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  placeholder="Tiêu đề embed. Dùng {user}, {order.id}..."
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  placeholder="Nội dung embed. Hỗ trợ biến: {user}, {order.id}, {order.total}, {product.name}..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                />
              </div>

              {/* Color */}
              <div className="space-y-1.5">
                <Label>Màu sắc</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color || "#5865F2"}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="h-9 w-12 rounded border cursor-pointer"
                  />
                  <Input
                    value={form.color || "#5865F2"}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-32 font-mono"
                    placeholder="#5865F2"
                  />
                </div>
              </div>

              {/* Author + Footer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Author</Label>
                  <Input
                    placeholder="Tên tác giả"
                    value={form.author}
                    onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Footer</Label>
                  <Input
                    placeholder="Chân trang"
                    value={form.footer}
                    onChange={(e) => setForm((f) => ({ ...f, footer: e.target.value }))}
                  />
                </div>
              </div>

              {/* Thumbnail + Image URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Thumbnail URL</Label>
                  <Input
                    placeholder="https://..."
                    value={form.thumbnail_url}
                    onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Image URL</Label>
                  <Input
                    placeholder="https://..."
                    value={form.image_url}
                    onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  />
                </div>
              </div>

              <Separator />

              {/* Fields */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Fields</Label>
                  <Button size="sm" variant="outline" onClick={addField}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Thêm field
                  </Button>
                </div>
                {form.fields.length === 0 && (
                  <p className="text-xs text-muted-foreground">Chưa có field nào.</p>
                )}
                {form.fields.map((field, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border p-3">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        placeholder="Tên field"
                        value={field.name}
                        onChange={(e) => updateField(i, "name", e.target.value)}
                      />
                      <Input
                        placeholder="Giá trị"
                        value={field.value}
                        onChange={(e) => updateField(i, "value", e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={field.inline}
                          onChange={(e) => updateField(i, "inline", e.target.checked)}
                          className="rounded"
                        />
                        Inline
                      </label>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeField(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Enabled toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="cursor-pointer">Kích hoạt</Label>
                  <p className="text-xs text-muted-foreground">Bật/tắt embed này cho bot</p>
                </div>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                />
              </div>

              {/* Save */}
              <div className="flex justify-end gap-2">
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Discord Preview ── */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Discord Preview</p>
            <DiscordPreview embed={form} />
          </div>
        </div>
      </div>
    </div>
  );
}
