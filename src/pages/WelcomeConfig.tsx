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
  title: "👋 Chào mừng đến với {server}!",
  description:
    "Xin chào {user.mention}! Chúc bạn có thời gian vui vẻ tại server.\n\nDùng `/help` để xem danh sách lệnh bot.",
  color: "#5865F2",
  footer: "Infinity Mall",
  fields: [{ name: "Thành viên thứ", value: "{member_count}", inline: true }],
};

const GOODBYE_DEFAULT: EmbedFormState = {
  title: "👋 Tạm biệt",
  description: "**{user}** đã rời khỏi server.",
  color: "#95A5A6",
  footer: "Còn lại {member_count} thành viên",
  fields: [],
};

// ─── Variable substitution ───────────────────────────────────────────────────

const VAR_MAP: Record<string, string> = {
  "{user.mention}": "@Người dùng",
  "{user}": "Người dùng",
  "{server}": "Tên Server",
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
  const res = await fetch("/api/welcome/config", { credentials: "include" });
  if (!res.ok) throw new Error("Tải cấu hình thất bại");
  return res.json();
}

async function saveConfig(data: WelcomeConfigData): Promise<{ ok: boolean }> {
  const res = await fetch("/api/welcome/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Lưu thất bại");
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
    const res = await fetch(`/api/embeds/${form.existingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Lưu embed thất bại");
    return res.json();
  } else {
    const res = await fetch("/api/embeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Lưu embed thất bại");
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
        <Label>Màu embed</Label>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded border shrink-0"
            style={{ backgroundColor: form.color || "#5865F2" }}
          />
          <Input
            value={form.color}
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
        <Label>Tiêu đề</Label>
        <div className="flex items-center gap-1">
          <Input
            value={form.title}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="Tiêu đề embed"
          />
          <EmojiPicker onSelect={(em) => onChange((prev) => ({ ...prev, title: prev.title + em }))} />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>Mô tả</Label>
        <div className="flex items-start gap-1">
          <Textarea
            value={form.description}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              onChange((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Nội dung embed..."
            rows={3}
            className="flex-1"
          />
          <EmojiPicker onSelect={(em) => onChange((prev) => ({ ...prev, description: prev.description + em }))} />
        </div>
        <p className="text-xs text-muted-foreground">
          Biến: {"{user.mention}"}, {"{user}"}, {"{server}"}, {"{member_count}"}, {"{user.id}"}
        </p>
      </div>

      {/* Footer */}
      <div className="space-y-2">
        <Label>Footer</Label>
        <div className="flex items-center gap-1">
          <Input
            value={form.footer}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange((prev) => ({ ...prev, footer: e.target.value }))
            }
            placeholder="Chữ footer..."
          />
          <EmojiPicker onSelect={(em) => onChange((prev) => ({ ...prev, footer: prev.footer + em }))} />
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Fields</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addField}
            disabled={form.fields.length >= 10}
          >
            <Plus className="w-3 h-3 mr-1" /> Thêm field
          </Button>
        </div>
        {form.fields.length === 0 && (
          <p className="text-xs text-muted-foreground">Chưa có field nào.</p>
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
              <div className="flex items-center gap-1">
                <Input
                  value={field.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateField(idx, "name", e.target.value)
                  }
                  placeholder="Tên field"
                  className="text-sm"
                />
                <EmojiPicker onSelect={(em) => updateField(idx, "name", field.name + em)} />
              </div>
              <div className="flex items-start gap-1">
                <Textarea
                  value={field.value}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    updateField(idx, "value", e.target.value)
                  }
                  placeholder="Giá trị field"
                  rows={2}
                  className="text-sm flex-1"
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
                <Label className="text-xs">Inline</Label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Xem trước</Label>
        <DiscordEmbedPreview form={form} />
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WelcomeConfig() {
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
      fetch("/api/embeds", { credentials: "include" }).then((r) => r.json()),
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
        title: welcomeSaved.title,
        description: welcomeSaved.description,
        color: welcomeSaved.color,
        footer: welcomeSaved.footer,
        fields: welcomeSaved.fields.map((f) => ({ ...f })),
      });
    }
  }, [savedEmbedMap]);

  useEffect(() => {
    const goodbyeSaved = savedEmbedMap.get("goodbye");
    if (goodbyeSaved) {
      setGoodbyeEmbedForm({
        existingId: goodbyeSaved.id,
        title: goodbyeSaved.title,
        description: goodbyeSaved.description,
        color: goodbyeSaved.color,
        footer: goodbyeSaved.footer,
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
      toast({ title: "Đã lưu" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Lỗi", description: "Lưu thất bại." });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Đang tải...</p>
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
          <h1 className="text-xl font-bold">Chào mừng & Tạm biệt</h1>
          <p className="text-sm text-muted-foreground">
            Cấu hình tin nhắn chào mừng thành viên mới và tạm biệt khi rời server.
          </p>
        </div>
      </div>

      {/* ── Welcome Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" /> Chào mừng
          </CardTitle>
          <CardDescription>
            Gửi tin nhắn chào mừng khi có thành viên mới tham gia server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Bật chào mừng</p>
              <p className="text-sm text-muted-foreground">Kích hoạt tin nhắn chào mừng.</p>
            </div>
            <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
          </div>

          <div className="space-y-2">
            <Label>Kênh chào mừng</Label>
            <ChannelSelect
              value={welcomeChannelId}
              onChange={setWelcomeChannelId}
              filter="text"
              placeholder="Chọn kênh..."
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Chế độ Embed</p>
              <p className="text-sm text-muted-foreground">Hiển thị tin nhắn dưới dạng embed.</p>
            </div>
            <Switch checked={welcomeEmbedEnabled} onCheckedChange={setWelcomeEmbedEnabled} />
          </div>

          {welcomeEmbedEnabled ? (
            <EmbedEditor form={welcomeEmbedForm} onChange={setWelcomeEmbedForm} />
          ) : (
            <div className="space-y-2">
              <Label>Tin nhắn chào mừng</Label>
              <Textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Chào mừng {username} đã tham gia {server}! 🎉"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Có dùng: {"{username}"}, {"{server}"}, {"{mention}"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Welcome DM Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" /> Chào mừng DM
          </CardTitle>
          <CardDescription>
            Gửi tin nhắn chào mừng trực tiếp (DM) cho thành viên mới.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Bật chào mừng DM</p>
              <p className="text-sm text-muted-foreground">Gửi tin nhắn riêng cho thành viên mới.</p>
            </div>
            <Switch checked={welcomeDmEnabled} onCheckedChange={setWelcomeDmEnabled} />
          </div>

          <div className="space-y-2">
            <Label>Tin nhắn DM</Label>
            <Textarea
              value={welcomeDmMessage}
              onChange={(e) => setWelcomeDmMessage(e.target.value)}
              placeholder="Chào {username}, cảm ơn bạn đã tham gia {server}!"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Có dùng: {"{username}"}, {"{server}"}, {"{mention}"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Goodbye Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LogOut className="w-4 h-4" /> Tạm biệt
          </CardTitle>
          <CardDescription>
            Gửi tin nhắn tạm biệt khi thành viên rời server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Bật tạm biệt</p>
              <p className="text-sm text-muted-foreground">Kích hoạt tin nhắn tạm biệt.</p>
            </div>
            <Switch checked={goodbyeEnabled} onCheckedChange={setGoodbyeEnabled} />
          </div>

          <div className="space-y-2">
            <Label>Kênh tạm biệt</Label>
            <ChannelSelect
              value={goodbyeChannelId}
              onChange={setGoodbyeChannelId}
              filter="text"
              placeholder="Chọn kênh..."
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Chế độ Embed</p>
              <p className="text-sm text-muted-foreground">Hiển thị tin nhắn dưới dạng embed.</p>
            </div>
            <Switch checked={goodbyeEmbedEnabled} onCheckedChange={setGoodbyeEmbedEnabled} />
          </div>

          {goodbyeEmbedEnabled ? (
            <EmbedEditor form={goodbyeEmbedForm} onChange={setGoodbyeEmbedForm} />
          ) : (
            <div className="space-y-2">
              <Label>Tin nhắn tạm biệt</Label>
              <Textarea
                value={goodbyeMessage}
                onChange={(e) => setGoodbyeMessage(e.target.value)}
                placeholder="{username} đã rời khỏi {server}. 👋"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Có dùng: {"{username}"}, {"{server}"}, {"{member_count}"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Auto Nickname Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCog className="w-4 h-4" /> Tự động đặt biệt danh
          </CardTitle>
          <CardDescription>
            Tự động đổi biệt danh cho thành viên khi tham gia server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Mẫu biệt danh</Label>
          <Input
            value={autoNicknameTemplate}
            onChange={(e) => setAutoNicknameTemplate(e.target.value)}
            placeholder="Để trống để tắt"
          />
          <p className="text-xs text-muted-foreground">
            Các biến có sẵn: {"{username}"}, {"{server}"}, {"{discriminator}"}
          </p>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full"
      >
        {saveMutation.isPending ? "Đang lưu..." : "Lưu cấu hình"}
      </Button>
    </div>
  );
}
