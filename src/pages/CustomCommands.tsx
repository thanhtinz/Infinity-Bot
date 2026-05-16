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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { ChannelSelect, MultiChannelSelect } from "@/components/ChannelSelect";
import { EmojiPicker } from "@/components/EmojiPicker";
import {
  Terminal,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  X,
  Type,
  Layout,
  Clock,
  Hash,
  Smile,
  Copy,
  Check,
  Variable,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Shield,
  Wrench,
  ListPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

interface ResponseEmbed {
  title: string;
  description: string;
  color: string;
  fields: EmbedField[];
  footer?: string;
  thumbnail_url?: string;
  image_url?: string;
  author?: string;
}

interface AdditionalResponse {
  type: "text" | "embed";
  content?: string;
  embed?: ResponseEmbed;
}

interface CustomCommand {
  id: number;
  name: string;
  description: string;
  response_type: "text" | "embed";
  response_text: string;
  response_embed: ResponseEmbed;
  ephemeral: boolean;
  required_roles: string[];
  enabled: boolean;
  aliases: string[];
  cooldown: number;
  allowed_channels: string[];
  delete_trigger: boolean;
  auto_react: string | null;
  created_at: string;
  silent: boolean;
  dm_response: boolean;
  no_everyone: boolean;
  allowed_roles: string[];
  ignored_roles: string[];
  ignored_channels: string[];
  response_channel_id: string;
  delete_after: number;
  required_args: number;
  additional_responses: AdditionalResponse[];
}

interface CommandForm {
  name: string;
  description: string;
  response_type: "text" | "embed";
  response_text: string;
  response_embed: ResponseEmbed;
  ephemeral: boolean;
  required_roles: string[];
  enabled: boolean;
  aliases: string[];
  cooldown: number;
  allowed_channels: string[];
  delete_trigger: boolean;
  auto_react: string;
  silent: boolean;
  dm_response: boolean;
  no_everyone: boolean;
  allowed_roles: string[];
  ignored_roles: string[];
  ignored_channels: string[];
  response_channel_id: string;
  delete_after: number;
  required_args: number;
  additional_responses: AdditionalResponse[];
}

// ─── Variable Reference ──────────────────────────────────────────────────────

const VARIABLE_GROUPS: { label: string; icon: typeof Variable; vars: { key: string; desc: string }[] }[] = [
  {
    label: "Người dùng",
    icon: Variable,
    vars: [
      { key: "{user}", desc: "Username (VD: John#1234)" },
      { key: "{user.mention}", desc: "@mention" },
      { key: "{user.id}", desc: "User ID" },
      { key: "{user.name}", desc: "Username only" },
      { key: "{user.displayname}", desc: "Display name / Nickname" },
      { key: "{user.avatar}", desc: "Avatar URL" },
      { key: "{user.created_at}", desc: "Ngày tạo tài khoản" },
      { key: "{user.joined_at}", desc: "Ngày tham gia server" },
      { key: "{user.roles}", desc: "Tên các role" },
      { key: "{user.top_role}", desc: "Role cao nhất" },
      { key: "{user.top_role.mention}", desc: "Mention role cao nhất" },
    ],
  },
  {
    label: "Server",
    icon: Variable,
    vars: [
      { key: "{server}", desc: "Tên server" },
      { key: "{server.id}", desc: "Server ID" },
      { key: "{server.icon}", desc: "Server icon URL" },
      { key: "{server.owner}", desc: "Chủ server" },
      { key: "{member_count}", desc: "Số thành viên" },
      { key: "{server.boost_count}", desc: "Số boost" },
      { key: "{server.boost_level}", desc: "Boost tier" },
    ],
  },
  {
    label: "Channel",
    icon: Hash,
    vars: [
      { key: "{channel}", desc: "Channel mention" },
      { key: "{channel.name}", desc: "Tên channel" },
      { key: "{channel.id}", desc: "Channel ID" },
      { key: "{channel.topic}", desc: "Channel topic" },
    ],
  },
  {
    label: "Thời gian",
    icon: Clock,
    vars: [
      { key: "{date}", desc: "Ngày hiện tại (dd/mm/yyyy)" },
      { key: "{time}", desc: "Giờ hiện tại (HH:MM)" },
      { key: "{datetime}", desc: "Ngày + giờ" },
      { key: "{timestamp}", desc: "Discord timestamp" },
    ],
  },
  {
    label: "Khác",
    icon: Sparkles,
    vars: [
      { key: "{nl}", desc: "Xuống dòng mới" },
      { key: "{random_member}", desc: "Random member mention" },
      { key: "{&role}", desc: "Mention role theo tên" },
      { key: "{#channel}", desc: "Link channel theo tên" },
      { key: "{everyone}", desc: "Ping @everyone" },
      { key: "{here}", desc: "Ping @here" },
      { key: "$1", desc: "Argument 1" },
      { key: "$2", desc: "Argument 2" },
      { key: "$1+", desc: "Tất cả arguments từ 1" },
      { key: "{choose:opt1;opt2;opt3}", desc: "Chọn ngẫu nhiên" },
      { key: "{choice}", desc: "Giá trị đã chọn" },
      { key: "{noeveryone}", desc: "Vô hiệu hóa @everyone" },
      { key: "{delete}", desc: "Xóa tin nhắn trigger" },
      { key: "{silent}", desc: "Chỉ thực thi, không phản hồi" },
      { key: "{dm}", desc: "DM phản hồi cho user" },
      { key: "{prefix}", desc: "Prefix của bot" },
      { key: "{respond:#channel}", desc: "Override kênh phản hồi" },
    ],
  },
];

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

const emptyEmbed = (): ResponseEmbed => ({
  title: "",
  description: "",
  color: DEFAULT_COLOR,
  fields: [],
  footer: "",
  thumbnail_url: "",
  image_url: "",
  author: "",
});

const emptyField = (): EmbedField => ({
  name: "",
  value: "",
  inline: false,
});

const emptyForm = (): CommandForm => ({
  name: "",
  description: "",
  response_type: "text",
  response_text: "",
  response_embed: emptyEmbed(),
  ephemeral: false,
  required_roles: [],
  enabled: true,
  aliases: [],
  cooldown: 0,
  allowed_channels: [],
  delete_trigger: false,
  auto_react: "",
  silent: false,
  dm_response: false,
  no_everyone: false,
  allowed_roles: [],
  ignored_roles: [],
  ignored_channels: [],
  response_channel_id: "",
  delete_after: 0,
  required_args: 0,
  additional_responses: [],
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(s?: string) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Variables Reference Component ───────────────────────────────────────────

function VariablesReference() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const copyVar = (key: string) => {
    navigator.clipboard.writeText(key).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          <Variable className="h-3.5 w-3.5" />
          Biến số
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
              <Variable className="h-3 w-3" />
              Xem tất cả
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <ScrollArea className="h-80">
              <div className="p-3 space-y-3">
                {VARIABLE_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {group.vars.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          className="w-full text-left flex items-center justify-between rounded px-2 py-1 hover:bg-accent transition-colors group"
                          onClick={() => copyVar(v.key)}
                        >
                          <span className="flex items-center gap-2">
                            <code className="text-xs font-mono text-primary">
                              {v.key}
                            </code>
                            <span className="text-[11px] text-muted-foreground">
                              {v.desc}
                            </span>
                          </span>
                          {copiedKey === v.key ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Sử dụng biến như <code className="text-primary">{"{user}"}</code>, <code className="text-primary">{"{server}"}</code> trong nội dung để hiển thị thông tin động.
      </p>
      {/* Quick inline expandable groups */}
      <div className="space-y-1">
        {VARIABLE_GROUPS.map((group) => (
          <div key={group.label}>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              onClick={() => toggleGroup(group.label)}
            >
              {expandedGroups.has(group.label) ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {group.label}
            </button>
            {expandedGroups.has(group.label) && (
              <div className="pl-5 pt-1 pb-1 flex flex-wrap gap-1">
                {group.vars.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[11px] font-mono hover:bg-accent transition-colors"
                    onClick={() => copyVar(v.key)}
                    title={v.desc}
                  >
                    {v.key}
                    {copiedKey === v.key && (
                      <Check className="h-2.5 w-2.5 text-green-500" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Command Card ────────────────────────────────────────────────────────────

function CommandCard({
  command,
  onEdit,
  onDelete,
  onToggle,
  togglePending,
}: {
  command: CustomCommand;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  togglePending: boolean;
}) {
  return (
    <Card className="overflow-hidden group transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        {/* Top: name + badges */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <Badge className="bg-indigo-500/15 text-indigo-600 border border-indigo-500/30 shrink-0 text-[11px] font-mono px-2">
              !{command.name}
            </Badge>
            {command.aliases?.map((alias) => (
              <Badge
                key={alias}
                variant="outline"
                className="text-[10px] px-1.5 shrink-0 font-mono text-muted-foreground"
              >
                !{alias}
              </Badge>
            ))}
            {command.response_type === "text" ? (
              <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
                <Type className="h-3 w-3 mr-0.5" />
                Text
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
                <Layout className="h-3 w-3 mr-0.5" />
                Embed
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={command.enabled}
              onCheckedChange={onToggle}
              disabled={togglePending}
              className="scale-75"
            />
          </div>
        </div>

        {/* Description */}
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground line-clamp-2">
            {command.description || "Không có mô tả"}
          </p>
        </div>

        {/* Response preview */}
        {command.response_type === "embed" && command.response_embed && (
          <div className="mx-4 mb-3 rounded overflow-hidden border border-border/50">
            <div className="flex">
              <div
                className="w-1 shrink-0"
                style={{ backgroundColor: command.response_embed.color || DEFAULT_COLOR }}
              />
              <div className="p-2.5 flex-1 min-w-0 bg-muted/30">
                <p className="font-semibold text-xs leading-tight">
                  {command.response_embed.title || "Tiêu đề"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                  {command.response_embed.description || "Mô tả..."}
                </p>
              </div>
            </div>
          </div>
        )}

        {command.response_type === "text" && command.response_text && (
          <div className="mx-4 mb-3 rounded bg-muted/30 p-2.5 border border-border/50">
            <p className="text-[11px] text-muted-foreground line-clamp-2">
              {command.response_text}
            </p>
          </div>
        )}

        {/* Meta row */}
        <div className="mx-4 mb-2 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          {command.ephemeral && (
            <span className="flex items-center gap-1">
              Ẩn (Ephemeral)
            </span>
          )}
          {command.required_roles?.length > 0 && (
            <span>{command.required_roles.length} role yêu cầu</span>
          )}
          {(command.cooldown ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              ⏱️ {command.cooldown}s
            </span>
          )}
          {(command.allowed_channels?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-blue-600">
              📌 {command.allowed_channels.length} kênh
            </span>
          )}
          {command.delete_trigger && (
            <span className="text-rose-600">Xóa tin nhắn gốc</span>
          )}
          {command.auto_react && (
            <span className="flex items-center gap-1">
              <Smile className="h-3 w-3" />
              {command.auto_react}
            </span>
          )}
        </div>

        <Separator />

        {/* Footer: date + actions */}
        <div className="flex items-center justify-between px-4 py-2.5">
          {command.created_at ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(command.created_at)}
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Sửa
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Xóa
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CustomCommands() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── State ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<CustomCommand | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomCommand | null>(null);
  const [form, setForm] = useState<CommandForm>(emptyForm());

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: commands = [], isLoading } = useQuery<CustomCommand[]>({
    queryKey: ["custom-commands"],
    queryFn: () =>
      fetch("/api/custom-commands", { credentials: "include" }).then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

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
      setDialogOpen(false);
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
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/custom-commands/${id}`, {
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
      setDialogOpen(false);
      setEditingCommand(null);
      toast({ title: "Đã cập nhật command" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật",
        description: e.message,
      }),
  });

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: (id: number) =>
      fetch(`/api/custom-commands/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-commands"] });
      setDeleteTarget(null);
      toast({ title: "Đã xóa command" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi xóa command",
        description: e.message,
      }),
  });

  const toggleMutation = useMutation<any, Error, number>({
    mutationFn: (id: number) =>
      fetch(`/api/custom-commands/${id}/toggle`, {
        method: "PUT",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-commands"] });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi toggle",
        description: e.message,
      }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingCommand(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (cmd: CustomCommand) => {
    setEditingCommand(cmd);
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
    setDialogOpen(true);
  };

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
      // Phase 3
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
    if (editingCommand) {
      updateMutation.mutate({ id: editingCommand.id, ...body });
    } else {
      createMutation.mutate(body);
    }
  };

  // ── Embed field helpers ──────────────────────────────────────────────────

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

  // ── Alias helpers ────────────────────────────────────────────────────────

  const [aliasInput, setAliasInput] = useState("");
  const [varsOpen, setVarsOpen] = useState(false);
  const [focusedInput, setFocusedInput] = useState<"text" | "embed_desc" | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [advOpts2Open, setAdvOpts2Open] = useState(false);
  const [addRespOpen, setAddRespOpen] = useState(false);

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

  // ── Channel helpers ──────────────────────────────────────────────────────

  const addChannel = (id: string) => {
    if (id && !form.allowed_channels.includes(id)) {
      setForm((p) => ({ ...p, allowed_channels: [...p.allowed_channels, id] }));
    }
  };

  const removeChannel = (id: string) => {
    setForm((p) => ({
      ...p,
      allowed_channels: p.allowed_channels.filter((c) => c !== id),
    }));
  };

  // ── Variable insertion ───────────────────────────────────────────────────

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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Terminal className="w-6 h-6" />
            Custom Commands
          </h2>
          <p className="text-muted-foreground mt-1">
            Tạo command tùy chỉnh từ dashboard
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo Command
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      )}

      {/* Empty state */}
      {!isLoading && commands.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Terminal className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium">Chưa có command nào</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tạo lệnh tùy chỉnh để bot phản hồi tự động.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo Command
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grid of commands */}
      {!isLoading && commands.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {commands.map((cmd) => (
            <CommandCard
              key={cmd.id}
              command={cmd}
              onEdit={() => openEdit(cmd)}
              onDelete={() => setDeleteTarget(cmd)}
              onToggle={() => toggleMutation.mutate(cmd.id)}
              togglePending={toggleMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            setEditingCommand(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCommand ? "Chỉnh sửa Command" : "Tạo Custom Command"}
            </DialogTitle>
            <DialogDescription>
              Tạo lệnh tùy chỉnh để bot phản hồi khi người dùng dùng !&lt;tên&gt;.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
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
                    onChange={(id) => setForm((p) => ({ ...p, response_channel_id: id }))}
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

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditingCommand(null);
              }}
            >
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Đang lưu..."
                : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xóa command?</DialogTitle>
            <DialogDescription>
              Command <strong>!{deleteTarget?.name}</strong> sẽ bị xóa vĩnh viễn.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
