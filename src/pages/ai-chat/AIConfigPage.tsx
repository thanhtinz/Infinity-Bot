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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDiscordChannels, useDiscordRoles } from "@/hooks/useDiscordData";
import type { DiscordChannel } from "@/hooks/useDiscordData";
import {
  BrainCircuit, Save, Loader2, CheckCircle2, XCircle,
  Bot, Key, MessageSquare, Settings2,
  Sparkles, FlaskConical, FolderOpen, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PROVIDERS, DEFAULT_CONFIG } from "./shared";
import type { AIChatConfig } from "./shared";

function SaveBtn({ onClick, pending }: { onClick: () => void; pending: boolean }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending} className="gap-1.5 ml-auto shrink-0">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">Save</span>
    </Button>
  );
}

export function AIConfigPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: allChannels = [] } = useDiscordChannels();
  const { data: allRoles = [] } = useDiscordRoles();
  const channels = allChannels.filter((c: DiscordChannel) => c.type === 0 || c.type === 5);
  const categories = allChannels.filter((c: DiscordChannel) => c.type === 4);
  const roles = allRoles;

  const [form, setForm] = useState<AIChatConfig>(DEFAULT_CONFIG);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

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

  const saveFields = (...keys: (keyof AIChatConfig)[]) => {
    const partial: Partial<AIChatConfig> = {};
    for (const k of keys) (partial as Record<string, unknown>)[k] = form[k];
    saveMutation.mutate(partial);
  };

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
    <div className="space-y-6">
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

      {/* Provider */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" />AI Provider & Model
            </CardTitle>
            <SaveBtn onClick={() => saveFields("provider", "model", "max_history", "api_key")} pending={saveMutation.isPending} />
          </div>
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
                <p.icon className="h-5 w-5" />
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />Channels & Triggers
            </CardTitle>
            <SaveBtn onClick={() => saveFields("respond_to_mention", "respond_prefix", "listen_channels", "ai_manager_role", "ticket_auto_reply")} pending={saveMutation.isPending} />
          </div>
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
              {channels.map((ch: DiscordChannel) => (
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
                {roles.map((r: { id: string; name: string }) => (
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />Ticket AI Configuration
                </CardTitle>
                <CardDescription>
                  AI will auto-reply to user messages in ticket channels created by external bots (Ticket Tool, TicketBot, etc.)
                </CardDescription>
              </div>
              <SaveBtn onClick={() => saveFields("ticket_reply_mode", "ticket_category_ids")} pending={saveMutation.isPending} />
            </div>
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
                ) : categories.map((cat: DiscordChannel) => (
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
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{cat.name}</span>
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />Personality / System Prompt
              </CardTitle>
              <CardDescription>Define how the AI behaves. Training documents are appended automatically.</CardDescription>
            </div>
            <SaveBtn onClick={() => saveFields("system_prompt")} pending={saveMutation.isPending} />
          </div>
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
    </div>
  );
}
