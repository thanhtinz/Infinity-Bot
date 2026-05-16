import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { ChannelSelect, MultiChannelSelect } from "@/components/ChannelSelect";
import { EmojiPicker } from "@/components/EmojiPicker";
import {
  ArrowLeft,
  Terminal,
  Plus,
  X,
  Type,
  Layout,
  Hash,
  Variable,
  ChevronDown,
  ChevronRight,
  Shield,
  Wrench,
  ListPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CustomCommand, EmbedField } from "./ccTypes";
import {
  VARIABLE_GROUPS,
  PRESET_COLORS,
  DEFAULT_COLOR,
  emptyEmbed,
  emptyField,
  emptyForm,
} from "./ccConstants";
import type { CommandForm } from "./ccTypes";
import { VariablesReference } from "./VariablesReference";

export function CustomCommandEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !id;

  // ── Form state ──
  const [form, setForm] = useState<CommandForm>(emptyForm());
  const [aliasInput, setAliasInput] = useState("");
  const [varsOpen, setVarsOpen] = useState(false);
  const [focusedInput, setFocusedInput] = useState<"text" | "embed_desc" | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [advOpts2Open, setAdvOpts2Open] = useState(false);
  const [addRespOpen, setAddRespOpen] = useState(false);

  // ── Fetch command if editing ──
  const { isLoading } = useQuery<CustomCommand[]>({
    queryKey: ["custom-commands"],
    queryFn: () =>
      fetch("/api/custom-commands", { credentials: "include" }).then((r) =>
        r.json()
      ),
    enabled: !isNew,
    staleTime: 60_000,
  });

  // Populate form when data arrives for editing
  const [populated, setPopulated] = useState(false);
  if (!isNew && !populated) {
    const commands = qc.getQueryData<CustomCommand[]>(["custom-commands"]);
    const cmd = commands?.find((c) => String(c.id) === id);
    if (cmd) {
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
              footer: cmd.response_embed.footer ?? "",
              thumbnail_url: cmd.response_embed.thumbnail_url ?? "",
              image_url: cmd.response_embed.image_url ?? "",
              author: cmd.response_embed.author ?? "",
            }
          : emptyEmbed(),
        ephemeral: cmd.ephemeral ?? false,
        required_roles: cmd.required_roles ?? [],
        enabled: cmd.enabled ?? true,
        aliases: cmd.aliases ?? [],
        cooldown: cmd.cooldown ?? 0,
        allowed_channels: cmd.allowed_channels ?? [],
        delete_trigger: cmd.delete_trigger ?? false,
        auto_react: cmd.auto_react ?? "",
        silent: cmd.silent ?? false,
        dm_response: cmd.dm_response ?? false,
        no_everyone: cmd.no_everyone ?? false,
        allowed_roles: cmd.allowed_roles ?? [],
        ignored_roles: cmd.ignored_roles ?? [],
        ignored_channels: cmd.ignored_channels ?? [],
        response_channel_id: cmd.response_channel_id ?? "",
        delete_after: cmd.delete_after ?? 0,
        required_args: cmd.required_args ?? 0,
        additional_responses: cmd.additional_responses ?? [],
      });
      setPopulated(true);
    }
  }

  // ── Mutations ──
  const createMutation = useMutation<any, Error, Record<string, unknown>>({
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
      navigate("/custom-commands");
      toast({ title: "Đã tạo command thành công" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi tạo command",
        description: e.message,
      }),
  });

  const updateMutation = useMutation<any, Error, { id: number } & Record<string, unknown>>({
    mutationFn: ({ id: cmdId, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/custom-commands/${cmdId}`, {
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
      navigate("/custom-commands");
      toast({ title: "Đã cập nhật command" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật",
        description: e.message,
      }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Handlers ──
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
      aliases: form.aliases,
      cooldown: form.cooldown,
      allowed_channels: form.allowed_channels,
      delete_trigger: form.delete_trigger,
      auto_react: form.auto_react || null,
      silent: form.silent,
      dm_response: form.dm_response,
      no_everyone: form.no_everyone,
      allowed_roles: form.allowed_roles,
      ignored_roles: form.ignored_roles,
      ignored_channels: form.ignored_channels,
      response_channel_id: form.response_channel_id || null,
      delete_after: form.delete_after,
      required_args: form.required_args,
      additional_responses: form.additional_responses,
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

  // ── Alias helpers ──
  const addAlias = () => {
    const trimmed = aliasInput.trim().toLowerCase().replace(/\s/g, "");
    if (trimmed && !form.aliases.includes(trimmed)) {
      setForm((p) => ({ ...p, aliases: [...p.aliases, trimmed] }));
    }
    setAliasInput("");
  };

  const removeAlias = (alias: string) => {
    setForm((p) => ({ ...p, aliases: p.aliases.filter((a) => a !== alias) }));
  };

  const handleAliasKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addAlias();
    }
  };

  // ── Channel helpers ──
  const addChannel = (chId: string) => {
    if (chId && !form.allowed_channels.includes(chId)) {
      setForm((p) => ({ ...p, allowed_channels: [...p.allowed_channels, chId] }));
    }
  };

  const removeChannel = (chId: string) => {
    setForm((p) => ({
      ...p,
      allowed_channels: p.allowed_channels.filter((c) => c !== chId),
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
        <Button variant="ghost" size="icon" onClick={() => navigate("/custom-commands")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold">
          {isNew ? "Tạo Custom Command" : "Chỉnh sửa Command"}
        </h1>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* ── Section: Basic Info ── */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5" />
            Thông tin cơ bản
          </p>

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
        </div>

        <Separator />

        {/* ── Section: Response ── */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Layout className="h-3.5 w-3.5" />
            Phản hồi
          </p>

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

              {/* Embed extras: Author, Footer, Thumbnail, Image */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Tùy chọn thêm</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Author</Label>
                    <Input
                      value={form.response_embed.author}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          response_embed: {
                            ...p.response_embed,
                            author: e.target.value,
                          },
                        }))
                      }
                      placeholder="Tên tác giả"
                      className="h-8 text-sm"
                    />
                  </div>
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
        </div>

        <Separator />

        {/* ── Section: Variables Reference ── */}
        <VariablesReference />

        <Separator />

        {/* ── Section: Settings ── */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Variable className="h-3.5 w-3.5" />
            Cài đặt
          </p>

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

          <Separator />

          {/* ── Cài đặt nâng cao (collapsible) ── */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {advancedOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Cài đặt nâng cao
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              {/* Aliases */}
              <div className="space-y-2">
                <Label>Tên thay thế (Aliases)</Label>
                <div className="flex flex-wrap gap-1.5 min-h-[28px] p-2 rounded-md border bg-background">
                  {form.aliases.map((alias) => (
                    <Badge
                      key={alias}
                      variant="secondary"
                      className="gap-1 text-xs font-mono"
                    >
                      !{alias}
                      <button
                        type="button"
                        onClick={() => removeAlias(alias)}
                        className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                  <input
                    value={aliasInput}
                    onChange={(e) => setAliasInput(e.target.value)}
                    onKeyDown={handleAliasKeyDown}
                    onBlur={aliasInput.trim() ? addAlias : undefined}
                    placeholder={form.aliases.length === 0 ? "Nhập alias rồi nhấn Enter..." : "Thêm..."}
                    className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Tên gọi khác cho lệnh này. VD: thêm "hi" để !hi cũng hoạt động như !{form.name || "command"}
                </p>
              </div>

              {/* Cooldown */}
              <div className="space-y-2">
                <Label>Cooldown</Label>
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
                <p className="text-[11px] text-muted-foreground">
                  Thời gian chờ giữa mỗi lần dùng (0 = không giới hạn)
                </p>
              </div>

              {/* Allowed Channels */}
              <div className="space-y-2">
                <Label>Giới hạn kênh</Label>
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
                          onClick={() => removeChannel(chId)}
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
                  onChange={addChannel}
                  placeholder="Chọn kênh để thêm..."
                />
                <p className="text-[11px] text-muted-foreground">
                  Để trống = cho phép tất cả kênh
                </p>
              </div>

              {/* Delete Trigger */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Xóa tin nhắn lệnh</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Xóa tin nhắn !command sau khi phản hồi
                  </p>
                </div>
                <Switch
                  checked={form.delete_trigger}
                  onCheckedChange={(checked) =>
                    setForm((p) => ({ ...p, delete_trigger: checked }))
                  }
                />
              </div>

              {/* Auto React */}
              <div className="space-y-2">
                <Label>Tự động react</Label>
                <div className="flex items-center gap-2">
                  <EmojiPicker
                    onSelect={(emoji) =>
                      setForm((p) => ({ ...p, auto_react: emoji }))
                    }
                  />
                  {form.auto_react && (
                    <span className="text-lg">{form.auto_react}</span>
                  )}
                  {form.auto_react && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() =>
                        setForm((p) => ({ ...p, auto_react: "" }))
                      }
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Emoji react vào tin nhắn phản hồi
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <Separator />

        {/* ── Section: Options ── */}
        <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
          <CollapsibleTrigger asChild>
            <button type="button" className="flex items-center justify-between w-full">
              <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" />
                Options
              </p>
              {optionsOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            {/* Delete Command */}
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={form.delete_trigger}
                onCheckedChange={(v) => setForm((p) => ({ ...p, delete_trigger: !!v }))}
              />
              <div className="flex-1 space-y-0.5">
                <Label className="text-sm font-medium">Delete Command</Label>
                <p className="text-[11px] text-muted-foreground">Xóa tin nhắn !command của user sau khi bot phản hồi</p>
              </div>
            </div>

            {/* Silent Command */}
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={form.silent}
                onCheckedChange={(v) => setForm((p) => ({ ...p, silent: !!v }))}
              />
              <div className="flex-1 space-y-0.5">
                <Label className="text-sm font-medium">Silent Command</Label>
                <p className="text-[11px] text-muted-foreground">Chỉ thực thi lệnh, không gửi phản hồi cho user</p>
              </div>
            </div>

            {/* DM Response */}
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={form.dm_response}
                onCheckedChange={(v) => setForm((p) => ({ ...p, dm_response: !!v }))}
              />
              <div className="flex-1 space-y-0.5">
                <Label className="text-sm font-medium">DM Response</Label>
                <p className="text-[11px] text-muted-foreground">Gửi phản hồi qua DM thay vì channel</p>
              </div>
            </div>

            {/* Disable pings */}
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={form.no_everyone}
                onCheckedChange={(v) => setForm((p) => ({ ...p, no_everyone: !!v }))}
              />
              <div className="flex-1 space-y-0.5">
                <Label className="text-sm font-medium">Disable @everyone, @here and role pings</Label>
                <p className="text-[11px] text-muted-foreground">Vô hiệu hóa các ping trong phản hồi</p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* ── Section: Permissions ── */}
        <Collapsible open={permOpen} onOpenChange={setPermOpen}>
          <CollapsibleTrigger asChild>
            <button type="button" className="flex items-center justify-between w-full">
              <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Permissions
              </p>
              {permOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
          <div className="grid grid-cols-1 gap-4">
            {/* Allowed Roles */}
            <div className="space-y-2">
              <Label>Allowed Roles</Label>
              <MultiRoleSelect
                value={form.allowed_roles}
                onChange={(roles) => setForm((p) => ({ ...p, allowed_roles: roles }))}
                placeholder="Roles được phép dùng (để trống = tất cả)..."
              />
            </div>

            {/* Ignored Roles */}
            <div className="space-y-2">
              <Label>Ignored Roles</Label>
              <MultiRoleSelect
                value={form.ignored_roles}
                onChange={(roles) => setForm((p) => ({ ...p, ignored_roles: roles }))}
                placeholder="Roles bị chặn..."
              />
            </div>

            {/* Allowed Channels */}
            <div className="space-y-2">
              <Label>Allowed Channels</Label>
              <MultiChannelSelect
                value={form.allowed_channels}
                onChange={(chs) => setForm((p) => ({ ...p, allowed_channels: chs }))}
                placeholder="Channels được phép (để trống = tất cả)..."
              />
            </div>

            {/* Ignored Channels */}
            <div className="space-y-2">
              <Label>Ignored Channels</Label>
              <MultiChannelSelect
                value={form.ignored_channels}
                onChange={(chs) => setForm((p) => ({ ...p, ignored_channels: chs }))}
                placeholder="Channels bị chặn..."
              />
            </div>

            {/* Response Channel */}
            <div className="space-y-2">
              <Label>Response Channel</Label>
              <ChannelSelect
                filter="text"
                value={form.response_channel_id}
                onChange={(chId) => setForm((p) => ({ ...p, response_channel_id: chId }))}
                placeholder="Override kênh bot phản hồi..."
              />
              <p className="text-[11px] text-muted-foreground">Để trống = phản hồi trong kênh user gọi lệnh</p>
            </div>
          </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* ── Section: Advanced Options ── */}
        <Collapsible open={advOpts2Open} onOpenChange={setAdvOpts2Open}>
          <CollapsibleTrigger asChild>
            <button type="button" className="flex items-center justify-between w-full">
              <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" />
                Advanced Options (optional)
              </p>
              {advOpts2Open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Cooldown (seconds)
              </Label>
              <Input
                type="number"
                min={0}
                value={form.cooldown}
                onChange={(e) => setForm((p) => ({ ...p, cooldown: Math.max(0, parseInt(e.target.value) || 0) }))}
                placeholder="2"
              />
            </div>
            <div className="space-y-2">
              <Label>Delete After (seconds)</Label>
              <Input
                type="number"
                min={0}
                value={form.delete_after}
                onChange={(e) => setForm((p) => ({ ...p, delete_after: Math.max(0, parseInt(e.target.value) || 0) }))}
                placeholder="10"
              />
              <p className="text-[11px] text-muted-foreground">0 = không tự xóa</p>
            </div>
            <div className="space-y-2">
              <Label>Required Arguments</Label>
              <Input
                type="number"
                min={0}
                value={form.required_args}
                onChange={(e) => setForm((p) => ({ ...p, required_args: Math.max(0, parseInt(e.target.value) || 0) }))}
                placeholder="1"
              />
              <p className="text-[11px] text-muted-foreground">Số $N tối thiểu</p>
            </div>
          </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* ── Section: Additional Responses ── */}
        <Collapsible open={addRespOpen} onOpenChange={setAddRespOpen}>
          <CollapsibleTrigger asChild>
            <button type="button" className="flex items-center justify-between w-full">
              <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <ListPlus className="h-3.5 w-3.5" />
                Additional Responses (optional)
              </p>
              {addRespOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
        <div className="space-y-4">

          {form.additional_responses.length > 0 && (
            <div className="space-y-3">
              {form.additional_responses.map((resp, idx) => (
                <div key={idx} className="rounded-lg border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({
                          ...p,
                          additional_responses: p.additional_responses.map((r, i) =>
                            i === idx ? { ...r, type: "text" } : r
                          ),
                        }))}
                        className={cn(
                          "rounded px-2 py-0.5 text-xs border transition-colors",
                          resp.type === "text" ? "bg-foreground text-background border-foreground" : "border-input hover:bg-muted"
                        )}
                      >
                        Text
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({
                          ...p,
                          additional_responses: p.additional_responses.map((r, i) =>
                            i === idx ? { ...r, type: "embed" } : r
                          ),
                        }))}
                        className={cn(
                          "rounded px-2 py-0.5 text-xs border transition-colors",
                          resp.type === "embed" ? "bg-foreground text-background border-foreground" : "border-input hover:bg-muted"
                        )}
                      >
                        Embed
                      </button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => setForm((p) => ({
                        ...p,
                        additional_responses: p.additional_responses.filter((_, i) => i !== idx),
                      }))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {resp.type === "text" ? (
                    <Textarea
                      value={resp.content ?? ""}
                      onChange={(e) => setForm((p) => ({
                        ...p,
                        additional_responses: p.additional_responses.map((r, i) =>
                          i === idx ? { ...r, content: e.target.value } : r
                        ),
                      }))}
                      placeholder="Nội dung phản hồi thêm..."
                      rows={3}
                    />
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={resp.embed?.title ?? ""}
                        onChange={(e) => setForm((p) => ({
                          ...p,
                          additional_responses: p.additional_responses.map((r, i) =>
                            i === idx ? { ...r, embed: { ...emptyEmbed(), ...r.embed, title: e.target.value } } : r
                          ),
                        }))}
                        placeholder="Tiêu đề embed"
                      />
                      <Textarea
                        value={resp.embed?.description ?? ""}
                        onChange={(e) => setForm((p) => ({
                          ...p,
                          additional_responses: p.additional_responses.map((r, i) =>
                            i === idx ? { ...r, embed: { ...emptyEmbed(), ...r.embed, description: e.target.value } } : r
                          ),
                        }))}
                        placeholder="Mô tả embed"
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setForm((p) => ({
                ...p,
                additional_responses: [...p.additional_responses, { type: "text", content: "" }],
              }))}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Response
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setForm((p) => ({
                ...p,
                additional_responses: [...p.additional_responses, { type: "embed", embed: emptyEmbed() }],
              }))}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Embed Response
            </Button>
          </div>
        </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
