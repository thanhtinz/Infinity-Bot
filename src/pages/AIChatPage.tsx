import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/useApi";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDiscordChannels, useDiscordRoles } from "@/hooks/useDiscordData";
import type { DiscordChannel } from "@/hooks/useDiscordData";
import {
  BrainCircuit, Save, Loader2, CheckCircle2, XCircle,
  Plus, Trash2, Upload, FileText, Eye, EyeOff,
  Bot, Key, MessageSquare, Image, BookOpen, History, Settings2,
  Sparkles, RefreshCw, FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface AIChatConfig {
  enabled: boolean;
  provider: string;
  model: string | null;
  api_key: string | null;
  api_key_set: boolean;
  system_prompt: string | null;
  listen_channels: string[];
  ai_manager_role: string | null;
  respond_to_mention: boolean;
  respond_prefix: string;
  ticket_auto_reply: boolean;
  ticket_category_ids: string[];
  ticket_reply_mode: string;
  image_gen_enabled: boolean;
  image_provider: string | null;
  image_api_key: string | null;
  image_api_key_set: boolean;
  max_history: number;
}

interface TrainingDoc {
  id: number;
  title: string;
  doc_type: string;
  filename: string | null;
  enabled: boolean;
  content_preview: string;
  char_count: number;
  created_at: string | null;
}

interface HistoryEntry {
  id: number;
  user_id: string;
  username: string | null;
  channel_id: string | null;
  role: "user" | "assistant";
  content: string;
  timestamp: string | null;
}

// ── Providers ─────────────────────────────────────────────────────────────────

const PROVIDERS = [
  { value: "gemini",     label: "Google Gemini",           icon: "✨" },
  { value: "openai",     label: "OpenAI / ChatGPT",        icon: "🤖" },
  { value: "groq",       label: "Groq",                    icon: "⚡" },
  { value: "deepsearch", label: "DeepSearch (Perplexity)", icon: "🔍" },
];

const DEFAULT_CONFIG: AIChatConfig = {
  enabled: false, provider: "gemini", model: null, api_key: null, api_key_set: false,
  system_prompt: null, listen_channels: [], ai_manager_role: null,
  respond_to_mention: true, respond_prefix: "?", ticket_auto_reply: false,
  ticket_category_ids: [], ticket_reply_mode: "first_msg",
  image_gen_enabled: false, image_provider: null, image_api_key: null,
  image_api_key_set: false, max_history: 10,
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export function AIChatPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: allChannels = [] } = useDiscordChannels();
  const { data: allRoles = [] } = useDiscordRoles();
  const channels = allChannels.filter(c => c.type === 0 || c.type === 5);
  const categories = allChannels.filter(c => c.type === 4);
  const roles = allRoles;

  const [form, setForm] = useState<AIChatConfig>(DEFAULT_CONFIG);
  const [showKey, setShowKey] = useState(false);
  const [showImageKey, setShowImageKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle"|"loading"|"ok"|"error">("idle");
  const [testMsg, setTestMsg] = useState("");

  // ── Data queries ──────────────────────────────────────────────────────────

  const { data: cfg, isLoading: cfgLoading } = useQuery<AIChatConfig>({
    queryKey: ["ai-chat-config"],
    queryFn: () => apiFetch("/api/ai-chat/config").then(r => r.json()),
  });

  const { data: modelsData } = useQuery<{
    providers: Record<string, { value: string; label: string }[]>;
    image_providers: Record<string, { value: string; label: string }[]>;
  }>({
    queryKey: ["ai-chat-models"],
    queryFn: () => apiFetch("/api/ai-chat/models").then(r => r.json()),
    staleTime: Infinity,
  });

  useEffect(() => { if (cfg) setForm(cfg); }, [cfg]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<AIChatConfig>) =>
      apiFetch("/api/ai-chat/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-chat-config"] });
      toast({ title: "Saved!" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const handleTest = async () => {
    setTestStatus("loading"); setTestMsg("");
    try {
      const res = await apiFetch("/api/ai-chat/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: form.provider, model: form.model, api_key: form.api_key }),
      });
      const data = await res.json();
      if (res.ok) { setTestStatus("ok"); setTestMsg(data.message || "Connection successful"); }
      else { setTestStatus("error"); setTestMsg(data.detail || "Failed"); }
    } catch { setTestStatus("error"); setTestMsg("Network error"); }
  };

  const currentModels = modelsData?.providers[form.provider] ?? [];
  const imageModels = modelsData?.image_providers[form.image_provider ?? "openai"] ?? [];

  // ── Training docs ─────────────────────────────────────────────────────────

  const [docDialog, setDocDialog] = useState(false);
  const [viewDoc, setViewDoc] = useState<TrainingDoc | null>(null);
  const [docForm, setDocForm] = useState({ title: "", content: "" });

  const { data: docs = [], isLoading: docsLoading } = useQuery<TrainingDoc[]>({
    queryKey: ["ai-training-docs"],
    queryFn: () => apiFetch("/api/ai-chat/training").then(r => r.json()),
  });

  const addDocMutation = useMutation({
    mutationFn: (d: typeof docForm) =>
      apiFetch("/api/ai-chat/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-training-docs"] });
      setDocDialog(false); setDocForm({ title: "", content: "" });
      toast({ title: "Document added" });
    },
  });

  const toggleDocMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      apiFetch(`/api/ai-chat/training/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-training-docs"] }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/ai-chat/training/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-training-docs"] });
      toast({ title: "Document deleted" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiFetch("/api/ai-chat/training/upload", { method: "POST", body: fd });
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ["ai-training-docs"] });
      toast({ title: "File uploaded" });
    } else {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    e.target.value = "";
  };

  // ── History ───────────────────────────────────────────────────────────────

  const [histFilter, setHistFilter] = useState("");

  const { data: histStats } = useQuery<{ total_messages: number; unique_users: number }>({
    queryKey: ["ai-history-stats"],
    queryFn: () => apiFetch("/api/ai-chat/history/stats").then(r => r.json()),
  });

  const { data: history = [], isLoading: histLoading, refetch: refetchHistory } = useQuery<HistoryEntry[]>({
    queryKey: ["ai-history", histFilter],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "100" });
      if (histFilter) p.set("user_id", histFilter);
      return apiFetch(`/api/ai-chat/history?${p}`).then(r => r.json());
    },
  });

  const clearHistMutation = useMutation({
    mutationFn: () => apiFetch("/api/ai-chat/history", { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-history"] });
      qc.invalidateQueries({ queryKey: ["ai-history-stats"] });
      toast({ title: "History cleared" });
    },
  });

  const toggleChannel = (id: string) =>
    setForm(f => ({
      ...f,
      listen_channels: f.listen_channels.includes(id)
        ? f.listen_channels.filter(c => c !== id)
        : [...f.listen_channels, id],
    }));

  if (cfgLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <BrainCircuit className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Chat</h1>
            <p className="text-sm text-muted-foreground">Per-server AI assistant — Groq, Gemini, ChatGPT, DeepSearch</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-sm text-muted-foreground">Enable</span>
          <Switch
            checked={form.enabled}
            onCheckedChange={v => {
              const next = { ...form, enabled: v };
              setForm(next);
              saveMutation.mutate(next);
            }}
          />
          {form.enabled
            ? <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-300">Active</Badge>
            : <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>}
        </div>
      </div>

      <Tabs defaultValue="config">
        <TabsList className="h-10 w-full sm:w-auto">
          <TabsTrigger value="config"  className="gap-1.5 text-xs sm:text-sm"><Settings2 className="h-3.5 w-3.5" />Config</TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5 text-xs sm:text-sm"><BookOpen className="h-3.5 w-3.5" />Training</TabsTrigger>
          <TabsTrigger value="history"  className="gap-1.5 text-xs sm:text-sm"><History  className="h-3.5 w-3.5" />History</TabsTrigger>
          <TabsTrigger value="imagegen" className="gap-1.5 text-xs sm:text-sm"><Image    className="h-3.5 w-3.5" />Image Gen</TabsTrigger>
        </TabsList>

        {/* ────────────────── CONFIG ────────────────── */}
        <TabsContent value="config" className="mt-4 space-y-4">

          {/* Provider */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4" />AI Provider & Model
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Provider cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PROVIDERS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setForm(f => ({ ...f, provider: p.value, model: null }))}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                      form.provider === p.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                    )}
                  >
                    <span className="text-2xl">{p.icon}</span>
                    <span className="text-xs text-center leading-tight font-medium">{p.label}</span>
                  </button>
                ))}
              </div>

              {/* Model + max history */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Model</Label>
                  <Select
                    value={form.model ?? "__default"}
                    onValueChange={v => setForm(f => ({ ...f, model: v === "__default" ? null : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Default model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default">Default model</SelectItem>
                      {currentModels.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>History window <span className="text-xs text-muted-foreground">(messages)</span></Label>
                  <Input
                    type="number" min={1} max={50}
                    value={form.max_history}
                    onChange={e => setForm(f => ({ ...f, max_history: parseInt(e.target.value) || 10 }))}
                  />
                </div>
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5" />API Key
                  {form.api_key_set && (
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">Configured</Badge>
                  )}
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKey ? "text" : "password"}
                      placeholder={form.api_key_set ? "••••••••••••••••" : "Enter API key…"}
                      value={form.api_key ?? ""}
                      onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                      className="pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleTest} disabled={testStatus === "loading"} className="shrink-0">
                    {testStatus === "loading"
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      : <FlaskConical className="h-3.5 w-3.5 mr-1" />}
                    Test
                  </Button>
                </div>
                {testStatus !== "idle" && (
                  <p className={cn("text-xs flex items-center gap-1 mt-1", testStatus === "ok" ? "text-emerald-600" : "text-destructive")}>
                    {testStatus === "ok" ? <CheckCircle2 className="h-3.5 w-3.5" /> : testStatus === "error" ? <XCircle className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {testMsg}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Channels & Triggers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />Channels & Triggers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch id="mention" checked={form.respond_to_mention} onCheckedChange={v => setForm(f => ({ ...f, respond_to_mention: v }))} />
                  <Label htmlFor="mention">Respond to @mention</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="ticket-ai" checked={form.ticket_auto_reply} onCheckedChange={v => setForm(f => ({ ...f, ticket_auto_reply: v }))} />
                  <Label htmlFor="ticket-ai">Ticket AI (external bots)</Label>
                </div>
              </div>

              <div className="flex items-end gap-3">
                <div className="space-y-1.5 w-28">
                  <Label>Prefix trigger</Label>
                  <Input
                    placeholder="?"
                    maxLength={5}
                    value={form.respond_prefix}
                    onChange={e => setForm(f => ({ ...f, respond_prefix: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground pb-2.5">Messages starting with this trigger the bot</p>
              </div>

              {/* Channel whitelist */}
              <div className="space-y-1.5">
                <Label>Listen in channels <span className="text-xs font-normal text-muted-foreground">(empty = all)</span></Label>
                <div className="border rounded-lg max-h-44 overflow-y-auto divide-y">
                  {channels.map((ch) => (
                      <label key={ch.id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.listen_channels.includes(ch.id)}
                          onChange={() => toggleChannel(ch.id)}
                          className="rounded"
                        />
                        <span className="text-sm"># {ch.name}</span>
                      </label>
                    ))}
                  {channels.length === 0 && <p className="text-xs text-muted-foreground p-3">No channels loaded</p>}
                </div>
                {form.listen_channels.length > 0 && (
                  <p className="text-xs text-muted-foreground">{form.listen_channels.length} channel(s) selected</p>
                )}
              </div>

              {/* Manager role */}
              <div className="space-y-1.5">
                <Label>AI Manager Role</Label>
                <Select
                  value={form.ai_manager_role ?? "__none"}
                  onValueChange={v => setForm(f => ({ ...f, ai_manager_role: v === "__none" ? null : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="No restriction" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No restriction</SelectItem>
                    {roles.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Ticket AI (External Bots) */}
          {form.ticket_auto_reply && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />Ticket AI Configuration
                </CardTitle>
                <CardDescription>
                  AI will auto-reply to user messages in ticket channels created by external bots (Ticket Tool, TicketBot, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Reply mode */}
                <div className="space-y-1.5">
                  <Label>Reply Mode</Label>
                  <Select
                    value={form.ticket_reply_mode}
                    onValueChange={v => setForm(f => ({ ...f, ticket_reply_mode: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first_msg">First message only — reply once when user sends first message</SelectItem>
                      <SelectItem value="all_msg">All messages — reply to every user message in ticket</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Ticket category select */}
                <div className="space-y-1.5">
                  <Label>Ticket Categories</Label>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Select the Discord categories where ticket bots create channels. AI will respond to messages in channels under these categories.
                  </p>
                  <div className="border rounded-lg max-h-44 overflow-y-auto divide-y">
                    {categories.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3">No categories found</p>
                    ) : categories.map((cat) => (
                      <label key={cat.id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.ticket_category_ids.includes(cat.id)}
                          onChange={() => setForm(f => ({
                            ...f,
                            ticket_category_ids: f.ticket_category_ids.includes(cat.id)
                              ? f.ticket_category_ids.filter(c => c !== cat.id)
                              : [...f.ticket_category_ids, cat.id],
                          }))}
                          className="rounded"
                        />
                        <span className="text-sm">📁 {cat.name}</span>
                      </label>
                    ))}
                  </div>
                  {form.ticket_category_ids.length > 0 && (
                    <p className="text-xs text-muted-foreground">{form.ticket_category_ids.length} categor{form.ticket_category_ids.length !== 1 ? "ies" : "y"} selected</p>
                  )}
                </div>

                <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">How it works</p>
                  <p>• Bot detects channels inside the selected categories</p>
                  <p>• When a user sends a message → AI responds using your training data + system prompt</p>
                  <p>• Works with any ticket bot: Ticket Tool, TicketBot, Helper.gg, etc.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* System Prompt */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />Personality / System Prompt
              </CardTitle>
              <CardDescription>Define how the AI behaves. Training documents are appended automatically.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="You are a helpful assistant for this server. Be friendly and concise…"
                className="min-h-[120px] resize-none"
                value={form.system_prompt ?? ""}
                onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Configuration
            </Button>
          </div>
        </TabsContent>

        {/* ────────────────── TRAINING ────────────────── */}
        <TabsContent value="training" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold">Knowledge Base</p>
              <p className="text-sm text-muted-foreground">
                {docs.length} document{docs.length !== 1 ? "s" : ""} · injected as system context
              </p>
            </div>
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input type="file" accept=".txt,.md,.pdf" className="hidden" onChange={handleFileUpload} />
                <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium hover:bg-accent cursor-pointer transition-colors">
                  <Upload className="h-3.5 w-3.5" />Upload File
                </div>
              </label>
              <Button size="sm" className="gap-1.5" onClick={() => setDocDialog(true)}>
                <Plus className="h-3.5 w-3.5" />Add Text
              </Button>
            </div>
          </div>

          {docsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 border-2 border-dashed rounded-xl text-muted-foreground">
              <BookOpen className="h-10 w-10 opacity-25" />
              <p className="font-medium">No training documents yet</p>
              <p className="text-sm">Add text or upload files to teach the AI about your server</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map(doc => (
                <Card key={doc.id} className={cn("transition-opacity", !doc.enabled && "opacity-50")}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="shrink-0 text-muted-foreground">
                      {doc.doc_type === "file" ? <Upload className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{doc.title}</p>
                        <Badge variant="outline" className="text-xs">{doc.doc_type}</Badge>
                        <span className="text-xs text-muted-foreground">{doc.char_count.toLocaleString()} chars</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.content_preview}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewDoc(doc)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Switch
                        checked={doc.enabled}
                        onCheckedChange={v => toggleDocMutation.mutate({ id: doc.id, enabled: v })}
                      />
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteDocMutation.mutate(doc.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Add doc dialog */}
          <Dialog open={docDialog} onOpenChange={setDocDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Training Document</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    placeholder="e.g. Server Rules, Product FAQ…"
                    value={docForm.title}
                    onChange={e => setDocForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Content</Label>
                  <Textarea
                    placeholder="Enter the knowledge content here…"
                    className="min-h-[200px] resize-none"
                    value={docForm.content}
                    onChange={e => setDocForm(f => ({ ...f, content: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">{docForm.content.length.toLocaleString()} chars</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDocDialog(false)}>Cancel</Button>
                <Button
                  onClick={() => addDocMutation.mutate(docForm)}
                  disabled={addDocMutation.isPending || !docForm.title || !docForm.content}
                >
                  {addDocMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Add Document
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* View doc dialog */}
          <Dialog open={!!viewDoc} onOpenChange={() => setViewDoc(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{viewDoc?.title}</DialogTitle></DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <pre className="text-xs whitespace-pre-wrap font-mono p-1">{viewDoc?.content_preview}</pre>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ────────────────── HISTORY ────────────────── */}
        <TabsContent value="history" className="mt-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-2xl font-bold">{histStats?.total_messages ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total messages</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-2xl font-bold">{histStats?.unique_users ?? 0}</p>
                <p className="text-xs text-muted-foreground">Unique users</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Filter by User ID…"
              value={histFilter}
              onChange={e => setHistFilter(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" size="icon" onClick={() => refetchHistory()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all AI conversation history for this server.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearHistMutation.mutate()}>Clear</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {histLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <History className="h-8 w-8 opacity-25" />
              <p className="text-sm">No history yet</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {history.map(entry => (
                <div
                  key={entry.id}
                  className={cn(
                    "flex gap-3 p-3 rounded-lg text-sm",
                    entry.role === "assistant"
                      ? "bg-primary/5 border border-primary/10"
                      : "bg-muted/40"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5",
                    entry.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    {entry.role === "assistant" ? "🤖" : "👤"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-medium text-xs">
                        {entry.role === "assistant" ? "AI Assistant" : (entry.username || entry.user_id)}
                      </span>
                      {entry.timestamp && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm break-words">{entry.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ────────────────── IMAGE GEN ────────────────── */}
        <TabsContent value="imagegen" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="h-4 w-4" />Image Generation
              </CardTitle>
              <CardDescription>
                Allow users to generate images with <code className="text-xs bg-muted px-1 rounded">/ai imagine</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="img-en"
                  checked={form.image_gen_enabled}
                  onCheckedChange={v => setForm(f => ({ ...f, image_gen_enabled: v }))}
                />
                <Label htmlFor="img-en">Enable Image Generation</Label>
              </div>

              {form.image_gen_enabled && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Image Provider</Label>
                      <Select
                        value={form.image_provider ?? "openai"}
                        onValueChange={v => setForm(f => ({ ...f, image_provider: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">🤖 OpenAI DALL·E</SelectItem>
                          <SelectItem value="gemini">✨ Google Imagen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Image Model</Label>
                      <Select
                        value={form.model ?? "__default"}
                        onValueChange={v => setForm(f => ({ ...f, model: v === "__default" ? null : v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default">Default</SelectItem>
                          {imageModels.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5" />Image API Key
                      {form.image_api_key_set && (
                        <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">Configured</Badge>
                      )}
                      <span className="text-xs text-muted-foreground font-normal">(optional — uses main key if empty)</span>
                    </Label>
                    <div className="relative">
                      <Input
                        type={showImageKey ? "text" : "password"}
                        placeholder={form.image_api_key_set ? "••••••••••••••••" : "Optional separate key…"}
                        value={form.image_api_key ?? ""}
                        onChange={e => setForm(f => ({ ...f, image_api_key: e.target.value }))}
                        className="pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowImageKey(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showImageKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/40 border p-3 text-sm">
                    <p className="font-medium mb-1">Bot command</p>
                    <code className="text-xs bg-background px-1.5 py-0.5 rounded border">/ai imagine prompt: A futuristic city at sunset</code>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
