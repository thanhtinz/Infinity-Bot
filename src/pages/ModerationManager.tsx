import { useState, useMemo, useEffect } from "react";
import { useT } from "@/i18n";
import type { ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/hooks/useApi";
import {
  Shield,
  ShieldAlert,
  FileText,
  Clock,
  Settings,
  Trash2,
  Search,
  Pencil,
  Plus,
  Save,
  Gavel,
  Ban,
  UserX,
  Volume2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface ModCase {
  id: number;
  case_number: number;
  action: string;
  target_id: string;
  target_name: string;
  moderator_id: string;
  moderator_name: string;
  reason: string;
  duration: string | null;
  active: boolean;
  role_id: string | null;
  expires_at: string | null;
  created_at: string;
}

interface ModNote {
  id: number;
  target_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

interface ModStats {
  total_cases: number;
  active_moderations: number;
  total_notes: number;
  by_action: Record<string, number>;
}

interface ModerationConfig {
  mute_role_id: string;
  mod_log_channel_id: string;
  lockdown_channels: string;
  ignored_users: string;
  ignored_roles: string;
  ignored_channels: string;
  dm_on_action: boolean;
  show_mod_in_dm: boolean;
  auto_dehoist: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const ACTION_BADGE: Record<string, { cls: string; icon: React.ReactNode }> = {
  warn: {
    cls: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  ban: {
    cls: "bg-red-500/15 text-red-600 border-red-500/30",
    icon: <Ban className="h-3 w-3" />,
  },
  softban: {
    cls: "bg-red-500/15 text-red-600 border-red-500/30",
    icon: <Ban className="h-3 w-3" />,
  },
  kick: {
    cls: "bg-orange-500/15 text-orange-600 border-orange-500/30",
    icon: <UserX className="h-3 w-3" />,
  },
  mute: {
    cls: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    icon: <Volume2 className="h-3 w-3" />,
  },
  timeout: {
    cls: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    icon: <Clock className="h-3 w-3" />,
  },
  unban: {
    cls: "bg-green-500/15 text-green-600 border-green-500/30",
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  unmute: {
    cls: "bg-green-500/15 text-green-600 border-green-500/30",
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  deafen: {
    cls: "bg-purple-500/15 text-purple-600 border-purple-500/30",
    icon: <Volume2 className="h-3 w-3" />,
  },
};

const DEFAULT_BADGE = {
  cls: "bg-gray-500/15 text-gray-600 border-gray-500/30",
  icon: <Gavel className="h-3 w-3" />,
};

function actionBadge(action: string) {
  return ACTION_BADGE[action.toLowerCase()] ?? DEFAULT_BADGE;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(s: string, len = 50) {
  if (!s) return "—";
  return s.length > len ? s.slice(0, len) + "…" : s;
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const { t } = useT();
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function calc() {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining(t("orders_expired"));
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setRemaining(
        h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`
      );
    }
    calc();
    const id = setInterval(calc, 1_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return <span className="font-mono text-sm">{remaining}</span>;
}

// ── Component ──────────────────────────────────────────────────────────────

export function ModerationManager() {
  const { t } = useT();
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Cases state ──
  const [caseSearch, setCaseSearch] = useState("");
  const [caseAction, setCaseAction] = useState("all");
  const [deleteCaseTarget, setDeleteCaseTarget] = useState<ModCase | null>(
    null
  );

  // ── Notes state ──
  const [noteSearch, setNoteSearch] = useState("");
  const [newNoteTarget, setNewNoteTarget] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editNoteTarget, setEditNoteTarget] = useState<ModNote | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [deleteNoteTarget, setDeleteNoteTarget] = useState<ModNote | null>(
    null
  );

  // ── Config state ──
  const [configForm, setConfigForm] = useState<ModerationConfig>({
    mute_role_id: "",
    mod_log_channel_id: "",
    lockdown_channels: "",
    ignored_users: "",
    ignored_roles: "",
    ignored_channels: "",
    dm_on_action: false,
    show_mod_in_dm: false,
    auto_dehoist: false,
  });

  // ── Queries ──

  const { data: stats } = useQuery<ModStats>({
    queryKey: ["moderation-stats"],
    queryFn: () => apiFetch("/api/moderation/stats").then((r) => r.json()),
  });

  const { data: cases = [], isLoading: casesLoading } = useQuery<ModCase[]>({
    queryKey: ["moderation-cases", caseSearch, caseAction],
    queryFn: () => {
      const params = new URLSearchParams();
      if (caseSearch.trim()) params.set("target_id", caseSearch.trim());
      if (caseAction !== "all") params.set("action", caseAction);
      params.set("limit", "50");
      return apiFetch(`/api/moderation/cases?${params}`).then((r) =>
        r.json()
      );
    },
  });

  const { data: activeCases = [], isLoading: activeLoading } = useQuery<
    ModCase[]
  >({
    queryKey: ["moderation-active"],
    queryFn: () =>
      apiFetch("/api/moderation/active").then((r) => r.json()),
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery<ModNote[]>({
    queryKey: ["moderation-notes", noteSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      if (noteSearch.trim()) params.set("target_id", noteSearch.trim());
      return apiFetch(`/api/moderation/notes?${params}`).then((r) =>
        r.json()
      );
    },
  });

  const { data: config } = useQuery<ModerationConfig>({
    queryKey: ["moderation-config"],
    queryFn: () =>
      apiFetch("/api/moderation/config").then((r) => r.json()),
  });

  // Sync config form when config loads
  useEffect(() => {
    if (config) setConfigForm(config);
  }, [config]);

  // ── Mutations ──

  const deleteCaseMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/moderation/cases/${id}`, {
        method: "DELETE",
      }).then((r) => {
        if (!r.ok) throw new Error("Delete failed");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-cases"] });
      qc.invalidateQueries({ queryKey: ["moderation-stats"] });
      qc.invalidateQueries({ queryKey: ["moderation-active"] });
      setDeleteCaseTarget(null);
      toast({ title: t("toast_caseDeleted") });
    },
    onError: () =>
      toast({ title: t("toast_caseDeletFailed"), variant: "destructive" }),
  });

  const addNoteMutation = useMutation({
    mutationFn: (body: { target_id: string; content: string }) =>
      apiFetch("/api/moderation/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Add note failed");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-notes"] });
      qc.invalidateQueries({ queryKey: ["moderation-stats"] });
      setNewNoteTarget("");
      setNewNoteContent("");
      toast({ title: t("toast_noteAdded") });
    },
    onError: () =>
      toast({ title: t("toast_noteAddFailed"), variant: "destructive" }),
  });

  const editNoteMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      apiFetch(`/api/moderation/notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }).then((r) => {
        if (!r.ok) throw new Error("Edit note failed");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-notes"] });
      setEditNoteTarget(null);
      setEditNoteContent("");
      toast({ title: t("toast_noteUpdated") });
    },
    onError: () =>
      toast({ title: t("toast_noteUpdateFailed"), variant: "destructive" }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/moderation/notes/${id}`, {
        method: "DELETE",
      }).then((r) => {
        if (!r.ok) throw new Error("Delete note failed");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-notes"] });
      qc.invalidateQueries({ queryKey: ["moderation-stats"] });
      setDeleteNoteTarget(null);
      toast({ title: t("toast_noteDeleted") });
    },
    onError: () =>
      toast({ title: t("toast_noteDeleteFailed"), variant: "destructive" }),
  });

  const saveConfigMutation = useMutation({
    mutationFn: (body: ModerationConfig) =>
      apiFetch("/api/moderation/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Save config failed");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-config"] });
      toast({ title: t("toast_saved") });
    },
    onError: () =>
      toast({ title: t("toast_error"), variant: "destructive" }),
  });

  // ── Derived ──

  const topAction = useMemo(() => {
    if (!stats?.by_action) return null;
    const entries = Object.entries(stats.by_action);
    if (entries.length === 0) return null;
    return entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  }, [stats]);

  // ── Config helpers ──

  function updateConfig(
    key: keyof ModerationConfig,
    value: string | boolean
  ) {
    setConfigForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleConfigInput(
    key: keyof ModerationConfig,
    e: ChangeEvent<HTMLInputElement>
  ) {
    updateConfig(key, e.target.value);
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-orange-500" />
          {t("mod_title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("mod_totalCases")}, {t("mod_notes")}, {t("mod_allActions")}
        </p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("mod_totalCases")}</p>
              <p className="text-xl font-bold">
                {stats?.total_cases ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-blue-500/10 text-blue-600">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("mod_allActions")}</p>
              <p className="text-xl font-bold">
                {stats?.active_moderations ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-green-500/10 text-green-600">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("mod_notes")}</p>
              <p className="text-xl font-bold">
                {stats?.total_notes ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-orange-500/10 text-orange-600">
              <Gavel className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("mod_topAction")}</p>
              <p className="text-xl font-bold">
                {topAction
                  ? `${topAction[0]} (${topAction[1]})`
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            {t("mod_cases")}
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            {t("mod_notes")}
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {t("mod_allActions")}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            {t("mod_action")}
          </TabsTrigger>
        </TabsList>

        {/* ────────────────── Cases Tab ────────────────── */}
        <TabsContent value="cases" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("mod_searchCases")}
                value={caseSearch}
                onChange={(e) => setCaseSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={caseAction} onValueChange={setCaseAction}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder={t("mod_actionType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                <SelectItem value="warn">{t("warn")}</SelectItem>
                <SelectItem value="ban">{t("ban")}</SelectItem>
                <SelectItem value="softban">{t("softban")}</SelectItem>
                <SelectItem value="kick">{t("kick")}</SelectItem>
                <SelectItem value="mute">{t("mod_mute")}</SelectItem>
                <SelectItem value="timeout">{t("timeout")}</SelectItem>
                <SelectItem value="unban">{t("unban")}</SelectItem>
                <SelectItem value="unmute">{t("unmute")}</SelectItem>
                <SelectItem value="deafen">{t("mod_deafen")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {casesLoading && cases.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              {t("loading")}
            </div>
          ) : cases.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              {t("noData")}
            </div>
          ) : (
            <div className="space-y-2">
              {cases.map((c) => {
                const badge = actionBadge(c.action);
                return (
                  <Card key={c.id}>
                    <CardContent className="p-3 flex items-center gap-3">
                      {/* Badge + case number */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          className={cn(
                            "gap-1 text-[10px] capitalize",
                            badge.cls
                          )}
                        >
                          {badge.icon}
                          {c.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          #{c.case_number}
                        </span>
                      </div>

                      {/* Target + Moderator */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium truncate">
                            {c.target_name || c.target_id}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {t("mod_moderator")} {c.moderator_name || c.moderator_id}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {truncate(c.reason, 80)}
                        </p>
                      </div>

                      {/* Duration + Date */}
                      <div className="flex flex-col items-end shrink-0 gap-0.5">
                        {c.duration && (
                          <span className="text-xs text-muted-foreground">
                            {c.duration}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground/60">
                          {formatDate(c.created_at)}
                        </span>
                      </div>

                      {/* Delete */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                        onClick={() => setDeleteCaseTarget(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ────────────────── Notes Tab ────────────────── */}
        <TabsContent value="notes" className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("mod_searchNotes")}
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Add note form */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Plus className="h-4 w-4" />
                {t("mod_addNote")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3">
                <Input
                  placeholder={t("target")}
                  value={newNoteTarget}
                  onChange={(e) => setNewNoteTarget(e.target.value)}
                />
                <Textarea
                  placeholder={t("mod_noteContent")}
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={
                    addNoteMutation.isPending ||
                    !newNoteTarget.trim() ||
                    !newNoteContent.trim()
                  }
                  onClick={() =>
                    addNoteMutation.mutate({
                      target_id: newNoteTarget.trim(),
                      content: newNoteContent.trim(),
                    })
                  }
                >
                  {addNoteMutation.isPending ? t("saving") : t("mod_addNote")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notes list */}
          {notesLoading && notes.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              {t("loading")}
            </div>
          ) : notes.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              {t("mod_noNotes")}
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map((n) => (
                <Card key={n.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{n.target_id}</span>
                          <span>•</span>
                          <span>{t("mod_addedBy")} {n.author_id}</span>
                          <span>•</span>
                          <span>{formatDate(n.created_at)}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">
                          {n.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditNoteTarget(n);
                            setEditNoteContent(n.content);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteNoteTarget(n)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ────────────────── Active Tab ────────────────── */}
        <TabsContent value="active" className="space-y-4">
          {activeLoading && activeCases.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              {t("loading")}
            </div>
          ) : activeCases.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              {t("noData")}
            </div>
          ) : (
            <div className="space-y-2">
              {activeCases.map((c) => {
                const badge = actionBadge(c.action);
                return (
                  <Card key={c.id}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <Badge
                        className={cn(
                          "gap-1 text-[10px] capitalize shrink-0",
                          badge.cls
                        )}
                      >
                        {badge.icon}
                        {c.action}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium truncate">
                            {c.target_name || c.target_id}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            #{c.case_number}
                          </span>
                        </div>
                        {c.reason && (
                          <p className="text-xs text-muted-foreground truncate">
                            {truncate(c.reason, 60)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-0.5">
                        <span className="text-xs text-muted-foreground">
                          {t("mod_expiresIn")}
                        </span>
                        {c.expires_at ? (
                          <Countdown expiresAt={c.expires_at} />
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ────────────────── Settings Tab ────────────────── */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-6">
              {/* ID fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t("mod_muteRoleId")}</Label>
                  <Input
                    placeholder={t("mod_roleId")}
                    value={configForm.mute_role_id}
                    onChange={(e) => handleConfigInput("mute_role_id", e)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("mod_modLogChannelId")}</Label>
                  <Input
                    placeholder={t("mod_channelId")}
                    value={configForm.mod_log_channel_id}
                    onChange={(e) =>
                      handleConfigInput("mod_log_channel_id", e)
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("mod_lockdownChannels")}</Label>
                <Input
                  placeholder={t("mod_commaSeparatedChannelIds")}
                  value={configForm.lockdown_channels}
                  onChange={(e) =>
                    handleConfigInput("lockdown_channels", e)
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("mod_channelIdsComma")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>{t("mod_ignoredUsers")}</Label>
                  <Input
                    placeholder={t("mod_commaSeparatedUserIds")}
                    value={configForm.ignored_users}
                    onChange={(e) =>
                      handleConfigInput("ignored_users", e)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("mod_ignoredRolesLabel")}</Label>
                  <Input
                    placeholder={t("mod_commaSeparatedRoleIds")}
                    value={configForm.ignored_roles}
                    onChange={(e) =>
                      handleConfigInput("ignored_roles", e)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("mod_ignoredChannelsLabel")}</Label>
                  <Input
                    placeholder={t("mod_commaSeparatedChannelIds")}
                    value={configForm.ignored_channels}
                    onChange={(e) =>
                      handleConfigInput("ignored_channels", e)
                    }
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("mod_dmOnAction")}</Label>
                    <p className="text-[11px] text-muted-foreground">
                      {t("mod_dmOnActionDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={configForm.dm_on_action}
                    onCheckedChange={(v) => updateConfig("dm_on_action", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("mod_showModerator")}</Label>
                    <p className="text-[11px] text-muted-foreground">
                      {t("mod_suppressEmbeds")}
                    </p>
                  </div>
                  <Switch
                    checked={configForm.show_mod_in_dm}
                    onCheckedChange={(v) =>
                      updateConfig("show_mod_in_dm", v)
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("mod_autoDehoist")}</Label>
                    <p className="text-[11px] text-muted-foreground">
                      {t("mod_suppressPings")}
                    </p>
                  </div>
                  <Switch
                    checked={configForm.auto_dehoist}
                    onCheckedChange={(v) =>
                      updateConfig("auto_dehoist", v)
                    }
                  />
                </div>
              </div>

              {/* Save */}
              <div className="flex justify-end">
                <Button
                  disabled={saveConfigMutation.isPending}
                  onClick={() => saveConfigMutation.mutate(configForm)}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveConfigMutation.isPending
                    ? t("saving")
                    : t("save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Delete Case Dialog ── */}
      <Dialog
        open={!!deleteCaseTarget}
        onOpenChange={(o) => !o && setDeleteCaseTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("mod_deleteCase")} #{deleteCaseTarget?.case_number}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("mod_deleteCaseConfirm")}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteCaseTarget(null)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteCaseMutation.isPending}
              onClick={() =>
                deleteCaseTarget &&
                deleteCaseMutation.mutate(deleteCaseTarget.id)
              }
            >
              {deleteCaseMutation.isPending ? t("saving") : t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Note Dialog ── */}
      <Dialog
        open={!!editNoteTarget}
        onOpenChange={(o) => {
          if (!o) {
            setEditNoteTarget(null);
            setEditNoteContent("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("mod_editNote")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editNoteContent}
            onChange={(e) => setEditNoteContent(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditNoteTarget(null);
                setEditNoteContent("");
              }}
            >
              {t("cancel")}
            </Button>
            <Button
              disabled={
                editNoteMutation.isPending || !editNoteContent.trim()
              }
              onClick={() =>
                editNoteTarget &&
                editNoteMutation.mutate({
                  id: editNoteTarget.id,
                  content: editNoteContent.trim(),
                })
              }
            >
              {editNoteMutation.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Note Dialog ── */}
      <Dialog
        open={!!deleteNoteTarget}
        onOpenChange={(o) => !o && setDeleteNoteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("mod_deleteCase")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("mod_deleteCaseConfirm")}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteNoteTarget(null)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteNoteMutation.isPending}
              onClick={() =>
                deleteNoteTarget &&
                deleteNoteMutation.mutate(deleteNoteTarget.id)
              }
            >
              {deleteNoteMutation.isPending ? t("saving") : t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
