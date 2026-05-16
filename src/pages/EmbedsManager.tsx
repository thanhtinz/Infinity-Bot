import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy, Plus, Trash2,
  ChevronDown,
  RotateCcw,
  Type, Layout,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/EmojiPicker";
import type { FormState, EmbedField, EmbedTemplate, EmbedsManagerProps } from "./embeds/embedTypes";
import { EMBED_EVENTS, EVENT_GROUPS, VARIABLES } from "./embeds/embedEvents";
import { DiscordPreview, defaultForm } from "./embeds/DiscordPreview";
import { CustomMessagesTab } from "./embeds/CustomMessagesTab";

// ─── Main Component ──────────────────────────────────────────────────────────

export function EmbedsManager({ eventKeys, pageTitle, pageDescription }: EmbedsManagerProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"events" | "custom">("events");
  const allowedKeys = useMemo(() => eventKeys ? new Set(eventKeys) : null, [eventKeys]);
  const visibleEvents = useMemo(() => allowedKeys ? EMBED_EVENTS.filter((event) => allowedKeys.has(event.key)) : EMBED_EVENTS, [allowedKeys]);
  const visibleGroups = useMemo(() => EVENT_GROUPS
    .map((group) => ({ ...group, keys: group.keys.filter((key) => !allowedKeys || allowedKeys.has(key)) }))
    .filter((group) => group.keys.length > 0), [allowedKeys]);

  // Selected event
  const initialEventKey = (() => {
    const event = new URLSearchParams(window.location.search).get("event");
    return event && visibleEvents.some((e) => e.key === event) ? event : visibleEvents[0]?.key || EMBED_EVENTS[0].key;
  })();
  const [selectedKey, setSelectedKey] = useState<string>(initialEventKey);

  // Form state
  const [form, setForm] = useState<FormState>(defaultForm(initialEventKey));

  // Collapsible sections
  const [embedOpen, setEmbedOpen] = useState(true);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(true);
  const [authorOpen, setAuthorOpen] = useState(false);
  const [varsOpen, setVarsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Reset dialog
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // ── Fetch embeds ──
  const { data: embeds = [] } = useQuery<EmbedTemplate[]>({
    queryKey: ["embeds"],
    queryFn: () => fetch("/api/embeds", { credentials: "include" }).then((r) => r.json()),
    staleTime: 300_000,
  });

  // Map of saved templates by event_type
  const savedMap = useMemo(() => {
    const m = new Map<string, EmbedTemplate>();
    for (const e of embeds) m.set(e.event_type, e);
    return m;
  }, [embeds]);

  // ── Save mutation ──
  const saveMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      const body = {
        event_type: payload.event_type,
        name: payload.name,
        title: payload.title,
        description: payload.description,
        color: payload.color,
        author: payload.author,
        author_icon_url: payload.author_icon_url,
        footer: payload.footer,
        thumbnail_url: payload.thumbnail_url,
        image_url: payload.image_url,
        fields: payload.fields,
        enabled: payload.enabled,
        response_mode: payload.response_mode,
        text_template: payload.text_template,
      };
      if (payload.existingId) {
        const res = await fetch(`/api/embeds/${payload.existingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Lưu thất bại");
        return res.json();
      } else {
        const res = await fetch("/api/embeds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Lưu thất bại");
        return res.json();
      }
    },
    onSuccess: (data) => {
      toast({ title: "Đã lưu", description: "Embed đã được lưu thành công." });
      queryClient.invalidateQueries({ queryKey: ["embeds"] });
      setForm((f) => ({ ...f, existingId: data.id ?? f.existingId }));
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể lưu embed. Vui lòng thử lại.", variant: "destructive" });
    },
  });

  // ── Select event ──
  const selectEvent = (key: string) => {
    setSelectedKey(key);
    const saved = savedMap.get(key);
    if (saved) {
      setForm({
        name: saved.name,
        event_type: saved.event_type,
        title: saved.title,
        description: saved.description,
        color: saved.color,
        author: saved.author,
        author_icon_url: saved.author_icon_url ?? "",
        footer: saved.footer,
        thumbnail_url: saved.thumbnail_url,
        image_url: saved.image_url,
        fields: saved.fields.map((f) => ({ ...f })),
        enabled: saved.enabled,
        response_mode: saved.response_mode || "embed",
        text_template: saved.text_template || "",
        existingId: saved.id,
      });
    } else {
      setForm(defaultForm(key));
    }
    setImagesOpen(false);
    setFieldsOpen(true);
    setAuthorOpen(false);
    setVarsOpen(false);
  };

  // ── Reset ──
  const handleReset = () => {
    setForm(defaultForm(selectedKey));
    setResetDialogOpen(false);
  };

  // ── Field helpers ──
  const addField = () => {
    if (form.fields.length >= 10) return;
    setForm((f) => ({ ...f, fields: [...f.fields, { name: "", value: "", inline: false }] }));
  };
  const removeField = (idx: number) => {
    setForm((f) => ({ ...f, fields: f.fields.filter((_, i) => i !== idx) }));
  };
  const updateField = (idx: number, key: keyof EmbedField, val: string | boolean) => {
    setForm((f) => ({
      ...f,
      fields: f.fields.map((field, i) => (i === idx ? { ...field, [key]: val } : field)),
    }));
  };

  const currentEvent = EMBED_EVENTS.find((e) => e.key === selectedKey);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {pageTitle && (
        <div className="relative mb-4 overflow-hidden rounded-3xl border bg-card px-5 py-4 shadow-sm">
          <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 ring-1 ring-primary/20"><Trophy className="h-5 w-5 text-primary" /></div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{pageTitle}</h1>
              {pageDescription && <p className="mt-1 text-sm text-muted-foreground">{pageDescription}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Switcher ── */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 border-b bg-card">
        <button
          type="button"
          onClick={() => setActiveTab("events")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
            activeTab === "events"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Layout className="h-3.5 w-3.5" />
          Event Templates
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("custom")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
            activeTab === "custom"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Tin nhắn
        </button>
      </div>

      {activeTab === "custom" ? (
        <div className="flex-1 min-h-0">
          <CustomMessagesTab />
        </div>
      ) : (
      <>
      {/* ── Top Bar: Event selector + controls ── */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 px-4 py-2.5 border-b bg-card">
        <div className="w-full sm:w-64 shrink-0">
          <Select value={selectedKey} onValueChange={(v) => selectEvent(v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Chọn event...">
                {currentEvent && (() => {
                  const Icon = currentEvent.icon;
                  return (
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      {currentEvent.label}
                      {savedMap.has(selectedKey) && (
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0 text-[10px] px-1.5 py-0 h-4">
                          Tùy chỉnh
                        </Badge>
                      )}
                    </span>
                  );
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {visibleGroups.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel className="text-xs uppercase tracking-wide">{group.label}</SelectLabel>
                  {group.keys.map((key) => {
                    const ev = EMBED_EVENTS.find((e) => e.key === key);
                    if (!ev) return null;
                    const Icon = ev.icon;
                    const saved = savedMap.has(ev.key);
                    return (
                      <SelectItem key={ev.key} value={ev.key}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          {ev.label}
                          {saved && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResetDialogOpen(true)}
            className="text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "..." : "Lưu"}
          </Button>
        </div>
      </div>

      {/* ── Single-column Discohook-style Editor ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-3">

          {/* ── Response Mode Toggle ── */}
          <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, response_mode: "embed" }))}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
                form.response_mode === "embed"
                  ? "bg-background shadow-sm border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layout className="h-4 w-4" />
              Embed
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, response_mode: "text" }))}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
                form.response_mode === "text"
                  ? "bg-background shadow-sm border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Type className="h-4 w-4" />
              Text
            </button>
          </div>

          {/* ── Text Mode Editor ── */}
          {form.response_mode === "text" && (
            <div className="rounded-lg border overflow-hidden" style={{ borderLeftWidth: 4, borderLeftColor: form.color || "#5865F2" }}>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Nội dung Text</span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="text-enabled" className="text-xs text-muted-foreground cursor-pointer">
                      {form.enabled ? "Bật" : "Tắt"}
                    </Label>
                    <Switch
                      id="text-enabled"
                      checked={form.enabled}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                    />
                  </div>
                </div>
                <Textarea
                  value={form.text_template}
                  onChange={(e) => setForm((f) => ({ ...f, text_template: e.target.value }))}
                  placeholder="Nội dung tin nhắn text với {biến}...&#10;&#10;VD: **Đơn hàng #{order.id}** của {user.mention} đã được tạo!"
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Hỗ trợ Markdown Discord: **bold**, *italic*, __underline__, ~~strikethrough~~, `code`, ```code block```
                </p>
                {/* Text Preview */}
                <div className="rounded-lg bg-[#313338] p-4 font-sans text-sm">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-lg bg-[#5865F2]">
                      🤖
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[#F2F3F5] text-sm">Dashboard Bot</span>
                        <span className="bg-[#5865F2] text-white text-[10px] font-medium px-1 py-0.5 rounded leading-none">BOT</span>
                      </div>
                      <p className="text-[#DBDEE1] mt-1 whitespace-pre-wrap text-sm">
                        {form.text_template || "Nhập nội dung..."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Embed Section — collapsible card with colored left border ── */}
          {form.response_mode === "embed" && (<>
          <div className="rounded-lg border overflow-hidden" style={{ borderLeftWidth: 4, borderLeftColor: form.color || "#5865F2" }}>
            <div
              role="button"
              tabIndex={0}
              className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors cursor-pointer select-none"
              onClick={() => setEmbedOpen(!embedOpen)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEmbedOpen(!embedOpen); } }}
            >
              <span className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", embedOpen && "rotate-180")} />
                Embed — {form.title || "Không có tiêu đề"}
              </span>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Label htmlFor="embed-enabled" className="text-xs text-muted-foreground cursor-pointer">
                  {form.enabled ? "Bật" : "Tắt"}
                </Label>
                <Switch
                  id="embed-enabled"
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                />
              </div>
            </div>
            {embedOpen && (
              <div className="px-4 pb-4 space-y-4">
                {/* Title */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tiêu đề</Label>
                  <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                    <Input
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      placeholder="Nhập tiêu đề embed..."
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    />
                    <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, title: f.title + em }))} />
                  </div>
                </div>
                {/* Description with char count */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Mô tả</Label>
                    <span className="text-[11px] text-muted-foreground">{form.description.length}/4096</span>
                  </div>
                  <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                    <Textarea
                      placeholder="Nhập mô tả embed..."
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      rows={5}
                      className="resize-y flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, description: f.description + em }))} />
                  </div>
                </div>
                {/* Color */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Màu sắc</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                      className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                    />
                    <Input
                      value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                      className="w-28 font-mono text-xs"
                      maxLength={7}
                    />
                  </div>
                </div>
                {/* Footer with char count */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Chân trang</Label>
                    <span className="text-[11px] text-muted-foreground">{form.footer.length}/2048</span>
                  </div>
                  <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                    <Input
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      placeholder="Nội dung chân trang"
                      value={form.footer}
                      onChange={(e) => setForm((f) => ({ ...f, footer: e.target.value }))}
                    />
                    <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, footer: f.footer + em }))} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Author — collapsible, no colored border ── */}
          <div className="rounded-lg border">
            <button
              type="button"
              className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
              onClick={() => setAuthorOpen(!authorOpen)}
            >
              <span className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", authorOpen && "rotate-180")} />
                Tác giả
              </span>
            </button>
            {authorOpen && (
              <div className="px-4 pb-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tên tác giả</Label>
                  <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                    <Input
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      placeholder="Tên tác giả (hiển thị phía trên tiêu đề)"
                      value={form.author}
                      onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                    />
                    <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, author: f.author + em }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Icon URL</Label>
                  <Input
                    placeholder="https://example.com/icon.png"
                    value={form.author_icon_url}
                    onChange={(e) => setForm((f) => ({ ...f, author_icon_url: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Images — collapsible ── */}
          <div className="rounded-lg border">
            <button
              type="button"
              className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
              onClick={() => setImagesOpen(!imagesOpen)}
            >
              <span className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", imagesOpen && "rotate-180")} />
                Hình ảnh
              </span>
            </button>
            {imagesOpen && (
              <div className="px-4 pb-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Thumbnail URL</Label>
                  <Input
                    placeholder="https://example.com/thumb.png"
                    value={form.thumbnail_url}
                    onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Image URL</Label>
                  <Input
                    placeholder="https://example.com/image.png"
                    value={form.image_url}
                    onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Fields — collapsible, with count badge ── */}
          <div className="rounded-lg border">
            <button
              type="button"
              className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
              onClick={() => setFieldsOpen(!fieldsOpen)}
            >
              <span className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", fieldsOpen && "rotate-180")} />
                Fields ({form.fields.length}/25)
              </span>
            </button>
            {fieldsOpen && (
              <div className="px-4 pb-4 space-y-3">
                {form.fields.map((field, i) => (
                  <div key={i} className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Field {i + 1}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeField(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                        <Input
                          placeholder="Tên field"
                          value={field.name}
                          onChange={(e) => updateField(i, "name", e.target.value)}
                          className="text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <EmojiPicker onSelect={(em) => updateField(i, "name", field.name + em)} />
                      </div>
                      <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                        <Input
                          placeholder="Giá trị"
                          value={field.value}
                          onChange={(e) => updateField(i, "value", e.target.value)}
                          className="text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <EmojiPicker onSelect={(em) => updateField(i, "value", field.value + em)} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={field.inline}
                        onChange={(e) => updateField(i, "inline", e.target.checked)}
                        className="rounded border-input"
                      />
                      Inline (hiển thị cùng dòng)
                    </label>
                  </div>
                ))}
                {form.fields.length < 25 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addField}
                    className="w-full border-dashed"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Thêm field
                  </Button>
                )}
                {form.fields.length >= 25 && (
                  <p className="text-xs text-muted-foreground text-center">Đã đạt giới hạn 25 fields</p>
                )}
              </div>
            )}
          </div>
          </>)}

          {/* ── Variables — collapsible ── */}
          <div className="rounded-lg border">
            <button
              type="button"
              className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
              onClick={() => setVarsOpen(!varsOpen)}
            >
              <span className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", varsOpen && "rotate-180")} />
                Biến hỗ trợ
                <span className="text-xs text-muted-foreground font-normal">({VARIABLES.length})</span>
              </span>
            </button>
            {varsOpen && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {VARIABLES.map((v, i) => (
                    <div key={`${v.token}-${i}`} className="flex items-baseline gap-2 text-xs py-0.5">
                      <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-primary">
                        {v.token}
                      </code>
                      <span className="text-muted-foreground truncate">{v.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Discord Preview — collapsible, always last (embed mode only) ── */}
          {form.response_mode === "embed" && (
          <div className="rounded-lg border">
            <button
              type="button"
              className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
              onClick={() => setShowPreview(!showPreview)}
            >
              <span className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", showPreview && "rotate-180")} />
                Xem trước Discord
              </span>
            </button>
            {showPreview && (
              <div className="p-4">
                <DiscordPreview form={form} />
                <p className="text-[11px] text-muted-foreground italic mt-3">* Preview sử dụng dữ liệu giả</p>
              </div>
            )}
          </div>
          )}

        </div>
      </div>

      {/* ── Reset Confirm Dialog ── */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset về mặc định?</AlertDialogTitle>
            <AlertDialogDescription>
              Embed &quot;{currentEvent?.label}&quot; sẽ được đặt lại về nội dung mặc định. Các thay đổi chưa lưu sẽ bị mất.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
      )}
    </div>
  );
}
