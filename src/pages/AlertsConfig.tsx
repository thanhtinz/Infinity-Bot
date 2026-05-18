import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Bell, Bomb, UserX, LogOut, FolderMinus, Tag,
  ShieldCheck, Save, FlaskConical, Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PremiumGate } from "@/components/ui/premium-gate";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useGuild } from "@/contexts/GuildContext";
import { apiFetch } from "@/hooks/useApi";

/* ── Types ──────────────────────────────────────────── */
interface AlertConfig {
  id: number | null;
  alert_type: string;
  label: string;
  enabled: boolean;
  threshold: number;
  window_minutes: number;
  webhook_url: string | null;
}

interface AlertHistoryEntry {
  id: number;
  alert_type: string;
  actor_id: string | null;
  actor_name: string | null;
  details: Record<string, unknown> | null;
  severity: string;
  created_at: string | null;
}

const ALERT_ICONS: Record<string, LucideIcon> = {
  mass_ban: UserX,
  mass_kick: LogOut,
  channel_delete: FolderMinus,
  role_delete: Tag,
  nuke_detect: Bomb,
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-500",
  warning: "bg-yellow-500",
  critical: "bg-red-500",
};

/* ── Helpers ────────────────────────────────────────── */
function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

/* ── Component ──────────────────────────────────────── */
export function AlertsConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { hasFeature, isLoading: entLoading } = useEntitlements();
  const { selectedGuildId } = useGuild();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [dirty, setDirty] = useState(false);

  /* Fetch config */
  const { isLoading } = useQuery({
    queryKey: ["alerts-config", selectedGuildId],
    queryFn: async () => {
      const res = await apiFetch("/api/alerts/config");
      if (!res.ok) throw new Error("Failed to load");
      const data: AlertConfig[] = await res.json();
      setAlerts(data);
      const wh = data.find(a => a.webhook_url)?.webhook_url ?? "";
      setWebhookUrl(wh);
      return data;
    },
    enabled: !!selectedGuildId,
  });

  /* Fetch history */
  const { data: history = [] } = useQuery({
    queryKey: ["alerts-history", selectedGuildId],
    queryFn: async () => {
      const res = await apiFetch("/api/alerts/history?limit=20");
      if (!res.ok) return [];
      return res.json() as Promise<AlertHistoryEntry[]>;
    },
    enabled: !!selectedGuildId,
  });

  /* Save */
  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/alerts/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alerts, webhook_url: webhookUrl }),
      });
      if (!res.ok) throw new Error("Save failed");
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Alert configuration updated." });
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["alerts-config", selectedGuildId] });
    },
    onError: () => toast({ title: "Error", description: "Failed to save.", variant: "destructive" }),
  });

  /* Test alert */
  const testMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/alerts/test", { method: "POST" });
      if (!res.ok) throw new Error("Test failed");
    },
    onSuccess: () => {
      toast({ title: "Test Alert Sent", description: "Check your alert history." });
      qc.invalidateQueries({ queryKey: ["alerts-history", selectedGuildId] });
    },
  });

  const updateAlert = (idx: number, patch: Partial<AlertConfig>) => {
    setAlerts(prev => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
    setDirty(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PremiumGate feature="alerts" featureLabel="Server Alerts" hasAccess={hasFeature("alerts")} isLoading={entLoading}>
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Server Alerts</h1>
            <p className="text-sm text-muted-foreground">Detect nuke attempts, mass bans, and suspicious activity</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => testMut.mutate()} disabled={testMut.isPending}>
            <FlaskConical className="w-4 h-4 mr-1.5" />
            Test Alert
          </Button>
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !dirty}>
            {saveMut.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save
          </Button>
        </div>
      </div>

      {/* Webhook URL */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Discord Webhook URL</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="https://discord.com/api/webhooks/..."
            value={webhookUrl}
            onChange={e => { setWebhookUrl(e.target.value); setDirty(true); }}
          />
          <p className="text-xs text-muted-foreground mt-1.5">Alerts will be sent to this webhook channel</p>
        </CardContent>
      </Card>

      {/* Alert Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {alerts.map((alert, idx) => {
          const Icon = ALERT_ICONS[alert.alert_type] ?? Bell;
          return (
            <Card key={alert.alert_type} className={alert.enabled ? "border-orange-500/30" : ""}>
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="w-4.5 h-4.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{alert.label}</p>
                      <p className="text-xs text-muted-foreground">{alert.alert_type}</p>
                    </div>
                  </div>
                  <Switch
                    checked={alert.enabled}
                    onCheckedChange={v => updateAlert(idx, { enabled: v })}
                  />
                </div>
                {alert.enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Threshold (events)</label>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={alert.threshold}
                        onChange={e => updateAlert(idx, { threshold: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Window (minutes)</label>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={alert.window_minutes}
                        onChange={e => updateAlert(idx, { window_minutes: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alert History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Alert History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShieldCheck className="w-10 h-10 mb-3 opacity-40" />
              <p className="font-medium">No alerts triggered yet</p>
              <p className="text-sm">Your server is safe!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(entry => {
                const Icon = ALERT_ICONS[entry.alert_type] ?? Bell;
                return (
                  <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${SEVERITY_COLORS[entry.severity] ?? "bg-gray-500"}`} />
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {entry.alert_type === "test" ? "Test Alert" : entry.alert_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </p>
                      {entry.actor_name && (
                        <p className="text-xs text-muted-foreground">by {entry.actor_name}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {entry.severity}
                    </Badge>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDate(entry.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </PremiumGate>
  );
}
