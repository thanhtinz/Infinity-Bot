import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useT } from "@/i18n";
import { useGuild } from "@/contexts/GuildContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmojiInput, EmojiTextarea } from "@/components/EmojiInput";
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
  RotateCcw, Save,
  Type, Layout,
  MessageSquare,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormState, EmbedField, EmbedTemplate, EmbedsManagerProps, EmbedEventDef } from "./embeds/embedTypes";
import { EMBED_EVENTS, EVENT_GROUPS, VARIABLES } from "./embeds/embedEvents";
import { DiscordPreview, defaultForm } from "./embeds/DiscordPreview";
import { CustomMessagesTab } from "./embeds/CustomMessagesTab";
import { apiFetch } from "@/hooks/useApi";

// ─── Main Component ──────────────────────────────────────────────────────────

export function EmbedsManager({ eventKeys, pageTitle, pageDescription }: EmbedsManagerProps = {}) {
  const { t } = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedGuildId } = useGuild();
  const [activeTab, setActiveTab] = useState<"events" | "custom">("events");

  // ── Fetch products for dynamic per-product embed events ──
  const { data: products = [] } = useQuery<{ id: number; name: string; emoji?: string }[]>({
    queryKey: ["products", selectedGuildId],
    queryFn: () => apiFetch("/api/products", {
      credentials: "include",
      headers: selectedGuildId ? { "X-Guild-ID": selectedGuildId } : {},
    }).then((r) => r.json()),
    staleTime: 60_000,
    enabled: !!selectedGuildId,
  });

  // Ensure product embed templates exist
  useEffect(() => {
    if (products.length > 0 && selectedGuildId) {
      apiFetch("/api/products/ensure-embeds", {
        method: "POST",
        credentials: "include",
        headers: selectedGuildId ? { "X-Guild-ID": selectedGuildId } : {},
      }).catch(() => {});
    }
  }, [products.length, selectedGuildId]);

  // Build dynamic product events
  const productEvents: EmbedEventDef[] = useMemo(() =>
    products.map((p) => ({
      key: `product_${p.id}`,
      label: p.emoji ? `${p.emoji} ${p.name}` : p.name,
      labelEn: p.name,
      icon: Package,
      desc: `Detail embed for product "${p.name}"`,
      descEn: `Detail embed for product "${p.name}"`,
    })), [products]);

  const productGroup = useMemo(() => ({
    label: "Products",
    labelEn: "Products",
    keys: productEvents.map((e) => e.key),
  }), [productEvents]);

  // Merge static + dynamic events
  const allEvents = useMemo(() => [...EMBED_EVENTS, ...productEvents], [productEvents]);
  const allGroups = useMemo(() => {
    const groups = [...EVENT_GROUPS];
    if (productGroup.keys.length > 0) groups.splice(1, 0, productGroup); // after "Orders"
    return groups;
  }, [productGroup]);

  const allowedKeys = useMemo(() => eventKeys ? new Set(eventKeys) : null, [eventKeys]);
  const visibleEvents = useMemo(() => allowedKeys ? allEvents.filter((event) => allowedKeys.has(event.key)) : allEvents, [allowedKeys, allEvents]);
  const visibleGroups = useMemo(() => allGroups
    .map((group) => ({ ...group, keys: group.keys.filter((key) => !allowedKeys || allowedKeys.has(key)) }))
    .filter((group) => group.keys.length > 0), [allowedKeys, allGroups]);

  // ── Bot language from config ──
  const { data: _configData } = useQuery({
    queryKey: ["config", selectedGuildId],
    queryFn: () =>
      apiFetch("/api/config", {
        credentials: "include",
        headers: selectedGuildId ? { "X-Guild-ID": selectedGuildId } : {},
      }).then((r) => r.json()),
    staleTime: 60_000,
    enabled: !!selectedGuildId,
  });
  const botLang = "en" as const;

  // Selected event
  const initialEventKey = (() => {
    const event = new URLSearchParams(window.location.search).get("event");
    return event && visibleEvents.some((e) => e.key === event) ? event : visibleEvents[0]?.key || EMBED_EVENTS[0].key;
  })();
  const [selectedKey, setSelectedKey] = useState<string>(initialEventKey);

  // When eventKeys is provided (e.g. product embed tab), sync selectedKey once
  // visibleEvents becomes non-empty (products load async)
  useEffect(() => {
    if (eventKeys && visibleEvents.length > 0 && !visibleEvents.some((e) => e.key === selectedKey)) {
      const k = visibleEvents[0].key;
      setSelectedKey(k);
      setForm(defaultForm(k, botLang));
    }
  }, [visibleEvents, selectedKey, eventKeys, botLang]);

  // Form state
  const [form, setForm] = useState<FormState>(defaultForm(initialEventKey, botLang));

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
    queryKey: ["embeds", selectedGuildId],
    queryFn: () => apiFetch("/api/embeds").then((r) => r.json()),
    staleTime: 300_000,
    enabled: !!selectedGuildId,
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
        const res = await apiFetch(`/api/embeds/${payload.existingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Save failed");
        return res.json();
      } else {
        const res = await apiFetch("/api/embeds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Save failed");
        return res.json();
      }
    },
    onSuccess: (data) => {
      toast({ title: t("toast_saved"), description: t("toast_embedSaved") });
      queryClient.invalidateQueries({ queryKey: ["embeds"] });
      setForm((f) => ({ ...f, existingId: data.id ?? f.existingId }));
    },
    onError: () => {
      toast({ title: t("error"), description: t("toast_embedFailed"), variant: "destructive" });
    },
  });

  // ── Select event ──
  const selectEvent = (key: string) => {
    setSelectedKey(key);
    const saved = savedMap.get(key);
    if (saved) {
      setForm({
        name: saved.name ?? "",
        event_type: saved.event_type,
        title: saved.title ?? "",
        description: saved.description ?? "",
        color: saved.color ?? "#5865F2",
        author: saved.author ?? "",
        author_icon_url: saved.author_icon_url ?? "",
        footer: saved.footer ?? "",
        thumbnail_url: saved.thumbnail_url ?? "",
        image_url: saved.image_url ?? "",
        fields: saved.fields.map((f) => ({ ...f })),
        enabled: saved.enabled,
        response_mode: saved.response_mode || "embed",
        text_template: saved.text_template || "",
        existingId: saved.id,
      });
    } else {
      setForm(defaultForm(key, botLang));
    }
    setImagesOpen(false);
    setFieldsOpen(true);
    setAuthorOpen(false);
    setVarsOpen(false);
  };

  // ── Reset ──
  const handleReset = () => {
    setForm(defaultForm(selectedKey, botLang));
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

  const currentEvent = allEvents.find((e) => e.key === selectedKey);

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
      {!eventKeys && (
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
          {t("messages")}
        </button>
      </div>
      )}

      {activeTab === "custom" && !eventKeys ? (
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
              <SelectValue placeholder={t("embeds_selectEvent")}>
                {currentEvent && (() => {
                  const Icon = currentEvent.icon;
                  return (
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      {botLang === "en" ? (currentEvent.labelEn ?? currentEvent.label) : currentEvent.label}
                      {savedMap.has(selectedKey) && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary dark:text-primary/80 border-0 text-[10px] px-1.5 py-0 h-4">
                          {t("edit")}
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
                  <SelectLabel className="text-xs uppercase tracking-wide">{botLang === "en" ? (group.labelEn ?? group.label) : group.label}</SelectLabel>
                  {group.keys.map((key) => {
                    const ev = allEvents.find((e) => e.key === key);
                    if (!ev) return null;
                    const Icon = ev.icon;
                    const saved = savedMap.has(ev.key);
                    return (
                      <SelectItem key={ev.key} value={ev.key}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          {botLang === "en" ? (ev.labelEn ?? ev.label) : ev.label}
                          {saved && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
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
            <span className="hidden sm:inline">{t("reset")}</span>
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
          >
            <Save className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{saveMutation.isPending ? "..." : t("save")}</span>
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
              {t("text")}
            </button>
          </div>

          {/* ── Text Mode Editor ── */}
          {form.response_mode === "text" && (
            <div className="rounded-lg border overflow-hidden" style={{ borderLeftWidth: 4, borderLeftColor: form.color || "#5865F2" }}>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{t("messageContent")}</span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="text-enabled" className="text-xs text-muted-foreground cursor-pointer">
                      {form.enabled ? t("enable") : t("disable")}
                    </Label>
                    <Switch
                      id="text-enabled"
                      checked={form.enabled}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                    />
                  </div>
                </div>
                <EmojiTextarea
                  value={form.text_template ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, text_template: e.target.value }))}
                  placeholder="Message content text with {variable}...&#10;&#10;E.g. **Order #{order.id}** by {user.mention} has been created!"
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Support Markdown Discord: **bold**, *italic*, __underline__, ~~strikethrough~~, `code`, ```code block```
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
                        {form.text_template || t("messageContent")}
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
                Embed — {form.title || t("embeds_title_field")}
              </span>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Label htmlFor="embed-enabled" className="text-xs text-muted-foreground cursor-pointer">
                  {form.enabled ? t("enable") : t("disable")}
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
                  <Label className="text-xs text-muted-foreground">{t("embeds_title_field")}</Label>
                  <EmojiInput
                    placeholder={t("embeds_title_field") + "..."}
                    value={form.title ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                {/* Description with char count */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">{t("embeds_description")}</Label>
                    <span className="text-[11px] text-muted-foreground">{form.description.length}/4096</span>
                  </div>
                  <EmojiTextarea
                    placeholder={t("embeds_description") + "..."}
                    value={form.description ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={5}
                    className="resize-y"
                  />
                </div>
                {/* Color */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("embeds_color")}</Label>
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
                    <Label className="text-xs text-muted-foreground">{t("embeds_footer")}</Label>
                    <span className="text-[11px] text-muted-foreground">{form.footer.length}/2048</span>
                  </div>
                  <EmojiInput
                    placeholder={t("embeds_footer")}
                    value={form.footer ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, footer: e.target.value }))}
                  />
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
                Author
              </span>
            </button>
            {authorOpen && (
              <div className="px-4 pb-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("authorName")}</Label>
                  <EmojiInput
                    placeholder={t("authorName")}
                    value={form.author ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("authorIconUrl")}</Label>
                  <Input
                    placeholder="https://example.com/icon.png"
                    value={form.author_icon_url ?? ""}
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
                Image
              </span>
            </button>
            {imagesOpen && (
              <div className="px-4 pb-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("thumbnailUrl")}</Label>
                  <Input
                    placeholder="https://example.com/thumb.png"
                    value={form.thumbnail_url ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("imageUrl")}</Label>
                  <Input
                    placeholder="https://example.com/image.png"
                    value={form.image_url ?? ""}
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
                {t("embeds_fields")} ({form.fields.length}/25)
              </span>
            </button>
            {fieldsOpen && (
              <div className="px-4 pb-4 space-y-3">
                {form.fields.map((field, i) => (
                  <div key={i} className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">{t("embeds_addField")} {i + 1}</span>
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
                      <EmojiInput
                          placeholder={t("fieldName")}
                          value={field.name}
                          onChange={(e) => updateField(i, "name", e.target.value)}
                          className="text-sm"
                        />
                      <EmojiInput
                          placeholder={t("value")}
                          value={field.value}
                          onChange={(e) => updateField(i, "value", e.target.value)}
                          className="text-sm"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={field.inline}
                        onChange={(e) => updateField(i, "inline", e.target.checked)}
                        className="rounded border-input"
                      />
                      {t("inline")}
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
                    {t("embeds_addField")}
                  </Button>
                )}
                {form.fields.length >= 25 && (
                  <p className="text-xs text-muted-foreground text-center">25 fields limit reached</p>
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
                Available variables
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
                      <span className="text-muted-foreground truncate">{botLang === "en" ? (v.descEn ?? v.desc) : v.desc}</span>
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
                {t("embeds_preview")} Discord
              </span>
            </button>
            {showPreview && (
              <div className="p-4">
                <DiscordPreview form={form} />
                <p className="text-[11px] text-muted-foreground italic mt-3">* {t("embeds_preview")}</p>
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
            <AlertDialogTitle>{t("embeds_reset")}?</AlertDialogTitle>
            <AlertDialogDescription>
              {t("embeds_reset")} &quot;{botLang === "en" ? (currentEvent?.labelEn ?? currentEvent?.label) : currentEvent?.label}&quot;
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("reset")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
      )}
    </div>
  );
}
