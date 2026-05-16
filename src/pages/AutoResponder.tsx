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
import { MultiRoleSelect } from "@/components/RoleSelect";
import { ChannelSelect } from "@/components/ChannelSelect";
import { EmojiPicker } from "@/components/EmojiPicker";
import {
  MessageCircleReply,
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
  Variable,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Zap,
  Filter,
  Settings2,
  Regex,
  Asterisk,
  Reply,
  Mail,
  Ban,
  Bot,
  ArrowUpRight,
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
  footer: string;
  image_url: string;
  thumbnail_url: string;
  author_name: string;
  author_icon_url: string;
  fields: EmbedField[];
}

interface AutoResponderRule {
  id: number;
  name: string;
  trigger_type: "exact" | "contains" | "startswith" | "endswith" | "regex" | "wildcard";
  trigger_text: string;
  ignore_case: boolean;
  response_type: "text" | "embed" | "react" | "text+react" | "embed+react";
  response_text: string | null;
  response_embed: ResponseEmbed | null;
  reaction_emojis: string[];
  reply_to_message: boolean;
  delete_trigger: boolean;
  send_dm: boolean;
  cooldown: number;
  cooldown_type: "per_user" | "per_channel" | "global";
  allowed_channels: string[];
  blocked_channels: string[];
  allowed_roles: string[];
  blocked_roles: string[];
  ignore_bots: boolean;
  enabled: boolean;
  priority: number;
  created_at: string | null;
}

interface RuleForm {
  name: string;
  trigger_type: AutoResponderRule["trigger_type"];
  trigger_text: string;
  ignore_case: boolean;
  response_type: AutoResponderRule["response_type"];
  response_text: string;
  response_embed: ResponseEmbed;
  reaction_emojis: string[];
  reply_to_message: boolean;
  delete_trigger: boolean;
  send_dm: boolean;
  cooldown: number;
  cooldown_type: AutoResponderRule["cooldown_type"];
  allowed_channels: string[];
  blocked_channels: string[];
  allowed_roles: string[];
  blocked_roles: string[];
  ignore_bots: boolean;
  enabled: boolean;
  priority: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TRIGGER_TYPE_CONFIG: Record<
  AutoResponderRule["trigger_type"],
  { label: string; color: string; helper: string; icon: typeof Zap }
> = {
  exact: { label: "Chính xác", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", helper: "Khớp toàn bộ nội dung tin nhắn.", icon: Zap },
  contains: { label: "Chứa", color: "bg-blue-500/15 text-blue-600 border-blue-500/30", helper: "Tin nhắn chứa từ khóa này.", icon: Type },
  startswith: { label: "Bắt đầu bằng", color: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30", helper: "Tin nhắn bắt đầu bằng từ khóa.", icon: ArrowUpRight },
  endswith: { label: "Kết thúc bằng", color: "bg-teal-500/15 text-teal-600 border-teal-500/30", helper: "Tin nhắn kết thúc bằng từ khóa.", icon: ArrowUpRight },
  regex: { label: "Regex", color: "bg-purple-500/15 text-purple-600 border-purple-500/30", helper: "Sử dụng biểu thức chính quy (regex).", icon: Regex },
  wildcard: { label: "Wildcard", color: "bg-orange-500/15 text-orange-600 border-orange-500/30", helper: "Dùng * cho wildcard. VD: hello*world", icon: Asterisk },
};


const PRESET_COLORS = [
  "#5865F2",
  "#57f287",
  "#fee75c",
  "#ed4245",
  "#eb459e",
  "#2b2d31",
];

const DEFAULT_COLOR = "#5865F2";

const VARIABLE_GROUPS: { label: string; icon: typeof Variable; vars: { key: string; desc: string }[] }[] = [
  {
    label: "Người dùng",
    icon: Variable,
    vars: [
      { key: "{user}", desc: "Username" },
      { key: "{user.mention}", desc: "Mention" },
      { key: "{user.id}", desc: "User ID" },
      { key: "{user.name}", desc: "Display name" },
    ],
  },
  {
    label: "Server",
    icon: Variable,
    vars: [
      { key: "{server}", desc: "Server name" },
      { key: "{server.member_count}", desc: "Số thành viên" },
    ],
  },
  {
    label: "Channel",
    icon: Hash,
    vars: [
      { key: "{channel}", desc: "Channel mention" },
      { key: "{channel.name}", desc: "Channel name" },
    ],
  },
  {
    label: "Thời gian",
    icon: Clock,
    vars: [
      { key: "{date}", desc: "Ngày (DD/MM/YYYY)" },
      { key: "{time}", desc: "Giờ (HH:MM)" },
    ],
  },
  {
    label: "Khác",
    icon: Sparkles,
    vars: [
      { key: "{message}", desc: "Nội dung tin nhắn" },
      { key: "{random:1:100}", desc: "Số ngẫu nhiên" },
    ],
  },
];

const emptyEmbed = (): ResponseEmbed => ({
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

const emptyField = (): EmbedField => ({
  name: "",
  value: "",
  inline: false,
});

const emptyForm = (): RuleForm => ({
  name: "",
  trigger_type: "contains",
  trigger_text: "",
  ignore_case: true,
  response_type: "text",
  response_text: "",
  response_embed: emptyEmbed(),
  reaction_emojis: [],
  reply_to_message: false,
  delete_trigger: false,
  send_dm: false,
  cooldown: 0,
  cooldown_type: "per_user",
  allowed_channels: [],
  blocked_channels: [],
  allowed_roles: [],
  blocked_roles: [],
  ignore_bots: true,
  enabled: true,
  priority: 0,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(s?: string | null) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Rule Card ───────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
  togglePending,
}: {
  rule: AutoResponderRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  togglePending: boolean;
}) {
  const triggerCfg = TRIGGER_TYPE_CONFIG[rule.trigger_type];
  const TriggerIcon = triggerCfg.icon;
  const showText = rule.response_type.includes("text");
  const showEmbed = rule.response_type.includes("embed");
  const showReact = rule.response_type === "react" || rule.response_type.includes("+react");

  return (
    <Card className="overflow-hidden group transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        {/* Top: name + badges */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className="font-semibold text-sm truncate max-w-[180px]">
              {rule.name || "Untitled"}
            </span>
            <Badge className={cn("border shrink-0 text-[11px] px-2", triggerCfg.color)}>
              <TriggerIcon className="h-3 w-3 mr-0.5" />
              {triggerCfg.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
              {showText && <><Type className="h-3 w-3 mr-0.5" />Text</>}
              {showEmbed && <><Layout className="h-3 w-3 mr-0.5" />Embed</>}
              {showReact && <><Smile className="h-3 w-3 mr-0.5" />React</>}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={rule.enabled}
              onCheckedChange={onToggle}
              disabled={togglePending}
              className="scale-75"
            />
          </div>
        </div>

        {/* Trigger text preview */}
        <div className="px-4 pb-2">
          <div className="rounded bg-muted/30 p-2 border border-border/50">
            <p className="text-xs font-mono text-muted-foreground line-clamp-2 break-all">
              {rule.trigger_text || "—"}
            </p>
          </div>
        </div>

        {/* Response preview */}
        {showText && rule.response_text && (
          <div className="mx-4 mb-3 rounded bg-muted/30 p-2.5 border border-border/50">
            <p className="text-[11px] text-muted-foreground line-clamp-2">
              {rule.response_text}
            </p>
          </div>
        )}
        {showEmbed && rule.response_embed && (
          <div className="mx-4 mb-3 rounded overflow-hidden border border-border/50">
            <div className="flex">
              <div
                className="w-1 shrink-0"
                style={{ backgroundColor: rule.response_embed.color || DEFAULT_COLOR }}
              />
              <div className="p-2.5 flex-1 min-w-0 bg-muted/30">
                <p className="font-semibold text-xs leading-tight">
                  {rule.response_embed.title || "Tiêu đề"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                  {rule.response_embed.description || "Mô tả..."}
                </p>
              </div>
            </div>
          </div>
        )}
        {showReact && rule.reaction_emojis?.length > 0 && (
          <div className="mx-4 mb-3 flex items-center gap-1">
            <Smile className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex gap-0.5">
              {rule.reaction_emojis.slice(0, 5).map((emoji, i) => (
                <span key={i} className="text-sm">{emoji}</span>
              ))}
              {rule.reaction_emojis.length > 5 && (
                <span className="text-[11px] text-muted-foreground">+{rule.reaction_emojis.length - 5}</span>
              )}
            </div>
          </div>
        )}

        {/* Meta row */}
        <div className="mx-4 mb-2 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          {rule.ignore_case && (
            <span className="text-blue-600">Aa</span>
          )}
          {(rule.cooldown ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              ⏱️ {rule.cooldown}s
            </span>
          )}
          {(rule.allowed_channels?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-blue-600">
              📌 {rule.allowed_channels.length} kênh
            </span>
          )}
          {(rule.blocked_channels?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              🚫 {rule.blocked_channels.length} kênh
            </span>
          )}
          {(rule.allowed_roles?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              🛡️ {rule.allowed_roles.length} role
            </span>
          )}
          {(rule.blocked_roles?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              🚫 {rule.blocked_roles.length} role
            </span>
          )}
          {(rule.priority ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-purple-600">
              ⬆️ P{rule.priority}
            </span>
          )}
          {rule.reply_to_message && (
            <span className="flex items-center gap-1">
              <Reply className="h-3 w-3" />
              Reply
            </span>
          )}
          {rule.delete_trigger && (
            <span className="text-rose-600">Xóa tin nhắn gốc</span>
          )}
          {rule.send_dm && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              DM
            </span>
          )}
          {rule.ignore_bots && (
            <span className="flex items-center gap-1">
              <Bot className="h-3 w-3" />
              Bỏ qua bot
            </span>
          )}
        </div>

        <Separator />

        {/* Footer: date + actions */}
        <div className="flex items-center justify-between px-4 py-2.5">
          {rule.created_at ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(rule.created_at)}
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

export function AutoResponder() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── State ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoResponderRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutoResponderRule | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm());

  // Collapsible sections
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [restrictionsOpen, setRestrictionsOpen] = useState(false);
  const [varsOpen, setVarsOpen] = useState(false);
  const [focusedInput, setFocusedInput] = useState<"text" | "embed_desc" | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: rules = [], isLoading } = useQuery<AutoResponderRule[]>({
    queryKey: ["auto-responders"],
    queryFn: () =>
      fetch("/api/auto-responders", { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      }),
    staleTime: 60_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

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
      setDialogOpen(false);
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
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/auto-responders/${id}`, {
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
      setDialogOpen(false);
      setEditingRule(null);
      toast({ title: "Đã cập nhật rule" });
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
      fetch(`/api/auto-responders/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auto-responders"] });
      setDeleteTarget(null);
      toast({ title: "Đã xóa rule" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi xóa rule",
        description: e.message,
      }),
  });

  const toggleMutation = useMutation<any, Error, number>({
    mutationFn: (id: number) =>
      fetch(`/api/auto-responders/${id}/toggle`, {
        method: "PUT",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auto-responders"] });
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
    setEditingRule(null);
    setForm(emptyForm());
    setSettingsOpen(false);
    setRestrictionsOpen(false);
    setDialogOpen(true);
  };

  const openEdit = (rule: AutoResponderRule) => {
    setEditingRule(rule);
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
    setSettingsOpen(false);
    setRestrictionsOpen(false);
    setDialogOpen(true);
  };

  const handleSave = () => {
    const hasText = form.response_type === "text" || form.response_type === "text+react";
    const hasEmbed = form.response_type === "embed" || form.response_type === "embed+react";
    const hasReact = form.response_type === "react" || form.response_type === "text+react" || form.response_type === "embed+react";

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

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, ...body });
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

  // ── Emoji helpers ────────────────────────────────────────────────────────

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

  // ── Channel helpers ──────────────────────────────────────────────────────

  const addAllowedChannel = (id: string) => {
    if (id && !form.allowed_channels.includes(id)) {
      setForm((p) => ({ ...p, allowed_channels: [...p.allowed_channels, id] }));
    }
  };

  const removeAllowedChannel = (id: string) => {
    setForm((p) => ({
      ...p,
      allowed_channels: p.allowed_channels.filter((c) => c !== id),
    }));
  };

  const addBlockedChannel = (id: string) => {
    if (id && !form.blocked_channels.includes(id)) {
      setForm((p) => ({ ...p, blocked_channels: [...p.blocked_channels, id] }));
    }
  };

  const removeBlockedChannel = (id: string) => {
    setForm((p) => ({
      ...p,
      blocked_channels: p.blocked_channels.filter((c) => c !== id),
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

  // ── Derived ──────────────────────────────────────────────────────────────

  const hasText = form.response_type === "text" || form.response_type === "text+react";
  const hasEmbed = form.response_type === "embed" || form.response_type === "embed+react";
  const hasReact = form.response_type === "react" || form.response_type === "text+react" || form.response_type === "embed+react";

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageCircleReply className="w-6 h-6" />
            Auto Responder
          </h2>
          <p className="text-muted-foreground mt-1">
            Tự động phản hồi khi tin nhắn khớp với điều kiện
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo rule
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      )}

      {/* Empty state */}
      {!isLoading && rules.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircleReply className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium">Chưa có auto responder nào</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tạo rule để bot tự động phản hồi khi tin nhắn khớp điều kiện.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo rule
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grid of rules */}
      {!isLoading && rules.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => openEdit(rule)}
              onDelete={() => setDeleteTarget(rule)}
              onToggle={() => toggleMutation.mutate(rule.id)}
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
            setEditingRule(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Chỉnh sửa Auto Responder" : "Tạo Auto Responder"}
            </DialogTitle>
            <DialogDescription>
              Tạo rule tự động phản hồi khi tin nhắn khớp với điều kiện.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
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
                            // Parse current flags
                            let text = t.includes("text");
                            let embed = t.includes("embed");
                            let react = t === "react" || t.includes("+react");
                            // Toggle
                            if (key === "text") { text = !text; if (text) embed = false; }
                            if (key === "embed") { embed = !embed; if (embed) text = false; }
                            if (key === "react") react = !react;
                            // Build response_type
                            let newType: AutoResponderRule["response_type"] = "text";
                            if (text && react) newType = "text+react";
                            else if (embed && react) newType = "embed+react";
                            else if (text) newType = "text";
                            else if (embed) newType = "embed";
                            else if (react) newType = "react";
                            else newType = "text"; // fallback
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

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditingRule(null);
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
            <DialogTitle>Xóa rule?</DialogTitle>
            <DialogDescription>
              Rule <strong>{deleteTarget?.name}</strong> sẽ bị xóa vĩnh viễn.
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
