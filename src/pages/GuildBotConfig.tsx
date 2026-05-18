import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import { PremiumBadge, PremiumGate } from "@/components/ui/premium-gate";
import { useEntitlements } from "@/hooks/useEntitlements";
import {
  Bot, Save, Loader2, Trash2, CheckCircle2, XCircle, AlertCircle, Eye, EyeOff,
} from "lucide-react";

/* ── Types ──────────────────────────────────────── */

interface GuildBotData {
  configured: boolean;
  client_id: string | null;
  bot_name: string | null;
  bot_avatar_url: string | null;
  status: string;
  has_token: boolean;
  has_secret: boolean;
  error_message: string | null;
}

/* ── API ────────────────────────────────────────── */

async function fetchGuildBot(): Promise<GuildBotData> {
  const res = await apiFetch("/api/guild-bot");
  if (!res.ok) throw new Error("Failed to load guild bot config");
  return res.json();
}

async function saveGuildBot(data: { client_id?: string; bot_token?: string; client_secret?: string }) {
  const res = await apiFetch("/api/guild-bot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save guild bot config");
  return res.json();
}

async function deleteGuildBot() {
  const res = await apiFetch("/api/guild-bot", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete guild bot");
  return res.json();
}

/* ── Component ──────────────────────────────────── */

export function GuildBotConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { hasFeature, isLoading: entLoading } = useEntitlements();

  const { data, isLoading } = useQuery({ queryKey: ["guild-bot"], queryFn: fetchGuildBot });

  const [clientId, setClientId] = useState("");
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const saveMut = useMutation({
    mutationFn: saveGuildBot,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["guild-bot"] });
      if (res.status === "active") {
        toast({ title: "Bot connected", description: `${res.bot_name} is active.` });
      } else {
        toast({ title: "Saved with errors", description: res.error_message || "Token validation failed.", variant: "destructive" });
      }
      setToken("");
      setSecret("");
    },
    onError: () => toast({ title: "Error", description: "Failed to save.", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteGuildBot,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guild-bot"] });
      toast({ title: "Custom bot removed", description: "Reverted to main bot." });
      setClientId("");
      setToken("");
      setSecret("");
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const statusIcon = data?.status === "active"
    ? <CheckCircle2 className="h-4 w-4 text-green-400" />
    : data?.status === "error"
    ? <XCircle className="h-4 w-4 text-red-400" />
    : <AlertCircle className="h-4 w-4 text-yellow-400" />;

  const statusLabel = data?.status === "active" ? "Active" : data?.status === "error" ? "Error" : "Inactive";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5 text-indigo-400" />
          Custom Bot
          <PremiumBadge />
        </h1>
      </div>
      <PremiumGate feature="custom_bot" featureLabel="Custom Bot" hasAccess={hasFeature("custom_bot")} isLoading={entLoading}>
        <p className="text-sm text-muted-foreground mt-1">
          Use your own Discord bot for this guild instead of the main bot. The verification flow will use this bot's OAuth credentials.
        </p>

      {/* Current status */}
      {data?.configured && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {data.bot_avatar_url ? (
                <img src={data.bot_avatar_url} alt="" className="h-10 w-10 rounded-full" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-indigo-400" />
                </div>
              )}
              <div>
                <p className="font-medium text-sm">{data.bot_name || "Unknown Bot"}</p>
                <p className="text-xs text-muted-foreground">ID: {data.client_id}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {statusIcon}
              <span className={data.status === "active" ? "text-green-400" : data.status === "error" ? "text-red-400" : "text-yellow-400"}>
                {statusLabel}
              </span>
            </div>
          </div>
          {data.error_message && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded p-2">{data.error_message}</p>
          )}
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>Token: {data.has_token ? "✓" : "✗"}</span>
            <span>Secret: {data.has_secret ? "✓" : "✗"}</span>
          </div>
        </div>
      )}

      <Separator className="opacity-10" />

      {/* Form */}
      <div className="space-y-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Bot Credentials</p>

        <div className="space-y-1.5">
          <Label className="text-xs">Application (Client) ID</Label>
          <Input
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder={data?.client_id || "Enter application ID..."}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Bot Token</Label>
          <div className="relative">
            <Input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder={data?.has_token ? "••••••••  (saved)" : "Enter bot token..."}
              className="pr-10"
            />
            <button type="button" onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Discord Developer Portal → Application → Bot → Token
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Client Secret</Label>
          <div className="relative">
            <Input
              type={showSecret ? "text" : "password"}
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder={data?.has_secret ? "••••••••  (saved)" : "Enter client secret..."}
              className="pr-10"
            />
            <button type="button" onClick={() => setShowSecret(!showSecret)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Discord Developer Portal → Application → OAuth2 → Client Secret
          </p>
        </div>
      </div>

      {/* Setup instructions */}
      <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-2">
        <p className="text-xs font-semibold text-indigo-300">Setup Instructions</p>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
          <li>Go to <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">Discord Developer Portal</a></li>
          <li>Create a new application (or select existing)</li>
          <li>Copy the <strong>Application ID</strong> and <strong>Client Secret</strong> from OAuth2</li>
          <li>Go to Bot tab, copy the <strong>Bot Token</strong></li>
          <li>In OAuth2 → Redirects, add the redirect URL below</li>
          <li>Invite the bot to your server with required permissions</li>
        </ol>
        <div className="mt-3 space-y-1">
          <p className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider">OAuth2 Redirect URL</p>
          <div className="flex items-center gap-2 rounded-md bg-background/60 border border-indigo-500/20 px-3 py-2">
            <code className="flex-1 text-xs text-indigo-200 break-all select-all">
              {window.location.origin}/api/verify/callback
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/api/verify/callback`);
              }}
              className="shrink-0 text-indigo-400 hover:text-indigo-200 transition-colors"
              title="Copy"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={() => saveMut.mutate({
            client_id: clientId || undefined,
            bot_token: token || undefined,
            client_secret: secret || undefined,
          })}
          disabled={saveMut.isPending || (!clientId && !token && !secret)}
          className="gap-2"
        >
          {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
        {data?.configured && (
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Remove custom bot and revert to main bot?")) {
                deleteMut.mutate();
              }
            }}
            disabled={deleteMut.isPending}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        )}
      </div>
      </PremiumGate>
    </div>
  );
}
