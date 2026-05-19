import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import { useDiscordChannels } from "@/hooks/useDiscordData";
import type { DiscordChannel } from "@/hooks/useDiscordData";
import { useGuild } from "@/contexts/GuildContext";
import {
  Rss, Plus, Trash2, Loader2, Play, Tv, Globe, Hash,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/infinity";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SocialFeed {
  id: number;
  guild_id: string;
  platform: "youtube" | "twitch" | "rss";
  url: string;
  channel_id: string;
  message_template?: string;
  is_enabled: boolean;
  created_at?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  youtube: { label: "YouTube", icon: Play, color: "bg-red-500/15 text-red-600 dark:text-red-400" },
  twitch: { label: "Twitch", icon: Tv, color: "bg-secondary/15 text-secondary dark:text-secondary/80" },
  rss: { label: "RSS", icon: Globe, color: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function SocialFeedsPage() {
  const { toast } = useToast();
  const { selectedGuildId } = useGuild();
  const qc = useQueryClient();
  const { data: allChannels = [] } = useDiscordChannels();
  const textChannels = allChannels.filter((c: DiscordChannel) => c.type === 0 || c.type === 5);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formPlatform, setFormPlatform] = useState<"youtube" | "twitch" | "rss">("youtube");
  const [formUrl, setFormUrl] = useState("");
  const [formChannelId, setFormChannelId] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: feeds = [], isLoading } = useQuery<SocialFeed[]>({
    queryKey: ["social-feeds", selectedGuildId],
    queryFn: () => apiFetch("/api/social-feeds").then((r) => r.json()),
    enabled: !!selectedGuildId,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: Partial<SocialFeed>) =>
      apiFetch("/api/social-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-feeds", selectedGuildId] });
      closeDialog();
      toast({ title: "Feed added." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to add feed." }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_enabled }: { id: number; is_enabled: boolean }) =>
      apiFetch(`/api/social-feeds/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onMutate: async ({ id, is_enabled }) => {
      await qc.cancelQueries({ queryKey: ["social-feeds", selectedGuildId] });
      const prev = qc.getQueryData<SocialFeed[]>(["social-feeds", selectedGuildId]);
      qc.setQueryData<SocialFeed[]>(["social-feeds", selectedGuildId], (old) =>
        old?.map((f) => (f.id === id ? { ...f, is_enabled } : f))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["social-feeds", selectedGuildId], ctx.prev);
      toast({ variant: "destructive", title: "Failed to toggle feed." });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["social-feeds", selectedGuildId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/social-feeds/${id}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-feeds", selectedGuildId] });
      setConfirmDeleteId(null);
      toast({ title: "Feed deleted." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to delete feed." }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  function closeDialog() {
    setDialogOpen(false);
    setFormPlatform("youtube");
    setFormUrl("");
    setFormChannelId("");
    setFormMessage("");
  }

  const channelName = (id: string) => {
    const ch = textChannels.find((c) => c.id === id);
    return ch ? `#${ch.name}` : id;
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
      <PageHeader title="Social Feeds" description="Automatically post content from YouTube, Twitch, or RSS feeds to your channels." icon={Rss}>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Add Feed
        </Button>
      </PageHeader>

      {/* Feeds List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured Feeds</CardTitle>
          <CardDescription>Manage your social media feed integrations.</CardDescription>
        </CardHeader>
        <CardContent>
          {feeds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No feeds configured. Click "Add Feed" to set one up.
            </div>
          ) : (
            <div className="space-y-3">
              {feeds.map((feed) => {
                const pCfg = PLATFORM_CONFIG[feed.platform] ?? PLATFORM_CONFIG.rss;
                const PlatformIcon = pCfg.icon;
                return (
                  <div
                    key={feed.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                      feed.is_enabled ? "bg-card" : "bg-muted/30 opacity-60"
                    )}
                  >
                    <Badge variant="outline" className={cn("text-xs shrink-0", pCfg.color)}>
                      <PlatformIcon className="h-3 w-3 mr-1" />
                      {pCfg.label}
                    </Badge>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium truncate">{feed.url}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <Hash className="h-3 w-3" />
                        <span>{channelName(feed.channel_id)}</span>
                      </div>
                      {feed.message_template && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{feed.message_template}</p>
                      )}
                    </div>

                    <Switch
                      checked={feed.is_enabled}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: feed.id, is_enabled: checked })}
                    />

                    {confirmDeleteId === feed.id ? (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteMutation.mutate(feed.id)}>Confirm</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDeleteId(feed.id)}>
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

      {/* Add Feed Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Social Feed</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={formPlatform} onValueChange={(v) => setFormPlatform(v as "youtube" | "twitch" | "rss")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="twitch">Twitch</SelectItem>
                  <SelectItem value="rss">RSS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Feed URL</Label>
              <Input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://..." />
            </div>

            <div className="space-y-2">
              <Label>Target Channel</Label>
              <Select value={formChannelId} onValueChange={setFormChannelId}>
                <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                <SelectContent>
                  {textChannels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Message Template (optional)</Label>
              <Textarea
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                placeholder="Custom message template. Use {title}, {url}, {author} as placeholders."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
            <Button
              disabled={!formUrl || !formChannelId || createMutation.isPending}
              onClick={() => createMutation.mutate({
                platform: formPlatform,
                url: formUrl,
                channel_id: formChannelId,
                message_template: formMessage || undefined,
              })}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add Feed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
