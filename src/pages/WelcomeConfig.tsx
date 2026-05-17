import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import type { ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChannelSelect } from "@/components/ChannelSelect";
import { EmojiPicker } from "@/components/EmojiPicker";
import { HandMetal, LogOut, MessageSquare, UserCog, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WelcomeConfigData {
  welcome_enabled: boolean;
  welcome_channel_id: string;
  welcome_message: string;
  welcome_embed_enabled: boolean;
  welcome_dm_enabled: boolean;
  welcome_dm_message: string;
  goodbye_enabled: boolean;
  goodbye_channel_id: string;
  goodbye_message: string;
  goodbye_embed_enabled: boolean;
  auto_nickname_template: string;
}

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

interface EmbedFormState {
  existingId?: number;
  title: string;
  description: string;
  color: string;
  footer: string;
  fields: EmbedField[];
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const WELCOME_DEFAULT: EmbedFormState = {
  title: "👋 Welcome to {server}!",
  description:
    "Hello {user.mention}! Hope you enjoy your time in the server.\n\nUse `/help` to see the command listd bot.",
  color: "#5865F2",
  footer: "Infinity Mall",
  fields: [{ name: "Member #", value: "{member_count}", inline: true }],
};

const GOODBYE_DEFAULT: EmbedFormState = {
  title: "👋 Goodbye",
  description: "**{user}** has left the server.",
  color: "#95A5A6",
  footer: "{member_count} members remaining",
  fields: [],
};

// ─── Variable substitution ───────────────────────────────────────────────────

const VAR_MAP: Record<string, string> = {
  "{user.mention}": "@Users",
  "{user}": "Users",
  "{server}": "Name Server",
  "{member_count}": "1,234",
  "{user.id}": "123456789",
};

function substituteVars(text: string): string {
  let result = text;
  for (const [key, val] of Object.entries(VAR_MAP)) {
    result = result.replaceAll(key, val);
  }
  return result;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchConfig(): Promise<WelcomeConfigData> {
  const res = await apiFetch("/api/welcome/config");
  if (!res.ok) throw new Error("Failed to load config");
  return res.json();
}

async function saveConfig(data: WelcomeConfigData): Promise<{ ok: boolean }> {
  const res = await apiFetch("/api/welcome/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Save failed");
  return res.json();
}

async function saveEmbed(
  form: EmbedFormState,
  eventType: string,
): Promise<EmbedTemplate> {
  const body = {
    event_type: eventType,
    name: eventType === "welcome" ? "Welcome Embed" : "Goodbye Embed",
    title: form.title,
    description: form.description,
    color: form.color,
    author: "",
    author_icon_url: "",
    footer: form.footer,
    thumbnail_url: "",
    image_url: "",
    fields: form.fields,
    enabled: true,
  };
  if (form.existingId) {
    const res = await apiFetch(`/api/embeds/${form.existingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Save embed failed");
    return res.json();
  } else {
    const res = await apiFetch("/api/embeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Save embed failed");
    return res.json();
  }
}

// ─── Discord Preview ─────────────────────────────────────────────────────────

function DiscordEmbedPreview({ form }: { form: EmbedFormState }) {
  const colorHex = form.color || "#5865F2";
  const hasContent = form.title || form.description || form.fields.length > 0 || form.footer;

  if (!hasContent) return null;

  return (
    <div className="rounded-md bg-[#313338] p-4 flex gap-3">
      {/* Color bar */}
      <div
        className="w-1 shrink-0 rounded-full"
        style={{ backgroundColor: colorHex }}
      />
      <div className="flex-1 min-w-0 space-y-2">
        {/* Title */}
        {form.title && (
          <p className="font-semibold text-[#F2F3F5] text-sm leading-snug">
            {substituteVars(form.title)}
          </p>
        )}
        {/* Description */}
        {form.description && (
          <p className="text-[#B5BAC1] text-sm whitespace-pre-wrap leading-snug">
            {substituteVars(form.description)}
          </p>
        )}
        {/* Fields */}
        {form.fields.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
            {form.fields.map((f, i) => (
              <div
                key={i}
                className={f.inline ? "" : "col-span-2"}
              >
                <p className="font-semibold text-[#F2F3F5] text-xs">
                  {substituteVars(f.name)}
                </p>
                <p className="text-[#B5BAC1] text-xs whitespace-pre-wrap">
                  {substituteVars(f.value)}
                </p>
              </div>
            ))}
          </div>
        )}
        {/* Footer */}
        {form.footer && (
          <p className="text-[#B5BAC1] text-[11px] pt-1">
            {substituteVars(form.footer)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Embed Editor ────────────────────────────────────────────────────────────

function EmbedEditor({
  form,
  onChange,
}: {
  form: EmbedFormState;
  onChange: (updater: (prev: EmbedFormState) => EmbedFormState) => void;
}) {
  const { t } = useT();
  const addField = () => {
    if (form.fields.length >= 10) return;
    onChange((prev) => ({
      ...prev,
      fields: [...prev.fields, { name: "", value: "", inline: false }],
    }));
  };

  const removeField = (idx: number) => {
    onChange((prev) => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== idx),
    }));
  };

  const updateField = (
    idx: number,
    key: keyof EmbedField,
    val: string | boolean,
  ) => {
    onChange((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) =>
        i === idx ? { ...f, [key]: val } : f,
      ),
    }));
  };

  return (
    <div className="space-y-4">
      {/* Color picker */}
      <div className="space-y-2">
        <Label>{t("welcome_embedColor")}</Label>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded border shrink-0"
            style={{ backgroundColor: form.color || "#5865F2" }}
          />
          <Input
            value={form.color ?? "#5865F2"}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange((prev) => ({ ...prev, color: e.target.value }))
            }
            placeholder="#5865F2"
            className="w-32 font-mono text-sm"
          />
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label>{t("welcome_titleEmbed")}</Label>
        <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
          <Input
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={form.title ?? ""}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder={t("welcome_titleEmbed")}
          />
          <EmojiPicker onSelect={(em) => onChange((prev) => ({ ...prev, title: prev.title + em }))} />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>{t("welcome_descEmbed")}</Label>
        <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
          <Textarea
            value={form.description ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              onChange((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder={t("welcome_contentText")}
            rows={3}
            className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <EmojiPicker onSelect={(em) => onChange((prev) => ({ ...prev, description: prev.description + em }))} />
        </div>
        <p className="text-xs text-muted-foreground">
          Variables: {"{user.mention}"}, {"{user}"}, {"{server}"}, {"{member_count}"}, {"{user.id}"}
        </p>
      </div>

      {/* Footer */}
      <div className="space-y-2">
        <Label>{t("welcome_footerEmbed")}</Label>
        <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
          <Input
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={form.footer ?? ""}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange((prev) => ({ ...prev, footer: e.target.value }))
            }
            placeholder={t("welcome_footerEmbed")}
          />
          <EmojiPicker onSelect={(em) => onChange((prev) => ({ ...prev, footer: prev.footer + em }))} />
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t("welcome_fields")}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addField}
            disabled={form.fields.length >= 10}
          >
            <Plus className="w-3 h-3 mr-1" /> {t("welcome_addField")}
          </Button>
        </div>
        {form.fields.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("welcome_noFields")}</p>
        )}
        <div className="space-y-3">
          {form.fields.map((field, idx) => (
            <div
              key={idx}
              className="rounded-lg border p-3 space-y-2 bg-muted/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Field {idx + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive"
                  onClick={() => removeField(idx)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                <Input
                  value={field.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateField(idx, "name", e.target.value)
                  }
                  placeholder={t("welcome_fieldName")}
                  className="text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <EmojiPicker onSelect={(em) => updateField(idx, "name", field.name + em)} />
              </div>
              <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                <Textarea
                  value={field.value}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    updateField(idx, "value", e.target.value)
                  }
                  placeholder={t("welcome_fieldValue")}
                  rows={2}
                  className="text-sm flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <EmojiPicker onSelect={(em) => updateField(idx, "value", field.value + em)} />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={field.inline}
                  onCheckedChange={(val: boolean) =>
                    updateField(idx, "inline", val)
                  }
                />
                <Label className="text-xs">{t("welcome_inline")}</Label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t("welcome_preview")}</Label>
        <DiscordEmbedPreview form={form} />
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WelcomeConfig() {
  const { t } = useT();
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Queries ──
  const { data, isLoading } = useQuery({
    queryKey: ["welcome_config"],
    queryFn: fetchConfig,
    staleTime: 60_000,
  });

  const { data: embeds = [] } = useQuery<EmbedTemplate[]>({
    queryKey: ["embeds"],
    queryFn: () =>
      apiFetch("/api/embeds").then((r) => r.json()),
    staleTime: 60_000,
  });

  const savedEmbedMap = useMemo(() => {
    const m = new Map<string, EmbedTemplate>();
    for (const e of embeds) m.set(e.event_type, e);
    return m;
  }, [embeds]);

  // ── Config form state ──
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [welcomeChannelId, setWelcomeChannelId] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [welcomeEmbedEnabled, setWelcomeEmbedEnabled] = useState(false);
  const [welcomeDmEnabled, setWelcomeDmEnabled] = useState(false);
  const [welcomeDmMessage, setWelcomeDmMessage] = useState("");
  const [goodbyeEnabled, setGoodbyeEnabled] = useState(false);
  const [goodbyeChannelId, setGoodbyeChannelId] = useState("");
  const [goodbyeMessage, setGoodbyeMessage] = useState("");
  const [goodbyeEmbedEnabled, setGoodbyeEmbedEnabled] = useState(false);
  const [autoNicknameTemplate, setAutoNicknameTemplate] = useState("");

  // ── Embed form state ──
  const [welcomeEmbedForm, setWelcomeEmbedForm] =
    useState<EmbedFormState>(WELCOME_DEFAULT);
  const [goodbyeEmbedForm, setGoodbyeEmbedForm] =
    useState<EmbedFormState>(GOODBYE_DEFAULT);

  // ── Hydrate from API data ──
  useEffect(() => {
    if (data) {
      setWelcomeEnabled(data.welcome_enabled ?? false);
      setWelcomeChannelId(data.welcome_channel_id || "");
      setWelcomeMessage(data.welcome_message || "");
      setWelcomeEmbedEnabled(data.welcome_embed_enabled ?? false);
      setWelcomeDmEnabled(data.welcome_dm_enabled ?? false);
      setWelcomeDmMessage(data.welcome_dm_message || "");
      setGoodbyeEnabled(data.goodbye_enabled ?? false);
      setGoodbyeChannelId(data.goodbye_channel_id || "");
      setGoodbyeMessage(data.goodbye_message || "");
      setGoodbyeEmbedEnabled(data.goodbye_embed_enabled ?? false);
      setAutoNicknameTemplate(data.auto_nickname_template || "");
    }
  }, [data]);

  useEffect(() => {
    const welcomeSaved = savedEmbedMap.get("welcome");
    if (welcomeSaved) {
      setWelcomeEmbedForm({
        existingId: welcomeSaved.id,
        title: welcomeSaved.title ?? "",
        description: welcomeSaved.description ?? "",
        color: welcomeSaved.color ?? "#5865F2",
        footer: welcomeSaved.footer ?? "",
        fields: welcomeSaved.fields.map((f) => ({ ...f })),
      });
    }
  }, [savedEmbedMap]);

  useEffect(() => {
    const goodbyeSaved = savedEmbedMap.get("goodbye");
    if (goodbyeSaved) {
      setGoodbyeEmbedForm({
        existingId: goodbyeSaved.id,
        title: goodbyeSaved.title ?? "",
        description: goodbyeSaved.description ?? "",
        color: goodbyeSaved.color ?? "#ED4245",
        footer: goodbyeSaved.footer ?? "",
        fields: goodbyeSaved.fields.map((f) => ({ ...f })),
      });
    }
  }, [savedEmbedMap]);

  // ── Save mutation ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const promises: Promise<unknown>[] = [];

      // 1. Save config
      promises.push(
        saveConfig({
          welcome_enabled: welcomeEnabled,
          welcome_channel_id: welcomeChannelId,
          welcome_message: welcomeMessage,
          welcome_embed_enabled: welcomeEmbedEnabled,
          welcome_dm_enabled: welcomeDmEnabled,
          welcome_dm_message: welcomeDmMessage,
          goodbye_enabled: goodbyeEnabled,
          goodbye_channel_id: goodbyeChannelId,
          goodbye_message: goodbyeMessage,
          goodbye_embed_enabled: goodbyeEmbedEnabled,
          auto_nickname_template: autoNicknameTemplate,
        }),
      );

      // 2. Save welcome embed if enabled
      if (welcomeEmbedEnabled) {
        promises.push(saveEmbed(welcomeEmbedForm, "welcome"));
      }

      // 3. Save goodbye embed if enabled
      if (goodbyeEmbedEnabled) {
        promises.push(saveEmbed(goodbyeEmbedForm, "goodbye"));
      }

      await Promise.all(promises);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["welcome_config"] });
      qc.invalidateQueries({ queryKey: ["embeds"] });
      toast({ title: t("toast_saved") });
    },
    onError: () => {
      toast({ variant: "destructive", title: t("error"), description: t("toast_saveFailed") });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <HandMetal className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{t("welcome_title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("welcome_title")}
          </p>
        </div>
      </div>

      {/* ── Welcome Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" /> {t("welcome_enable")}
          </CardTitle>
          <CardDescription>
            {t("welcome_enable")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{t("welcome_enable")}</p>
              <p className="text-sm text-muted-foreground">{t("welcome_enable")}</p>
            </div>
            <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
          </div>

          <div className="space-y-2">
            <Label>{t("welcome_channel")}</Label>
            <ChannelSelect
              value={welcomeChannelId}
              onChange={setWelcomeChannelId}
              filter="text"
              placeholder={t("selectChannel")}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{t("welcome_useEmbed")}</p>
              <p className="text-sm text-muted-foreground">{t("welcome_useEmbed")}</p>
            </div>
            <Switch checked={welcomeEmbedEnabled} onCheckedChange={setWelcomeEmbedEnabled} />
          </div>

          {welcomeEmbedEnabled ? (
            <EmbedEditor form={welcomeEmbedForm} onChange={setWelcomeEmbedForm} />
          ) : (
            <div className="space-y-2">
              <Label>{t("welcome_message")}</Label>
              <Textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Welcome {username} to {server}! 🎉"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Available: {"{username}"}, {"{server}"}, {"{mention}"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Welcome DM Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" /> {t("welcome_dmContent")}
          </CardTitle>
          <CardDescription>
            {t("welcome_enableDm")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{t("welcome_enableDm")}</p>
              <p className="text-sm text-muted-foreground">{t("welcome_enableDm")}</p>
            </div>
            <Switch checked={welcomeDmEnabled} onCheckedChange={setWelcomeDmEnabled} />
          </div>

          <div className="space-y-2">
            <Label>{t("welcome_dmContent")}</Label>
            <Textarea
              value={welcomeDmMessage}
              onChange={(e) => setWelcomeDmMessage(e.target.value)}
              placeholder="Hi {username}, welcome to {server}!"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Available: {"{username}"}, {"{server}"}, {"{mention}"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Goodbye Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LogOut className="w-4 h-4" /> {t("welcome_goodbye")}
          </CardTitle>
          <CardDescription>
            {t("welcome_goodbye")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{t("welcome_goodbye")}</p>
              <p className="text-sm text-muted-foreground">{t("welcome_goodbye")}</p>
            </div>
            <Switch checked={goodbyeEnabled} onCheckedChange={setGoodbyeEnabled} />
          </div>

          <div className="space-y-2">
            <Label>{t("welcome_goodbyeChannel")}</Label>
            <ChannelSelect
              value={goodbyeChannelId}
              onChange={setGoodbyeChannelId}
              filter="text"
              placeholder={t("selectChannel")}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{t("welcome_useEmbed")}</p>
              <p className="text-sm text-muted-foreground">{t("welcome_useEmbed")}</p>
            </div>
            <Switch checked={goodbyeEmbedEnabled} onCheckedChange={setGoodbyeEmbedEnabled} />
          </div>

          {goodbyeEmbedEnabled ? (
            <EmbedEditor form={goodbyeEmbedForm} onChange={setGoodbyeEmbedForm} />
          ) : (
            <div className="space-y-2">
              <Label>{t("welcome_goodbyeMessage")}</Label>
              <Textarea
                value={goodbyeMessage}
                onChange={(e) => setGoodbyeMessage(e.target.value)}
                placeholder="{username} has left {server}. 👋"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Available: {"{username}"}, {"{server}"}, {"{member_count}"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Auto Nickname Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCog className="w-4 h-4" /> {t("welcome_autoRole")}
          </CardTitle>
          <CardDescription>
            {t("welcome_autoRole")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>{t("welcome_autoRole")}</Label>
          <Input
            value={autoNicknameTemplate}
            onChange={(e) => setAutoNicknameTemplate(e.target.value)}
            placeholder={t("welcome_autoRole")}
          />
          <p className="text-xs text-muted-foreground">
            Available: {"{username}"}, {"{server}"}, {"{discriminator}"}
          </p>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full"
      >
        {saveMutation.isPending ? t("saving") : t("save")}
      </Button>
    </div>
  );
}
