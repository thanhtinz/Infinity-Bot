import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Palette } from "lucide-react";
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

const EVENT_TYPES: Record<string, string> = {
  don_hang_moi: "Đơn hàng mới",
  thanh_toan: "Thanh toán thành công",
  giao_hang: "Giao hàng",
  feedback: "Feedback",
  giveaway: "Giveaway",
  welcome: "Chào mừng thành viên",
};

const emptyForm = (): Omit<EmbedTemplate, "id"> => ({
  name: "",
  event_type: "don_hang_moi",
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
  const [selected, setSelected] = useState<EmbedTemplate | null>(null);
  const [form, setForm] = useState<Omit<EmbedTemplate, "id">>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<EmbedTemplate | null>(null);

  const { data: embeds = [], isLoading } = useQuery<EmbedTemplate[]>({
    queryKey: ["embeds"],
    queryFn: () => fetch("/api/embeds", { credentials: "include" }).then((r) => r.json()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["embeds"] });

  const saveMutation = useMutation({
    mutationFn: (body: object) => {
      const url = selected ? `/api/embeds/${selected.id}` : "/api/embeds";
      const method = selected ? "PUT" : "POST";
      return fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); });
    },
    onSuccess: () => {
      invalidate();
      toast({ title: selected ? "Đã cập nhật embed." : "Đã tạo embed." });
      handleReset();
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/embeds/${id}`, { method: "DELETE", credentials: "include" })
      .then(async (r) => { if (!r.ok) throw new Error(await r.text()); }),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      if (selected) handleReset();
      toast({ title: "Đã xóa embed." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      fetch(`/api/embeds/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled }),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const handleSelect = (embed: EmbedTemplate) => {
    setSelected(embed);
    setForm({
      name: embed.name,
      event_type: embed.event_type,
      title: embed.title,
      description: embed.description,
      color: embed.color,
      author: embed.author,
      footer: embed.footer,
      thumbnail_url: embed.thumbnail_url,
      image_url: embed.image_url,
      fields: embed.fields,
      enabled: embed.enabled,
    });
  };

  const handleReset = () => {
    setSelected(null);
    setForm(emptyForm());
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
        {/* ── Left: Embed List ── */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Danh sách Embed</p>
            <Button size="sm" variant="outline" onClick={handleReset}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Tạo mới
            </Button>
          </div>

          {embeds.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Chưa có embed nào. Tạo mới để bắt đầu.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {embeds.map((embed) => (
                <Card
                  key={embed.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-accent/50",
                    selected?.id === embed.id && "ring-2 ring-primary"
                  )}
                  onClick={() => handleSelect(embed)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{embed.name || "Untitled"}</p>
                        <Badge variant="secondary" className="text-[10px] mt-1">
                          {EVENT_TYPES[embed.event_type] || embed.event_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Switch
                          checked={embed.enabled}
                          onCheckedChange={(checked) => {
                            toggleMutation.mutate({ id: embed.id, enabled: checked });
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); handleSelect(embed); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(embed); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Editor + Preview ── */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">
                  {selected ? `Chỉnh sửa: ${selected.name}` : "Tạo Embed mới"}
                </p>
                {selected && (
                  <Button size="sm" variant="ghost" onClick={handleReset}>
                    Hủy chỉnh sửa
                  </Button>
                )}
              </div>

              <Separator />

              {/* Name + Event Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tên embed</Label>
                  <Input
                    placeholder="VD: Đơn hàng mới"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Event type</Label>
                  <Select value={form.event_type} onValueChange={(v) => setForm((f) => ({ ...f, event_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(EVENT_TYPES).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

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
                <Button variant="outline" onClick={handleReset}>Hủy</Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending || !form.name.trim()}>
                  {saveMutation.isPending ? "Đang lưu..." : selected ? "Cập nhật" : "Tạo mới"}
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

      {/* ── Confirm xóa ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Xóa embed?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Embed <strong>{deleteTarget?.name}</strong> sẽ bị xóa vĩnh viễn.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Hủy</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
