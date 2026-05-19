import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import { useDiscordChannels } from "@/hooks/useDiscordData";
import type { DiscordChannel } from "@/hooks/useDiscordData";
import { useGuild } from "@/contexts/GuildContext";
import {
  Activity, Plus, Trash2, Loader2, Hash, Users, Zap, Crown, Shield, BarChart3, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/yuri";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatsChannel {
  id: number;
  guild_id: string;
  channel_id: string;
  stat_type: string;
  format_template: string;
  is_enabled: boolean;
  created_at?: string;
}

interface StatTypeOption {
  key: string;
  label: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STAT_TYPE_COLORS: Record<string, string> = {
  members: "bg-primary/15 text-primary dark:text-primary/80",
  online: "bg-green-500/15 text-green-600 dark:text-green-400",
  boosts: "bg-secondary/15 text-secondary dark:text-secondary/80",
  roles: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  channels: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  avg_rating: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
};

const STAT_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  members: Users,
  online: Zap,
  boosts: Crown,
  roles: Shield,
  channels: Hash,
  avg_rating: Star,
};

const STAT_TYPE_LABELS: Record<string, string> = {
  members: "Members",
  online: "Online",
  boosts: "Boosts",
  roles: "Roles",
  channels: "Channels",
  avg_rating: "Feedback Rating",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function StatsChannelsPage() {
  const { toast } = useToast();
  const { selectedGuildId } = useGuild();
  const qc = useQueryClient();
  const { data: allChannels = [] } = useDiscordChannels();
  const voiceChannels = allChannels.filter((c: DiscordChannel) => c.type === 2);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formChannelId, setFormChannelId] = useState("");
  const [formStatType, setFormStatType] = useState("members");
  const [formFormat, setFormFormat] = useState("{value}");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: statsChannels = [], isLoading } = useQuery<StatsChannel[]>({
    queryKey: ["stats-channels", selectedGuildId],
    queryFn: () => apiFetch("/api/stats-channels").then((r) => r.json()),
    enabled: !!selectedGuildId,
  });

  const { data: statTypes = [] } = useQuery<StatTypeOption[]>({
    queryKey: ["stats-channels-types", selectedGuildId],
    queryFn: async () => {
      const r = await apiFetch("/api/stats-channels/types");
      const data = await r.json();
      // API returns string[] — normalise to { key, label }[]
      if (Array.isArray(data) && typeof data[0] === "string") {
        return data.map((k: string) => ({ key: k, label: STAT_TYPE_LABELS[k] ?? k.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) }));
      }
      return data;
    },
    enabled: !!selectedGuildId,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: Partial<StatsChannel>) =>
      apiFetch("/api/stats-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stats-channels", selectedGuildId] });
      closeDialog();
      toast({ title: "Stats channel created." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to create stats channel." }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/stats-channels/${id}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stats-channels", selectedGuildId] });
      setConfirmDeleteId(null);
      toast({ title: "Stats channel deleted." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to delete stats channel." }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  function closeDialog() {
    setDialogOpen(false);
    setFormChannelId("");
    setFormStatType("members");
    setFormFormat("{value}");
  }

  const channelName = (id: string) => {
    const ch = allChannels.find((c) => c.id === id);
    return ch ? ch.name : id;
  };

  const statTypeLabel = (key: string) => {
    const found = statTypes.find((t) => t.key === key);
    return found ? found.label : STAT_TYPE_LABELS[key] ?? key;
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <PageContainer size="md">
      <PageHeader title="Stats Channels" description="Display live server statistics in voice channel names." icon={Activity}>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Add Channel
        </Button>
      </PageHeader>

      {/* Stats Channels List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured Stats Channels</CardTitle>
          <CardDescription>Voice channels that display live server statistics.</CardDescription>
        </CardHeader>
        <CardContent>
          {statsChannels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No stats channels configured. Click "Add Channel" to create one.
            </div>
          ) : (
            <div className="space-y-3">
              {statsChannels.map((sc) => {
                const Icon = STAT_TYPE_ICONS[sc.stat_type] ?? BarChart3;
                return (
                  <div key={sc.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <Badge variant="outline" className={cn("text-xs shrink-0", STAT_TYPE_COLORS[sc.stat_type] ?? "")}>
                      <Icon className="h-3 w-3 mr-1" />
                      {statTypeLabel(sc.stat_type)}
                    </Badge>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium truncate">{channelName(sc.channel_id)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Format: <code className="font-mono bg-muted px-1 rounded">{sc.format_template}</code>
                      </p>
                    </div>

                    {confirmDeleteId === sc.id ? (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteMutation.mutate(sc.id)}>Confirm</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDeleteId(sc.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Stats Channel Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stats Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Voice Channel</Label>
              <Select value={formChannelId} onValueChange={setFormChannelId}>
                <SelectTrigger><SelectValue placeholder="Select voice channel" /></SelectTrigger>
                <SelectContent>
                  {voiceChannels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Stat Type</Label>
              <Select value={formStatType} onValueChange={setFormStatType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(statTypes.length > 0 ? statTypes : [
                    { key: "members", label: "Members" },
                    { key: "online", label: "Online" },
                    { key: "boosts", label: "Boosts" },
                    { key: "roles", label: "Roles" },
                    { key: "channels", label: "Channels" },
                    { key: "avg_rating", label: "⭐ Feedback Rating" },
                  ]).map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Format Template</Label>
              <Input
                value={formFormat}
                onChange={(e) => setFormFormat(e.target.value)}
                placeholder="{value}"
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="font-mono bg-muted px-1 rounded">{"{value}"}</code> as placeholder for the stat value.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
            <Button
              disabled={!formChannelId || createMutation.isPending}
              onClick={() => createMutation.mutate({
                channel_id: formChannelId,
                stat_type: formStatType,
                format_template: formFormat || "{value}",
              })}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
