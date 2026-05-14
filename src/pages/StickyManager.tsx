import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Pin,
  CheckCircle,
  RefreshCw,
  Layers,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StickyMessage {
  id: number;
  guild_id: string;
  channel_id: string;
  content: string | null;
  embed_enabled: boolean;
  embed_title: string | null;
  embed_description: string | null;
  embed_color: string;
  embed_footer: string | null;
  embed_image_url: string | null;
  embed_thumbnail_url: string | null;
  message_count_trigger: number;
  interval_minutes: number;
  is_enabled: boolean;
  is_pinned: boolean;
  resend_count: number;
  created_at: string;
  last_sent: string | null;
  expires_at: string | null;
}

interface StickyStats {
  total: number;
  active: number;
  total_resends: number;
  embed_count: number;
  pinned_count: number;
}

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

interface FormData {
  channel_id: string;
  content: string;
  embed_enabled: boolean;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  embed_footer: string;
  embed_image_url: string;
  embed_thumbnail_url: string;
  message_count_trigger: number;
  interval_minutes: number;
  is_enabled: boolean;
  is_pinned: boolean;
  expires_at: string;
}

const EMPTY_FORM: FormData = {
  channel_id: "",
  content: "",
  embed_enabled: false,
  embed_title: "",
  embed_description: "",
  embed_color: "#5865F2",
  embed_footer: "",
  embed_image_url: "",
  embed_thumbnail_url: "",
  message_count_trigger: 1,
  interval_minutes: 0,
  is_enabled: true,
  is_pinned: false,
  expires_at: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(s: string | null, len = 80) {
  if (!s) return "";
  return s.length > len ? s.slice(0, len) + "…" : s;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StickyManager() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState("content");
  const [deleteTarget, setDeleteTarget] = useState<StickyMessage | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: stickies = [], isLoading } = useQuery<StickyMessage[]>({
    queryKey: ["stickies"],
    queryFn: () =>
      fetch("/api/sticky", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: stats } = useQuery<StickyStats>({
    queryKey: ["sticky-stats"],
    queryFn: () =>
      fetch("/api/sticky/stats", { credentials: "include" }).then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  });

  const { data: channels = [] } = useQuery<DiscordChannel[]>({
    queryKey: ["discord-channels"],
    queryFn: () =>
      fetch("/api/discord/channels/all", { credentials: "include" }).then(
        (r) => r.json()
      ),
    staleTime: 300_000,
  });

  const textChannels = channels.filter((c) => c.type === 0);
  const channelMap = new Map(channels.map((c) => [c.id, c.name]));

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      fetch("/api/sticky", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          channel_id: data.channel_id,
          content: data.content || null,
          embed_enabled: data.embed_enabled,
          embed_title: data.embed_title || null,
          embed_description: data.embed_description || null,
          embed_color: data.embed_color,
          embed_footer: data.embed_footer || null,
          embed_image_url: data.embed_image_url || null,
          embed_thumbnail_url: data.embed_thumbnail_url || null,
          message_count_trigger: data.message_count_trigger,
          interval_minutes: data.interval_minutes,
          is_enabled: data.is_enabled,
          is_pinned: data.is_pinned,
          expires_at: data.expires_at || null,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stickies"] });
      qc.invalidateQueries({ queryKey: ["sticky-stats"] });
      closeSheet();
      toast({ title: "Đã tạo sticky" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) =>
      fetch(`/api/sticky/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: data.content || null,
          embed_enabled: data.embed_enabled,
          embed_title: data.embed_title || null,
          embed_description: data.embed_description || null,
          embed_color: data.embed_color,
          embed_footer: data.embed_footer || null,
          embed_image_url: data.embed_image_url || null,
          embed_thumbnail_url: data.embed_thumbnail_url || null,
          message_count_trigger: data.message_count_trigger,
          interval_minutes: data.interval_minutes,
          is_enabled: data.is_enabled,
          is_pinned: data.is_pinned,
          expires_at: data.expires_at || null,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stickies"] });
      qc.invalidateQueries({ queryKey: ["sticky-stats"] });
      closeSheet();
      toast({ title: "Đã cập nhật sticky" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/sticky/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stickies"] });
      qc.invalidateQueries({ queryKey: ["sticky-stats"] });
      setDeleteTarget(null);
      toast({ title: "Đã xóa sticky" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      fetch(`/api/sticky/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_enabled: enabled }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stickies"] });
      qc.invalidateQueries({ queryKey: ["sticky-stats"] });
      toast({ title: "Đã cập nhật trạng thái" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const resendMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/sticky/${id}/resend`, {
        method: "POST",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stickies"] });
      qc.invalidateQueries({ queryKey: ["sticky-stats"] });
      toast({ title: "Đã gửi lại sticky" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setActiveTab("content");
    setSheetOpen(true);
  }

  function openEdit(s: StickyMessage) {
    setEditingId(s.id);
    setForm({
      channel_id: s.channel_id,
      content: s.content ?? "",
      embed_enabled: s.embed_enabled,
      embed_title: s.embed_title ?? "",
      embed_description: s.embed_description ?? "",
      embed_color: s.embed_color || "#5865F2",
      embed_footer: s.embed_footer ?? "",
      embed_image_url: s.embed_image_url ?? "",
      embed_thumbnail_url: s.embed_thumbnail_url ?? "",
      message_count_trigger: s.message_count_trigger,
      interval_minutes: s.interval_minutes,
      is_enabled: s.is_enabled,
      is_pinned: s.is_pinned,
      expires_at: s.expires_at
        ? new Date(s.expires_at).toISOString().slice(0, 16)
        : "",
    });
    setActiveTab("content");
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit() {
    if (!form.channel_id) {
      toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Vui lòng chọn kênh",
      });
      return;
    }
    if (!form.content && !form.embed_description) {
      toast({
        variant: "destructive",
        title: "Thiếu nội dung",
        description: "Vui lòng nhập nội dung hoặc mô tả embed",
      });
      return;
    }
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Pin className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold">Sticky Messages</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Quản lý tin nhắn tự động ghim trong các kênh
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Tạo Sticky
          </Button>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="p-2 rounded-md bg-blue-500/10 text-blue-500">
                <Pin className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Tổng sticky</p>
                <p className="text-xl font-bold">{stats?.total ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="p-2 rounded-md bg-green-500/10 text-green-500">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Đang bật</p>
                <p className="text-xl font-bold">{stats?.active ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="p-2 rounded-md bg-purple-500/10 text-purple-500">
                <RefreshCw className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Tổng gửi lại</p>
                <p className="text-xl font-bold">{stats?.total_resends ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="p-2 rounded-md bg-orange-500/10 text-orange-500">
                <Layers className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Embed</p>
                <p className="text-xl font-bold">{stats?.embed_count ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Loading Skeleton ── */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16" />
                    <div className="flex-1" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                  <Skeleton className="h-4 w-3/4 mt-3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Empty State ── */}
        {!isLoading && stickies.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Pin className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Chưa có sticky nào</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Tạo sticky đầu tiên để tự động ghim tin nhắn trong kênh
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Tạo sticky đầu tiên
            </Button>
          </div>
        )}

        {/* ── Sticky List ── */}
        {!isLoading && stickies.length > 0 && (
          <div className="space-y-3">
            {stickies.map((s) => {
              const chName = channelMap.get(s.channel_id);
              const preview = s.embed_enabled
                ? truncate(
                    [s.embed_title, s.embed_description]
                      .filter(Boolean)
                      .join(" — "),
                    80
                  )
                : truncate(s.content, 80);

              return (
                <Card
                  key={s.id}
                  className={cn(
                    "transition-colors",
                    s.is_enabled && "border-primary/50"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      {/* Left section */}
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-mono text-sm font-medium truncate">
                          #{chName || s.channel_id}
                        </span>
                        <Badge
                          variant={
                            s.embed_enabled ? "default" : "secondary"
                          }
                          className="shrink-0"
                        >
                          {s.embed_enabled ? "Embed" : "Text"}
                        </Badge>
                        <Badge
                          variant={
                            s.is_enabled ? "default" : "secondary"
                          }
                          className={cn(
                            "shrink-0",
                            s.is_enabled
                              ? "bg-green-500/15 text-green-600 hover:bg-green-500/25 dark:text-green-400"
                              : ""
                          )}
                        >
                          {s.is_enabled ? "Đang bật" : "Đã tắt"}
                        </Badge>
                        {s.is_pinned && (
                          <Pin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                      </div>

                      {/* Right section: trigger info + actions */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-xs text-muted-foreground text-right leading-relaxed">
                          <div>
                            Sau {s.message_count_trigger} tin nhắn
                            {s.interval_minutes > 0 &&
                              ` · ${s.interval_minutes} phút`}
                          </div>
                          <div>
                            Gửi lại: {s.resend_count} · {formatDate(s.last_sent)}
                          </div>
                        </div>

                        <Separator orientation="vertical" className="h-8" />

                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  toggleMutation.mutate({
                                    id: s.id,
                                    enabled: !s.is_enabled,
                                  })
                                }
                                disabled={toggleMutation.isPending}
                              >
                                {s.is_enabled ? (
                                  <Eye className="h-4 w-4" />
                                ) : (
                                  <EyeOff className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {s.is_enabled ? "Tắt sticky" : "Bật sticky"}
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => resendMutation.mutate(s.id)}
                                disabled={resendMutation.isPending}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Gửi lại ngay</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEdit(s)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Chỉnh sửa</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(s)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Xóa</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>

                    {/* Content preview */}
                    {preview && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {preview}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Delete Confirmation ── */}
        <AlertDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa sticky?</AlertDialogTitle>
              <AlertDialogDescription>
                Sticky trong kênh #
                {deleteTarget
                  ? channelMap.get(deleteTarget.channel_id) ||
                    deleteTarget.channel_id
                  : ""}{" "}
                sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() =>
                  deleteTarget && deleteMutation.mutate(deleteTarget.id)
                }
              >
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Create / Edit Sheet ── */}
        <Sheet open={sheetOpen} onOpenChange={(open) => !open && closeSheet()}>
          <SheetContent
            side="right"
            className="sm:max-w-[500px] overflow-y-auto"
          >
            <SheetHeader>
              <SheetTitle>
                {editingId !== null ? "Chỉnh sửa Sticky" : "Tạo Sticky mới"}
              </SheetTitle>
              <SheetDescription>
                {editingId !== null
                  ? "Cập nhật cấu hình sticky message"
                  : "Thiết lập tin nhắn tự động ghim trong kênh"}
              </SheetDescription>
            </SheetHeader>

            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="mt-4"
            >
              <TabsList className="w-full">
                <TabsTrigger value="content" className="flex-1">
                  Nội dung
                </TabsTrigger>
                <TabsTrigger value="embed" className="flex-1">
                  Embed
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex-1">
                  Cài đặt
                </TabsTrigger>
              </TabsList>

              {/* ── Tab: Nội dung ── */}
              <TabsContent value="content" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="embed-switch">Dùng Embed</Label>
                  <Switch
                    id="embed-switch"
                    checked={form.embed_enabled}
                    onCheckedChange={(checked) => {
                      setForm((f) => ({ ...f, embed_enabled: checked }));
                      if (checked) setActiveTab("embed");
                    }}
                  />
                </div>

                {!form.embed_enabled && (
                  <div className="space-y-2">
                    <Label htmlFor="content">Nội dung</Label>
                    <Textarea
                      id="content"
                      placeholder="Nội dung tin nhắn sticky…"
                      value={form.content}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, content: e.target.value }))
                      }
                      maxLength={2000}
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {form.content.length}/2000
                    </p>
                  </div>
                )}

                {form.embed_enabled && (
                  <div className="rounded-lg border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                    Embed đang bật. Chuyển sang tab{" "}
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => setActiveTab("embed")}
                    >
                      Embed
                    </button>{" "}
                    để chỉnh sửa.
                  </div>
                )}
              </TabsContent>

              {/* ── Tab: Embed ── */}
              <TabsContent value="embed" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="embed-switch-2">Dùng Embed</Label>
                  <Switch
                    id="embed-switch-2"
                    checked={form.embed_enabled}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, embed_enabled: checked }))
                    }
                  />
                </div>

                {form.embed_enabled && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="embed-title">Tiêu đề</Label>
                      <Input
                        id="embed-title"
                        placeholder="Tiêu đề embed"
                        value={form.embed_title}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            embed_title: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="embed-desc">Mô tả</Label>
                      <Textarea
                        id="embed-desc"
                        placeholder="Mô tả embed…"
                        value={form.embed_description}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            embed_description: e.target.value,
                          }))
                        }
                        rows={5}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Màu</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={form.embed_color}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              embed_color: e.target.value,
                            }))
                          }
                          className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-0.5"
                        />
                        <Input
                          value={form.embed_color}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              embed_color: e.target.value,
                            }))
                          }
                          className="flex-1 font-mono"
                          maxLength={7}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="embed-footer">Footer</Label>
                      <Input
                        id="embed-footer"
                        placeholder="Chữ footer"
                        value={form.embed_footer}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            embed_footer: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="embed-image">Image URL</Label>
                      <Input
                        id="embed-image"
                        placeholder="https://example.com/image.png"
                        value={form.embed_image_url}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            embed_image_url: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="embed-thumb">Thumbnail URL</Label>
                      <Input
                        id="embed-thumb"
                        placeholder="https://example.com/thumb.png"
                        value={form.embed_thumbnail_url}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            embed_thumbnail_url: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </>
                )}

                {!form.embed_enabled && (
                  <div className="rounded-lg border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                    Embed đang tắt. Bật chuyển đổi ở trên để cấu hình embed.
                  </div>
                )}
              </TabsContent>

              {/* ── Tab: Cài đặt ── */}
              <TabsContent value="settings" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Kênh</Label>
                  <Select
                    value={form.channel_id}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, channel_id: v }))
                    }
                    disabled={editingId !== null}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn kênh…" />
                    </SelectTrigger>
                    <SelectContent>
                      {textChannels.map((ch) => (
                        <SelectItem key={ch.id} value={ch.id}>
                          #{ch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="msg-trigger">Gửi lại sau X tin nhắn</Label>
                  <Input
                    id="msg-trigger"
                    type="number"
                    min={1}
                    value={form.message_count_trigger}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        message_count_trigger: Math.max(
                          1,
                          parseInt(e.target.value) || 1
                        ),
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interval">
                    Interval (phút, 0 = tắt)
                  </Label>
                  <Input
                    id="interval"
                    type="number"
                    min={0}
                    value={form.interval_minutes}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        interval_minutes: Math.max(
                          0,
                          parseInt(e.target.value) || 0
                        ),
                      }))
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Label htmlFor="is-enabled">Bật sticky</Label>
                  <Switch
                    id="is-enabled"
                    checked={form.is_enabled}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, is_enabled: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="is-pinned">Ghim tin nhắn</Label>
                  <Switch
                    id="is-pinned"
                    checked={form.is_pinned}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, is_pinned: checked }))
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="expires-at">
                    Hết hạn (tùy chọn)
                  </Label>
                  <Input
                    id="expires-at"
                    type="datetime-local"
                    value={form.expires_at}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, expires_at: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Để trống nếu không muốn hết hạn
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* ── Sheet Footer ── */}
            <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={closeSheet}>
                Hủy
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting
                  ? "Đang lưu…"
                  : editingId !== null
                    ? "Cập nhật"
                    : "Tạo sticky"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
