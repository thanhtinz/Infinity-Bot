import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { ChannelSelect } from "@/components/ChannelSelect";
import { EmojiPicker } from "@/components/EmojiPicker";
import {
  ArrowLeft,
  Plus,
  Trash2,
  X,
  Type,
  Layout,
  Clock,
  Hash,
  Smile,
  Variable,
  ChevronDown,
  ChevronRight,
  Zap,
  Filter,
  Settings2,
  Reply,
  Mail,
  Ban,
  Bot,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { AutoResponderRule, EmbedField } from "./arTypes";
import type { RuleForm } from "./arTypes";
import {
  TRIGGER_TYPE_CONFIG,
  PRESET_COLORS,
  DEFAULT_COLOR,
  VARIABLE_GROUPS,
  emptyEmbed,
  emptyField,
  emptyForm,
} from "./arConstants";

export function AutoResponderEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !id;

  // ── Form state ──
  const [form, setForm] = useState<RuleForm>(emptyForm());

  // Collapsible sections
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [restrictionsOpen, setRestrictionsOpen] = useState(false);
  const [varsOpen, setVarsOpen] = useState(false);
  const [focusedInput, setFocusedInput] = useState<"text" | "embed_desc" | null>(null);

  // ── Fetch rule if editing ──
  const { isLoading } = useQuery<AutoResponderRule[]>({
    queryKey: ["auto-responders"],
    queryFn: () =>
      fetch("/api/auto-responders", { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      }),
    enabled: !isNew,
    staleTime: 60_000,
  });

  // Populate form when data arrives for editing
  const [populated, setPopulated] = useState(false);
  if (!isNew && !populated) {
    const rules = qc.getQueryData<AutoResponderRule[]>(["auto-responders"]);
    const rule = rules?.find((r) => String(r.id) === id);
    if (rule) {
      setForm({
        name: rule.name ?? "",
        trigger_type: rule.trigger_type ?? "contains",
        trigger_text: rule.trigger_text ?? "",
        ignore_case: rule.ignore_case ?? true,
        response_type: rule.response_type ?? "text",
        response_text: rule.response_text ?? "",
        response_embed: rule.response_embed
          ? {
              title: rule.response_embed.title ?? "",
              description: rule.response_embed.description ?? "",
              color: rule.response_embed.color ?? DEFAULT_COLOR,
              footer: rule.response_embed.footer ?? "",
              image_url: rule.response_embed.image_url ?? "",
              thumbnail_url: rule.response_embed.thumbnail_url ?? "",
              author_name: rule.response_embed.author_name ?? "",
              author_icon_url: rule.response_embed.author_icon_url ?? "",
              fields: rule.response_embed.fields?.map((f) => ({ ...f })) ?? [],
            }
          : emptyEmbed(),
        reaction_emojis: rule.reaction_emojis ?? [],
        reply_to_message: rule.reply_to_message ?? false,
        delete_trigger: rule.delete_trigger ?? false,
        send_dm: rule.send_dm ?? false,
        cooldown: rule.cooldown ?? 0,
        cooldown_type: rule.cooldown_type ?? "per_user",
        allowed_channels: rule.allowed_channels ?? [],
        blocked_channels: rule.blocked_channels ?? [],
        allowed_roles: rule.allowed_roles ?? [],
        blocked_roles: rule.blocked_roles ?? [],
        ignore_bots: rule.ignore_bots ?? true,
        enabled: rule.enabled ?? true,
        priority: rule.priority ?? 0,
      });
      setPopulated(true);
    }
  }

  // ── Mutations ──
  const createMutation = useMutation<any, Error, Record<string, unknown>>({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/auto-responders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auto-responders"] });
      navigate("/autoresponder");
      toast({ title: "Đã tạo rule thành công" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi tạo rule",
        description: e.message,
      }),
  });

  const updateMutation = useMutation<any, Error, { id: number } & Record<string, unknown>>({
    mutationFn: ({ id: ruleId, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/auto-responders/${ruleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auto-responders"] });
      navigate("/autoresponder");
      toast({ title: "Đã cập nhật rule" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật",
        description: e.message,
      }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Derived ──
  const hasText = form.response_type === "text" || form.response_type === "text+react";
  const hasEmbed = form.response_type === "embed" || form.response_type === "embed+react";
  const hasReact = form.response_type === "react" || form.response_type === "text+react" || form.response_type === "embed+react";

  // ── Handlers ──
  const handleSave = () => {
    const body = {
      name: form.name,
      trigger_type: form.trigger_type,
      trigger_text: form.trigger_text,
      ignore_case: form.ignore_case,
      response_type: form.response_type,
      response_text: hasText ? form.response_text : null,
      response_embed: hasEmbed ? form.response_embed : null,
      reaction_emojis: hasReact ? form.reaction_emojis : [],
      reply_to_message: form.reply_to_message,
      delete_trigger: form.delete_trigger,
      send_dm: form.send_dm,
      cooldown: form.cooldown,
      cooldown_type: form.cooldown_type,
      allowed_channels: form.allowed_channels,
      blocked_channels: form.blocked_channels,
      allowed_roles: form.allowed_roles,
      blocked_roles: form.blocked_roles,
      ignore_bots: form.ignore_bots,
      enabled: form.enabled,
      priority: form.priority,
    };

    if (!isNew && id) {
      updateMutation.mutate({ id: Number(id), ...body });
    } else {
      createMutation.mutate(body);
    }
  };

  // ── Embed field helpers ──
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

  // ── Emoji helpers ──
  const addEmoji = (emoji: string) => {
    if (!form.reaction_emojis.includes(emoji)) {
      setForm((p) => ({ ...p, reaction_emojis: [...p.reaction_emojis, emoji] }));
    }
  };

  const removeEmoji = (emoji: string) => {
    setForm((p) => ({
      ...p,
      reaction_emojis: p.reaction_emojis.filter((e) => e !== emoji),
    }));
  };

  // ── Channel helpers ──
  const addAllowedChannel = (chId: string) => {
    if (chId && !form.allowed_channels.includes(chId)) {
      setForm((p) => ({ ...p, allowed_channels: [...p.allowed_channels, chId] }));
    }
  };

  const removeAllowedChannel = (chId: string) => {
    setForm((p) => ({
      ...p,
      allowed_channels: p.allowed_channels.filter((c) => c !== chId),
    }));
  };

  const addBlockedChannel = (chId: string) => {
    if (chId && !form.blocked_channels.includes(chId)) {
      setForm((p) => ({ ...p, blocked_channels: [...p.blocked_channels, chId] }));
    }
  };

  const removeBlockedChannel = (chId: string) => {
    setForm((p) => ({
      ...p,
      blocked_channels: p.blocked_channels.filter((c) => c !== chId),
    }));
  };

  // ── Variable insertion ──
  const insertVariable = (key: string) => {
    if (focusedInput === "text") {
      setForm((p) => ({ ...p, response_text: p.response_text + key }));
    } else if (focusedInput === "embed_desc") {
      setForm((p) => ({
        ...p,
        response_embed: { ...p.response_embed, description: p.response_embed.description + key },
      }));
    }
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/autoresponder")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold">
          {isNew ? "Tạo Auto Responder" : "Chỉnh sửa Auto Responder"}
        </h1>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* ═══════ Section 1: Trigger ═══════ */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Điều kiện kích hoạt
          </p>

          {/* Name */}
          <div className="space-y-2">
            <Label>Tên rule</Label>
            <Input
              value={form.name}
              onChange={(e) =>
                setForm((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="VD: Chào hỏi tự động"
            />
          </div>

          {/* Trigger type */}
          <div className="space-y-2">
            <Label>Loại điều kiện</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TRIGGER_TYPE_CONFIG) as AutoResponderRule["trigger_type"][]).map((type) => {
                const cfg = TRIGGER_TYPE_CONFIG[type];
                const Icon = cfg.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setForm((p) => ({ ...p, trigger_type: type }))
                    }
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 transition-all text-xs",
                      form.trigger_type === type
                        ? "border-foreground bg-foreground/5"
                        : "border-transparent bg-muted/30 hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trigger text */}
          <div className="space-y-2">
            <Label>Nội dung điều kiện</Label>
            <Input
              value={form.trigger_text}
              onChange={(e) =>
                setForm((p) => ({ ...p, trigger_text: e.target.value }))
              }
              placeholder={
                form.trigger_type === "regex"
                  ? "VD: ^hello\\s+world$"
                  : form.trigger_type === "wildcard"
                    ? "VD: hello*world"
                    : form.trigger_type === "exact"
                      ? "VD: xin chào"
                      : "VD: chào"
              }
            />
            <p className="text-[11px] text-muted-foreground">
              {TRIGGER_TYPE_CONFIG[form.trigger_type].helper}
            </p>
          </div>

          {/* Ignore case */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Bỏ qua hoa/thường</Label>
              <p className="text-[11px] text-muted-foreground">
                Không phân biệt chữ hoa và chữ thường
              </p>
            </div>
            <Switch
              checked={form.ignore_case}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, ignore_case: checked }))
              }
            />
          </div>
        </div>

        <Separator />

        {/* ═══════ Section 2: Response ═══════ */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Layout className="h-3.5 w-3.5" />
            Phản hồi
          </p>

          {/* Response type toggles */}
          <div className="space-y-2">
            <Label>Loại phản hồi</Label>
            <div className="flex flex-wrap gap-3">
              {([
                { key: "text" as const, label: "Text", icon: Type },
                { key: "embed" as const, label: "Embed", icon: Layout },
                { key: "react" as const, label: "Reaction", icon: Smile },
              ] as const).map(({ key, label, icon: Icon }) => {
                const active =
                  key === "text" ? hasText :
                  key === "embed" ? hasEmbed :
                  hasReact;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setForm((p) => {
                        let t = p.response_type === "react" && key !== "react" ? "" : p.response_type;
                        let text = t.includes("text");
                        let embed = t.includes("embed");
                        let react = t === "react" || t.includes("+react");
                        if (key === "text") { text = !text; if (text) embed = false; }
                        if (key === "embed") { embed = !embed; if (embed) text = false; }
                        if (key === "react") react = !react;
                        let newType: AutoResponderRule["response_type"] = "text";
                        if (text && react) newType = "text+react";
                        else if (embed && react) newType = "embed+react";
                        else if (text) newType = "text";
                        else if (embed) newType = "embed";
                        else if (react) newType = "react";
                        else newType = "text";
                        return { ...p, response_type: newType };
                      });
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 transition-all text-xs",
                      active
                        ? "border-foreground bg-foreground/5"
                        : "border-transparent bg-muted/30 hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Chọn nhiều loại cùng lúc. Text và Embed không thể bật đồng thời.
            </p>
          </div>

          {/* Variables Reference Panel */}
          <div className="rounded-lg border bg-muted/20">
            <button
              type="button"
              onClick={() => setVarsOpen(!varsOpen)}
              className="flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium hover:bg-muted/30 transition-colors rounded-lg"
            >
              <span className="flex items-center gap-2">
                <Variable className="h-4 w-4 text-indigo-500" />
                Biến số (Variables)
              </span>
              {varsOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {varsOpen && (
              <div className="px-3 pb-3 space-y-3">
                <p className="text-[11px] text-muted-foreground">
                  Nhấn vào biến để chèn vào nội dung. Click vào ô văn bản trước để chọn vị trí chèn.
                </p>
                {VARIABLE_GROUPS.map((group) => {
                  const Icon = group.icon;
                  return (
                    <div key={group.label} className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Icon className="h-3 w-3" />
                        {group.label}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {group.vars.map((v) => (
                          <button
                            key={v.key}
                            type="button"
                            onClick={() => insertVariable(v.key)}
                            className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-[11px] font-mono hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer"
                            title={v.desc}
                          >
                            {v.key}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Text response */}
          {hasText && (
            <div className="space-y-2">
              <Label>Nội dung phản hồi</Label>
              <Textarea
                value={form.response_text}
                onChange={(e) =>
                  setForm((p) => ({ ...p, response_text: e.target.value }))
                }
                onFocus={() => setFocusedInput("text")}
                placeholder="Nội dung bot sẽ gửi khi tin nhắn khớp điều kiện..."
                rows={5}
              />
            </div>
          )}

          {/* Embed response */}
          {hasEmbed && (
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
                  onFocus={() => setFocusedInput("embed_desc")}
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

              {/* Embed extras */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Tùy chọn thêm</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Author</Label>
                    <Input
                      value={form.response_embed.author_name}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          response_embed: {
                            ...p.response_embed,
                            author_name: e.target.value,
                          },
                        }))
                      }
                      placeholder="Tên tác giả"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Author Icon URL</Label>
                    <Input
                      value={form.response_embed.author_icon_url}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          response_embed: {
                            ...p.response_embed,
                            author_icon_url: e.target.value,
                          },
                        }))
                      }
                      placeholder="https://..."
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Footer</Label>
                    <Input
                      value={form.response_embed.footer}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          response_embed: {
                            ...p.response_embed,
                            footer: e.target.value,
                          },
                        }))
                      }
                      placeholder="Chân trang"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Thumbnail URL</Label>
                    <Input
                      value={form.response_embed.thumbnail_url}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          response_embed: {
                            ...p.response_embed,
                            thumbnail_url: e.target.value,
                          },
                        }))
                      }
                      placeholder="https://..."
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Image URL</Label>
                    <Input
                      value={form.response_embed.image_url}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          response_embed: {
                            ...p.response_embed,
                            image_url: e.target.value,
                          },
                        }))
                      }
                      placeholder="https://..."
                      className="h-8 text-sm"
                    />
                  </div>
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

          {/* Reaction emojis */}
          {hasReact && (
            <div className="space-y-2">
              <Label>Reaction emojis</Label>
              <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-md border bg-background">
                {form.reaction_emojis.map((emoji) => (
                  <Badge
                    key={emoji}
                    variant="secondary"
                    className="gap-1 text-sm pr-1"
                  >
                    {emoji}
                    <button
                      type="button"
                      onClick={() => removeEmoji(emoji)}
                      className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
                <EmojiPicker
                  onSelect={addEmoji}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Thêm
                  </Button>
                </EmojiPicker>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Chọn emoji để react vào tin nhắn gốc
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* ═══════ Section 3: Cài đặt (Collapsible) ═══════ */}
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {settingsOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <Settings2 className="h-3.5 w-3.5" />
              Cài đặt
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-3">
            {/* Reply to message */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5">
                  <Reply className="h-3.5 w-3.5" />
                  Reply tin nhắn
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Phản hồi dưới dạng reply tin nhắn gốc
                </p>
              </div>
              <Switch
                checked={form.reply_to_message}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, reply_to_message: checked }))
                }
              />
            </div>

            {/* Delete trigger */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa tin nhắn gốc
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Xóa tin nhắn kích hoạt sau khi phản hồi
                </p>
              </div>
              <Switch
                checked={form.delete_trigger}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, delete_trigger: checked }))
                }
              />
            </div>

            {/* Send DM */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Gửi DM
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Gửi phản hồi qua tin nhắn riêng thay vì kênh
                </p>
              </div>
              <Switch
                checked={form.send_dm}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, send_dm: checked }))
                }
              />
            </div>

            <Separator />

            {/* Cooldown */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Cooldown
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={form.cooldown}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      cooldown: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  placeholder="0 = không giới hạn"
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">giây</span>
              </div>
              <div className="flex gap-2 mt-1">
                {(["per_user", "per_channel", "global"] as const).map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, cooldown_type: ct }))}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs transition-all",
                      form.cooldown_type === ct
                        ? "border-foreground bg-foreground/5"
                        : "border-transparent bg-muted/30 hover:bg-muted/50"
                    )}
                  >
                    {ct === "per_user" ? "Per user" : ct === "per_channel" ? "Per channel" : "Global"}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Priority
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={form.priority}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      priority: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  placeholder="0"
                  className="w-28"
                />
                <span className="text-[11px] text-muted-foreground">
                  Cao hơn = ưu tiên hơn
                </span>
              </div>
            </div>

            {/* Enabled */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Kích hoạt</Label>
                <p className="text-[11px] text-muted-foreground">
                  Bật/tắt rule này
                </p>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, enabled: checked }))
                }
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* ═══════ Section 4: Giới hạn (Collapsible) ═══════ */}
        <Collapsible open={restrictionsOpen} onOpenChange={setRestrictionsOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {restrictionsOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <Filter className="h-3.5 w-3.5" />
              Giới hạn
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-3">
            {/* Allowed channels */}
            <div className="space-y-2">
              <Label>Kênh cho phép</Label>
              {form.allowed_channels.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.allowed_channels.map((chId) => (
                    <Badge
                      key={chId}
                      variant="secondary"
                      className="gap-1 text-xs"
                    >
                      <Hash className="h-2.5 w-2.5" />
                      {chId}
                      <button
                        type="button"
                        onClick={() => removeAllowedChannel(chId)}
                        className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <ChannelSelect
                filter="text"
                value=""
                onChange={addAllowedChannel}
                placeholder="Chọn kênh cho phép..."
              />
              <p className="text-[11px] text-muted-foreground">
                Để trống = cho phép tất cả kênh
              </p>
            </div>

            {/* Blocked channels */}
            <div className="space-y-2">
              <Label>Kênh chặn</Label>
              {form.blocked_channels.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.blocked_channels.map((chId) => (
                    <Badge
                      key={chId}
                      variant="secondary"
                      className="gap-1 text-xs"
                    >
                      <Ban className="h-2.5 w-2.5" />
                      {chId}
                      <button
                        type="button"
                        onClick={() => removeBlockedChannel(chId)}
                        className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <ChannelSelect
                filter="text"
                value=""
                onChange={addBlockedChannel}
                placeholder="Chọn kênh chặn..."
              />
            </div>

            <Separator />

            {/* Allowed roles */}
            <div className="space-y-2">
              <Label>Role cho phép</Label>
              <MultiRoleSelect
                value={form.allowed_roles}
                onChange={(roles) =>
                  setForm((p) => ({ ...p, allowed_roles: roles }))
                }
                placeholder="Chọn role cho phép..."
              />
            </div>

            {/* Blocked roles */}
            <div className="space-y-2">
              <Label>Role chặn</Label>
              <MultiRoleSelect
                value={form.blocked_roles}
                onChange={(roles) =>
                  setForm((p) => ({ ...p, blocked_roles: roles }))
                }
                placeholder="Chọn role chặn..."
              />
            </div>

            <Separator />

            {/* Ignore bots */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5" />
                  Bỏ qua bot
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Không kích hoạt khi tin nhắn từ bot
                </p>
              </div>
              <Switch
                checked={form.ignore_bots}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, ignore_bots: checked }))
                }
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
