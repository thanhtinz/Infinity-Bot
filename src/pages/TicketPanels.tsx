import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutGrid,
  Plus,
  Pencil,
  Trash2,
  Hash,
  CheckCircle2,
  Calendar,
  Info,
  X,
  MessageSquare,
  MousePointerClick,
  ChevronDown,
  ChevronUp,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChannelSelect } from "@/components/ChannelSelect";
import { EmojiPicker } from "@/components/EmojiPicker";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TicketButton {
  id?: number;
  label: string;
  emoji: string;
  style: string; // primary | secondary | success | danger
  category_id: string;
  form_id?: string;
}

interface TicketPanel {
  id: number;
  guild_id?: string;
  channel_id?: string;
  message_id?: string;
  name: string;
  title?: string;
  description?: string;
  color?: string;
  created_at?: string;
  buttons: TicketButton[];
  naming_format?: string | null;
  open_message_title?: string | null;
  open_message_body?: string | null;
  close_message_title?: string | null;
  close_message_body?: string | null;
  claim_message_title?: string | null;
  claim_message_body?: string | null;
  group_id?: number | null;
}

interface PanelForm {
  name: string;
  title: string;
  description: string;
  color: string;
  channel_id: string;
  buttons: TicketButton[];
  naming_format: string;
  open_message_title: string;
  open_message_body: string;
  close_message_title: string;
  close_message_body: string;
  claim_message_title: string;
  claim_message_body: string;
}

interface ButtonForm {
  label: string;
  emoji: string;
  style: string;
  category_id: string;
  form_id: string;
}

interface TicketPanelGroup {
  id: number;
  guild_id?: string;
  name: string;
  channel_id?: string;
  message_id?: string;
  title: string;
  description?: string;
  color: string;
  created_at?: string;
  is_sent: boolean;
  panel_ids: number[];
}

interface PanelGroupForm {
  name: string;
  title: string;
  description: string;
  color: string;
  channel_id: string;
  panel_ids: number[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DISCORD_BG = "#2b2d31";
const DISCORD_EMBED_BG = "#2b2d31";
const DISCORD_TEXT = "#dbdee1";
const DISCORD_MUTED = "#949ba4";

const BUTTON_STYLES = [
  { key: "primary", label: "Primary", bg: "#5865F2", text: "#ffffff" },
  { key: "secondary", label: "Secondary", bg: "#4e5058", text: "#ffffff" },
  { key: "success", label: "Success", bg: "#57f287", text: "#000000" },
  { key: "danger", label: "Danger", bg: "#ed4245", text: "#ffffff" },
] as const;

const STYLE_RING: Record<string, string> = {
  primary: "ring-[#5865F2]",
  secondary: "ring-[#4e5058]",
  success: "ring-[#57f287]",
  danger: "ring-[#ed4245]",
};

const STYLE_CHECK: Record<string, string> = {
  primary: "text-[#5865F2]",
  secondary: "text-[#4e5058]",
  success: "text-[#57f287]",
  danger: "text-[#ed4245]",
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
const MAX_BUTTONS = 5;

const emptyPanelForm = (): PanelForm => ({
  name: "",
  title: "Tạo Ticket",
  description: "Nhấn nút bên dưới để tạo ticket hỗ trợ.",
  color: DEFAULT_COLOR,
  channel_id: "",
  buttons: [],
  naming_format: "",
  open_message_title: "",
  open_message_body: "",
  close_message_title: "",
  close_message_body: "",
  claim_message_title: "",
  claim_message_body: "",
});

const emptyButtonForm = (): ButtonForm => ({
  label: "",
  emoji: "",
  style: "primary",
  category_id: "",
  form_id: "",
});

const emptyPanelGroupForm = (): PanelGroupForm => ({
  name: "",
  title: "Hỗ trợ",
  description: "",
  color: DEFAULT_COLOR,
  channel_id: "",
  panel_ids: [],
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

function getButtonStyle(key: string) {
  return BUTTON_STYLES.find((s) => s.key === key) ?? BUTTON_STYLES[0];
}

// ─── Discord Live Preview ────────────────────────────────────────────────────

function DiscordPreview({
  form,
  buttons,
}: {
  form: PanelForm;
  buttons: TicketButton[];
}) {
  return (
    <div
      className="rounded-md overflow-hidden text-sm"
      style={{ backgroundColor: DISCORD_BG }}
    >
      {/* Channel header mock */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        <Hash className="h-3.5 w-3.5" style={{ color: DISCORD_MUTED }} />
        <span
          className="text-xs font-semibold"
          style={{ color: DISCORD_TEXT }}
        >
          ticket-panel
        </span>
      </div>

      {/* Message area */}
      <div className="px-3 pb-3 pt-1">
        <div className="flex items-start gap-2.5">
          <div
            className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: DEFAULT_COLOR, color: "#fff" }}
          >
            TB
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-semibold text-xs"
                style={{ color: DEFAULT_COLOR }}
              >
                TicketBot
              </span>
              <span className="text-[10px]" style={{ color: DISCORD_MUTED }}>
                Hôm nay lúc 12:00
              </span>
            </div>

            {/* Embed */}
            <div
              className="mt-1.5 rounded overflow-hidden max-w-[360px]"
              style={{ backgroundColor: DISCORD_EMBED_BG }}
            >
              <div className="flex">
                <div
                  className="w-1 shrink-0 rounded-l"
                  style={{ backgroundColor: form.color || DEFAULT_COLOR }}
                />
                <div className="p-2.5 flex-1 min-w-0">
                  {form.title && (
                    <p
                      className="font-semibold text-[13px] leading-tight"
                      style={{ color: DISCORD_TEXT }}
                    >
                      {form.title}
                    </p>
                  )}
                  {form.description && (
                    <p
                      className="text-xs mt-1 whitespace-pre-wrap leading-relaxed"
                      style={{ color: DISCORD_MUTED }}
                    >
                      {form.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Buttons row */}
            {buttons.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {buttons.map((btn, idx) => {
                  const s = getButtonStyle(btn.style);
                  return (
                    <div
                      key={btn.id ?? idx}
                      className="inline-flex items-center gap-1.5 rounded-[3px] px-4 py-1.5 text-xs font-medium cursor-default"
                      style={{ backgroundColor: s.bg, color: s.text }}
                    >
                      {btn.emoji && <span>{btn.emoji}</span>}
                      {btn.label || "Nút"}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Button Style Picker ─────────────────────────────────────────────────────

function ButtonStylePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {BUTTON_STYLES.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onChange(s.key)}
          className={cn(
            "relative flex items-center gap-2 rounded-lg border-2 p-3 transition-all",
            value === s.key
              ? cn(
                  "border-foreground",
                  STYLE_RING[s.key],
                  "ring-2 ring-offset-1 ring-offset-background"
                )
              : "border-transparent bg-muted/30 hover:bg-muted/50"
          )}
        >
          <div
            className="h-5 w-5 rounded-full shrink-0"
            style={{ backgroundColor: s.bg }}
          />
          <div className="text-left">
            <p className="text-xs font-medium">{s.label}</p>
          </div>
          {value === s.key && (
            <div className="absolute top-1.5 right-1.5">
              <CheckCircle2 className={cn("h-4 w-4", STYLE_CHECK[s.key])} />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Panel Card ──────────────────────────────────────────────────────────────

function PanelCard({
  panel,
  groupName,
  groupColor,
  onEdit,
  onDelete,
}: {
  panel: TicketPanel;
  groupName?: string;
  groupColor?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isSent = !!panel.message_id;
  const btns = panel.buttons ?? [];

  return (
    <Card className="overflow-hidden group transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        {/* Top: name + id + status */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold truncate text-sm">{panel.name}</span>
            <Badge
              variant="outline"
              className="text-[10px] font-mono shrink-0 px-1.5"
            >
              #{panel.id}
            </Badge>
            {groupName && (
              <Badge
                className="text-[10px] px-1.5 shrink-0"
                style={{
                  backgroundColor: (groupColor || DEFAULT_COLOR) + "20",
                  color: groupColor || DEFAULT_COLOR,
                  borderColor: (groupColor || DEFAULT_COLOR) + "40",
                }}
              >
                <Users className="h-3 w-3 mr-0.5" />
                {groupName}
              </Badge>
            )}
          </div>
          {isSent ? (
            <Badge className="bg-green-500/15 text-green-600 border border-green-500/30 shrink-0 text-[10px] px-1.5">
              <CheckCircle2 className="h-3 w-3 mr-0.5" />
              Đã gửi
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-muted-foreground shrink-0 text-[10px] px-1.5"
            >
              Chưa gửi
            </Badge>
          )}
        </div>

        {/* Discord-style embed preview */}
        <div className="mx-4 mb-3 rounded overflow-hidden border border-border/50">
          <div className="flex">
            <div
              className="w-1 shrink-0"
              style={{ backgroundColor: panel.color || DEFAULT_COLOR }}
            />
            <div className="p-2.5 flex-1 min-w-0 bg-muted/30">
              <p className="font-semibold text-xs leading-tight">
                {panel.title || "Tiêu đề"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                {panel.description || "Mô tả..."}
              </p>
            </div>
          </div>
        </div>

        {/* Button chips row */}
        <div className="mx-4 mb-3 flex flex-wrap gap-1.5">
          {btns.map((btn, idx) => {
            const s = getButtonStyle(btn.style);
            return (
              <span
                key={btn.id ?? idx}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium"
                style={{ backgroundColor: s.bg, color: s.text }}
              >
                {btn.emoji && <span>{btn.emoji}</span>}
                {btn.label || "Nút"}
              </span>
            );
          })}
          {btns.length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              0 buttons
            </span>
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
            {btns.length} nút
          </Badge>
        </div>

        {/* Channel */}
        <div className="mx-4 mb-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Hash className="h-3 w-3 shrink-0" />
          {panel.channel_id ? (
            <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">
              {panel.channel_id}
            </code>
          ) : (
            <span>Chưa gửi</span>
          )}
        </div>

        <Separator />

        {/* Footer: date + actions */}
        <div className="flex items-center justify-between px-4 py-2.5">
          {panel.created_at ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(panel.created_at)}
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

// ─── Collapsible Section ─────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  hasContent,
  children,
}: {
  title: string;
  hasContent: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(hasContent);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border p-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {hasContent && (
            <Badge variant="secondary" className="text-[10px] px-1.5">
              Tùy chỉnh
            </Badge>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-0">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function TicketPanels() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Panel state ──
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<TicketPanel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TicketPanel | null>(null);
  const [form, setForm] = useState<PanelForm>(emptyPanelForm());
  const [activeTab, setActiveTab] = useState<string>("embed");

  // ── Button editing state (inline within sheet) ──
  const [editingBtnIdx, setEditingBtnIdx] = useState<number | null>(null);
  const [btnForm, setBtnForm] = useState<ButtonForm>(emptyButtonForm());

  // ── Group state ──
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TicketPanelGroup | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<TicketPanelGroup | null>(null);
  const [groupForm, setGroupForm] = useState<PanelGroupForm>(emptyPanelGroupForm());

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: panels = [], isLoading } = useQuery<TicketPanel[]>({
    queryKey: ["ticket-panels"],
    queryFn: () =>
      fetch("/api/ticket-panels", { credentials: "include" }).then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  });

  const { data: groups = [] } = useQuery<TicketPanelGroup[]>({
    queryKey: ["ticket-panel-groups"],
    queryFn: () =>
      fetch("/api/ticket-panel-groups", { credentials: "include" }).then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  });

  // ── Panel Mutations ──────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/ticket-panels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-panels"] });
      setSheetOpen(false);
      toast({ title: "Đã tạo panel thành công" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi tạo panel",
        description: e.message,
      }),
  } satisfies UseMutationOptions);

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/ticket-panels/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-panels"] });
      setSheetOpen(false);
      setEditingPanel(null);
      toast({ title: "Đã cập nhật panel" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật",
        description: e.message,
      }),
  } satisfies UseMutationOptions);

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/ticket-panels/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-panels"] });
      setDeleteTarget(null);
      toast({ title: "Đã xóa panel" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi xóa panel",
        description: e.message,
      }),
  } satisfies UseMutationOptions);

  // ── Group Mutations ──────────────────────────────────────────────────────

  const createGroupMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/ticket-panel-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-panel-groups"] });
      qc.invalidateQueries({ queryKey: ["ticket-panels"] });
      setGroupSheetOpen(false);
      toast({ title: "Đã tạo nhóm panel" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi tạo nhóm",
        description: e.message,
      }),
  } satisfies UseMutationOptions);

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/ticket-panel-groups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-panel-groups"] });
      qc.invalidateQueries({ queryKey: ["ticket-panels"] });
      setGroupSheetOpen(false);
      setEditingGroup(null);
      toast({ title: "Đã cập nhật nhóm" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật nhóm",
        description: e.message,
      }),
  } satisfies UseMutationOptions);

  const deleteGroupMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/ticket-panel-groups/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-panel-groups"] });
      qc.invalidateQueries({ queryKey: ["ticket-panels"] });
      setDeleteGroupTarget(null);
      toast({ title: "Đã xóa nhóm" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi xóa nhóm",
        description: e.message,
      }),
  } satisfies UseMutationOptions);

  // ── Panel Handlers ───────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingPanel(null);
    setForm(emptyPanelForm());
    setActiveTab("embed");
    setEditingBtnIdx(null);
    setBtnForm(emptyButtonForm());
    setSheetOpen(true);
  };

  const openEdit = (p: TicketPanel) => {
    setEditingPanel(p);
    setForm({
      name: p.name,
      title: p.title ?? "",
      description: p.description ?? "",
      color: p.color ?? DEFAULT_COLOR,
      channel_id: p.channel_id ?? "",
      buttons: (p.buttons ?? []).map((b) => ({ ...b })),
      naming_format: p.naming_format ?? "",
      open_message_title: p.open_message_title ?? "",
      open_message_body: p.open_message_body ?? "",
      close_message_title: p.close_message_title ?? "",
      close_message_body: p.close_message_body ?? "",
      claim_message_title: p.claim_message_title ?? "",
      claim_message_body: p.claim_message_body ?? "",
    });
    setActiveTab("embed");
    setEditingBtnIdx(null);
    setBtnForm(emptyButtonForm());
    setSheetOpen(true);
  };

  const handleSave = () => {
    const payload: Record<string, unknown> = {
      name: form.name,
      title: form.title,
      description: form.description,
      color: form.color,
      channel_id: form.channel_id,
      buttons: form.buttons.map(({ label, emoji, style, category_id, form_id }) => ({
        label,
        emoji,
        style,
        category_id,
        ...(form_id ? { form_id } : {}),
      })),
      naming_format: form.naming_format.trim() || null,
      open_message_title: form.open_message_title.trim() || null,
      open_message_body: form.open_message_body.trim() || null,
      close_message_title: form.close_message_title.trim() || null,
      close_message_body: form.close_message_body.trim() || null,
      claim_message_title: form.claim_message_title.trim() || null,
      claim_message_body: form.claim_message_body.trim() || null,
    };
    if (editingPanel) {
      updateMutation.mutate({ id: editingPanel.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const setField = <K extends keyof PanelForm>(field: K, value: PanelForm[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Button Handlers (inline in sheet) ────────────────────────────────────

  const startAddButton = () => {
    if (form.buttons.length >= MAX_BUTTONS) return;
    setEditingBtnIdx(form.buttons.length);
    setBtnForm(emptyButtonForm());
  };

  const startEditButton = (idx: number) => {
    const btn = form.buttons[idx];
    setEditingBtnIdx(idx);
    setBtnForm({
      label: btn.label,
      emoji: btn.emoji,
      style: btn.style,
      category_id: btn.category_id,
      form_id: btn.form_id ?? "",
    });
  };

  const confirmButton = () => {
    if (!btnForm.label.trim()) return;
    const newBtn: TicketButton = {
      label: btnForm.label,
      emoji: btnForm.emoji,
      style: btnForm.style,
      category_id: btnForm.category_id,
      ...(btnForm.form_id ? { form_id: btnForm.form_id } : {}),
    };
    if (editingBtnIdx !== null && editingBtnIdx < form.buttons.length) {
      // Update existing
      const updated = [...form.buttons];
      updated[editingBtnIdx] = { ...updated[editingBtnIdx], ...newBtn };
      setField("buttons", updated);
    } else {
      // Add new
      setField("buttons", [...form.buttons, newBtn]);
    }
    setEditingBtnIdx(null);
    setBtnForm(emptyButtonForm());
  };

  const removeButton = (idx: number) => {
    const updated = form.buttons.filter((_, i) => i !== idx);
    setField("buttons", updated);
    if (editingBtnIdx === idx) {
      setEditingBtnIdx(null);
      setBtnForm(emptyButtonForm());
    }
  };

  const cancelButtonEdit = () => {
    setEditingBtnIdx(null);
    setBtnForm(emptyButtonForm());
  };

  const setBtnField = <K extends keyof ButtonForm>(
    field: K,
    value: ButtonForm[K]
  ) => setBtnForm((prev) => ({ ...prev, [field]: value }));

  // ── Group Handlers ───────────────────────────────────────────────────────

  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm(emptyPanelGroupForm());
    setGroupSheetOpen(true);
  };

  const openEditGroup = (g: TicketPanelGroup) => {
    setEditingGroup(g);
    setGroupForm({
      name: g.name,
      title: g.title ?? "",
      description: g.description ?? "",
      color: g.color ?? DEFAULT_COLOR,
      channel_id: g.channel_id ?? "",
      panel_ids: [...(g.panel_ids ?? [])],
    });
    setGroupSheetOpen(true);
  };

  const handleSaveGroup = () => {
    const payload: Record<string, unknown> = {
      name: groupForm.name,
      title: groupForm.title,
      description: groupForm.description,
      color: groupForm.color,
      channel_id: groupForm.channel_id,
      panel_ids: groupForm.panel_ids,
    };
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, ...payload });
    } else {
      createGroupMutation.mutate(payload);
    }
  };

  const isSavingGroup = createGroupMutation.isPending || updateGroupMutation.isPending;

  // Build a map of panel -> group for badge display
  const panelGroupMap = new Map<number, TicketPanelGroup>();
  for (const g of groups) {
    for (const pid of g.panel_ids) {
      panelGroupMap.set(pid, g);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Panels</h1>
            <Badge variant="secondary" className="text-xs font-medium">
              {panels.length} panel
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Quản lý panel tạo ticket cho server Discord của bạn
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo Panel
        </Button>
      </div>

      {/* ── Panel Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      ) : panels.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-20 flex flex-col items-center justify-center text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <LayoutGrid className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">Chưa có panel nào</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Tạo panel đầu tiên để bắt đầu quản lý ticket
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo Panel
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {panels.map((p) => {
            const grp = panelGroupMap.get(p.id);
            return (
              <PanelCard
                key={p.id}
                panel={p}
                groupName={grp?.name}
                groupColor={grp?.color}
                onEdit={() => openEdit(p)}
                onDelete={() => setDeleteTarget(p)}
              />
            );
          })}
        </div>
      )}

      {/* ── Panel Groups Section ── */}
      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Multi-Panel Groups</h2>
            <p className="text-sm text-muted-foreground">
              Gộp nhiều panel vào 1 embed message trên Discord
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={openCreateGroup}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Tạo Nhóm
          </Button>
        </div>

        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <LayoutGrid className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Chưa có nhóm nào. Tạo nhóm để gộp nhiều panel buttons vào 1 message.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map(g => {
              const memberPanels = panels.filter(p => g.panel_ids.includes(p.id));
              return (
                <Card key={g.id} className="overflow-hidden">
                  <div className="h-1" style={{ backgroundColor: g.color }} />
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{g.name}</p>
                        <p className="text-xs text-muted-foreground">{g.title}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditGroup(g)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteGroupTarget(g)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {memberPanels.length > 0 ? memberPanels.map(p => (
                        <Badge key={p.id} variant="secondary" className="text-xs">{p.name}</Badge>
                      )) : (
                        <span className="text-xs text-muted-foreground italic">Chưa có panel nào trong nhóm</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={g.is_sent ? "default" : "outline"} className="text-[10px]">
                        {g.is_sent ? "Đã gửi" : "Chưa gửi"}
                      </Badge>
                      {g.channel_id && (
                        <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{g.channel_id}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create / Edit Panel Dialog ── */}
      <Dialog
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSheetOpen(false);
            setEditingPanel(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPanel ? "Chỉnh sửa Panel" : "Tạo Panel"}
            </DialogTitle>
            <DialogDescription>
              {editingPanel
                ? "Cập nhật cấu hình panel ticket"
                : "Tạo panel ticket mới cho server"}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4">
            {/* Panel name */}
            <div className="space-y-1.5">
              <Label>
                Tên Panel <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Ví dụ: Hỗ trợ chung"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Tên nội bộ, không hiển thị trên Discord
              </p>
            </div>

            {/* Channel ID */}
            <div className="space-y-1.5">
              <Label>Kênh Discord</Label>
              <ChannelSelect
                filter="text"
                value={form.channel_id}
                onChange={(v) => setField("channel_id", v === "__clear__" ? "" : v)}
                placeholder="Chọn kênh..."
              />
            </div>

            <Separator />

            {/* Tabs: Embed / Buttons */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="embed" className="flex-1 gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Embed
                </TabsTrigger>
                <TabsTrigger value="buttons" className="flex-1 gap-1.5">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  Nút bấm
                </TabsTrigger>
                <TabsTrigger value="config" className="flex-1 gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  Cấu hình
                </TabsTrigger>
              </TabsList>

              {/* ── Embed Tab ── */}
              <TabsContent value="embed" className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Tiêu đề</Label>
                  <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                    <Input
                      placeholder="Ví dụ: Tạo Ticket"
                      value={form.title}
                      onChange={(e) => setField("title", e.target.value)}
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <EmojiPicker onSelect={(em) => setField("title", form.title + em)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Mô tả</Label>
                  <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                    <Textarea
                      placeholder="Mô tả hiển thị trong embed..."
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                      rows={3}
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                    />
                    <EmojiPicker onSelect={(em) => setField("description", form.description + em)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Màu</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setField("color", e.target.value)}
                      className="h-9 w-12 rounded border cursor-pointer shrink-0"
                    />
                    <Input
                      value={form.color}
                      onChange={(e) => setField("color", e.target.value)}
                      className="w-28 font-mono"
                      placeholder="#5865F2"
                    />
                  </div>
                  {/* Preset colors */}
                  <div className="flex gap-2 mt-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setField("color", c)}
                        className={cn(
                          "h-7 w-7 rounded-full border-2 transition-all",
                          form.color === c
                            ? "border-foreground scale-110"
                            : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Info box */}
                <div className="rounded-lg border bg-muted/40 p-3 flex gap-2.5">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sau khi tạo, dùng{" "}
                    <code className="bg-muted px-1 py-0.5 rounded font-mono text-[11px]">
                      /panel send
                    </code>{" "}
                    để gửi panel vào channel Discord
                  </p>
                </div>

                {/* Discord Live Preview */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">
                    Xem trước trên Discord
                  </Label>
                  <DiscordPreview form={form} buttons={form.buttons} />
                </div>
              </TabsContent>

              {/* ── Buttons Tab ── */}
              <TabsContent value="buttons" className="space-y-4 pt-2">
                {/* Button list */}
                {form.buttons.length === 0 && editingBtnIdx === null ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <MousePointerClick className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Chưa có button nào
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Thêm button để người dùng chọn loại ticket
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {form.buttons.map((btn, idx) => {
                      const s = getButtonStyle(btn.style);
                      return (
                        <div
                          key={btn.id ?? idx}
                          className="flex items-center gap-2 rounded-lg border p-2.5"
                        >
                          {/* Style dot */}
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: s.bg }}
                          />
                          {/* Emoji + Label */}
                          <span className="text-sm truncate flex-1 min-w-0">
                            {btn.emoji && (
                              <span className="mr-1">{btn.emoji}</span>
                            )}
                            {btn.label || "Nút"}
                          </span>
                          {/* Style badge */}
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 shrink-0"
                          >
                            {s.label}
                          </Badge>
                          {/* Edit */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0"
                            onClick={() => startEditButton(idx)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0 text-destructive hover:text-destructive"
                            onClick={() => removeButton(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add button */}
                {form.buttons.length < MAX_BUTTONS && editingBtnIdx === null && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={startAddButton}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Thêm button
                  </Button>
                )}

                {/* Inline button editor */}
                {editingBtnIdx !== null && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {editingBtnIdx < form.buttons.length
                          ? "Chỉnh sửa button"
                          : "Thêm button"}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={cancelButtonEdit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Nhãn</Label>
                      <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                        <Input
                          placeholder="Ví dụ: Hỗ trợ chung"
                          value={btnForm.label}
                          onChange={(e) => setBtnField("label", e.target.value)}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <EmojiPicker onSelect={(em) => setBtnField("label", btnForm.label + em)} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Emoji</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          placeholder="Nhập emoji..."
                          value={btnForm.emoji}
                          onChange={(e) => setBtnField("emoji", e.target.value)}
                          className="w-24"
                          maxLength={4}
                        />
                        <EmojiPicker onSelect={(emoji) => setBtnField("emoji", emoji)} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Kiểu nút</Label>
                      <ButtonStylePicker
                        value={btnForm.style}
                        onChange={(v) => setBtnField("style", v)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Category ID</Label>
                      <ChannelSelect
                        filter="category"
                        value={btnForm.category_id}
                        onChange={(v) =>
                          setBtnField("category_id", v === "__clear__" ? "" : v)
                        }
                        placeholder="Chọn category cho ticket..."
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Mỗi nút có thể tạo ticket vào category khác nhau
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Form ID (tùy chọn)</Label>
                      <Input
                        placeholder="Form ID..."
                        value={btnForm.form_id}
                        onChange={(e) => setBtnField("form_id", e.target.value)}
                      />
                    </div>

                    {/* Inline preview */}
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">
                        Xem trước
                      </Label>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const s = getButtonStyle(btnForm.style);
                          return (
                            <div
                              className="inline-flex items-center gap-1.5 rounded-[3px] px-4 py-1.5 text-xs font-medium"
                              style={{
                                backgroundColor: s.bg,
                                color: s.text,
                              }}
                            >
                              {btnForm.emoji && <span>{btnForm.emoji}</span>}
                              {btnForm.label || "Nút"}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={cancelButtonEdit}
                      >
                        Hủy
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={!btnForm.label.trim()}
                        onClick={confirmButton}
                      >
                        {editingBtnIdx < form.buttons.length
                          ? "Cập nhật"
                          : "Thêm"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Discord preview at bottom of buttons tab */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">
                    Xem trước trên Discord
                  </Label>
                  <DiscordPreview form={form} buttons={form.buttons} />
                </div>
              </TabsContent>

              {/* ── Config Tab ── */}
              <TabsContent value="config" className="space-y-4 pt-2">
                <div className="rounded-lg border bg-muted/40 p-3 flex gap-2.5">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Để trống các trường = sử dụng cấu hình chung từ Ticket Config
                  </p>
                </div>

                {/* Naming format */}
                <div className="space-y-1.5">
                  <Label>Định dạng tên ticket</Label>
                  <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                    <Input
                      placeholder="ticket-{number}"
                      value={form.naming_format}
                      onChange={(e) => setField("naming_format", e.target.value)}
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <EmojiPicker onSelect={(em) => setField("naming_format", form.naming_format + em)} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Để trống = dùng cấu hình chung. Biến: {"{number}"}, {"{username}"}, {"{displayname}"}
                  </p>
                </div>

                <Separator />

                {/* Open message - Collapsible */}
                <CollapsibleSection
                  title="Tin nhắn mở ticket"
                  hasContent={!!(form.open_message_title || form.open_message_body)}
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Tiêu đề</Label>
                      <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                        <Input
                          placeholder="Mặc định từ cài đặt chung"
                          value={form.open_message_title}
                          onChange={(e) => setField("open_message_title", e.target.value)}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <EmojiPicker onSelect={(em) => setField("open_message_title", form.open_message_title + em)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nội dung</Label>
                      <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                        <Textarea
                          placeholder="Mặc định từ cài đặt chung"
                          value={form.open_message_body}
                          onChange={(e) => setField("open_message_body", e.target.value)}
                          rows={3}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                        />
                        <EmojiPicker onSelect={(em) => setField("open_message_body", form.open_message_body + em)} />
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Close message - Collapsible */}
                <CollapsibleSection
                  title="Tin nhắn đóng ticket"
                  hasContent={!!(form.close_message_title || form.close_message_body)}
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Tiêu đề</Label>
                      <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                        <Input
                          placeholder="Mặc định từ cài đặt chung"
                          value={form.close_message_title}
                          onChange={(e) => setField("close_message_title", e.target.value)}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <EmojiPicker onSelect={(em) => setField("close_message_title", form.close_message_title + em)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nội dung</Label>
                      <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                        <Textarea
                          placeholder="Mặc định từ cài đặt chung"
                          value={form.close_message_body}
                          onChange={(e) => setField("close_message_body", e.target.value)}
                          rows={3}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                        />
                        <EmojiPicker onSelect={(em) => setField("close_message_body", form.close_message_body + em)} />
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Claim message - Collapsible */}
                <CollapsibleSection
                  title="Tin nhắn claim ticket"
                  hasContent={!!(form.claim_message_title || form.claim_message_body)}
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Tiêu đề</Label>
                      <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                        <Input
                          placeholder="Mặc định từ cài đặt chung"
                          value={form.claim_message_title}
                          onChange={(e) => setField("claim_message_title", e.target.value)}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <EmojiPicker onSelect={(em) => setField("claim_message_title", form.claim_message_title + em)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nội dung</Label>
                      <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                        <Textarea
                          placeholder="Mặc định từ cài đặt chung"
                          value={form.claim_message_body}
                          onChange={(e) => setField("claim_message_body", e.target.value)}
                          rows={3}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                        />
                        <EmojiPicker onSelect={(em) => setField("claim_message_body", form.claim_message_body + em)} />
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>
              </TabsContent>
            </Tabs>

            {/* ── Save / Cancel ── */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSheetOpen(false);
                  setEditingPanel(null);
                }}
              >
                Hủy
              </Button>
              <Button
                className="flex-1"
                disabled={!form.name.trim() || isSaving}
                onClick={handleSave}
              >
                {isSaving
                  ? "Đang lưu..."
                  : editingPanel
                    ? "Cập nhật"
                    : "Tạo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Panel Confirmation Dialog ── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xóa panel?</DialogTitle>
            <DialogDescription>
              Panel{" "}
              <strong className="text-foreground">{deleteTarget?.name}</strong>{" "}
              sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.
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

      {/* ── Group Edit Dialog ── */}
      <Dialog open={groupSheetOpen} onOpenChange={open => { if (!open) { setGroupSheetOpen(false); setEditingGroup(null); } }}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Chỉnh sửa Nhóm" : "Tạo Nhóm"}</DialogTitle>
            <DialogDescription>Gộp nhiều panel vào 1 embed message</DialogDescription>
          </DialogHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Tên nhóm <span className="text-destructive">*</span></Label>
              <Input value={groupForm.name} onChange={e => setGroupForm(f => ({...f, name: e.target.value}))} placeholder="Ví dụ: Hỗ trợ chung" />
            </div>
            <div className="space-y-1.5">
              <Label>Kênh gửi</Label>
              <ChannelSelect value={groupForm.channel_id} onChange={v => setGroupForm(f => ({...f, channel_id: v === "__clear__" ? "" : v}))} placeholder="Chọn kênh..." filter="text" />
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Tiêu đề embed</Label>
              <Input value={groupForm.title} onChange={e => setGroupForm(f => ({...f, title: e.target.value}))} placeholder="Hỗ trợ" />
            </div>
            <div className="space-y-1.5">
              <Label>Mô tả</Label>
              <Textarea value={groupForm.description} onChange={e => setGroupForm(f => ({...f, description: e.target.value}))} placeholder="Mô tả embed..." rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Màu</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={groupForm.color} onChange={e => setGroupForm(f => ({...f, color: e.target.value}))} className="h-9 w-12 rounded border cursor-pointer shrink-0" />
                <Input value={groupForm.color} onChange={e => setGroupForm(f => ({...f, color: e.target.value}))} className="w-28 font-mono" />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Chọn panels trong nhóm</Label>
              <p className="text-xs text-muted-foreground">Các panel được chọn sẽ gộp buttons vào 1 message</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {panels.map(p => {
                  const isInGroup = groupForm.panel_ids.includes(p.id);
                  const isInOtherGroup = !isInGroup && groups.some(g => g.id !== editingGroup?.id && g.panel_ids.includes(p.id));
                  return (
                    <label
                      key={p.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                        isInGroup ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                        isInOtherGroup && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isInGroup}
                        disabled={isInOtherGroup}
                        onChange={() => togglePanelInGroup(p.id)}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.title}</p>
                      </div>
                      {p.buttons.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">{p.buttons.length} btn</Badge>
                      )}
                      {isInOtherGroup && <span className="text-xs text-muted-foreground shrink-0">Đã trong nhóm khác</span>}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => { setGroupSheetOpen(false); setEditingGroup(null); }}>Hủy</Button>
              <Button className="flex-1" disabled={!groupForm.name.trim() || isSavingGroup} onClick={handleSaveGroup}>
                {isSavingGroup ? "Đang lưu..." : editingGroup ? "Cập nhật" : "Tạo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Group Dialog ── */}
      <Dialog open={!!deleteGroupTarget} onOpenChange={open => !open && setDeleteGroupTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xóa nhóm panel?</DialogTitle>
            <DialogDescription>
              Nhóm <strong className="text-foreground">{deleteGroupTarget?.name}</strong> sẽ bị xóa. Các panel bên trong sẽ trở thành panel độc lập.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGroupTarget(null)}>Hủy</Button>
            <Button variant="destructive" disabled={deleteGroupMutation.isPending} onClick={() => deleteGroupTarget && deleteGroupMutation.mutate(deleteGroupTarget.id)}>
              {deleteGroupMutation.isPending ? "Đang xóa..." : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
