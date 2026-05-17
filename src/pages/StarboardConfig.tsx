import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useT } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChannelSelect } from "@/components/ChannelSelect";
import { Star } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StarboardConfigData {
  channel_id: string;
  emoji: string;
  threshold: number;
  self_star: boolean;
  ignored_channels: string[];
  enabled: boolean;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchStarboardConfig(): Promise<StarboardConfigData> {
  const res = await apiFetch("/api/starboard/config");
  if (!res.ok) throw new Error("Failed to load config");
  return res.json();
}

async function saveStarboardConfig(data: StarboardConfigData): Promise<{ ok: boolean }> {
  const res = await apiFetch("/api/starboard/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Save failed");
  return res.json();
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StarboardConfig() {
  const { t } = useT();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["starboard-config"],
    queryFn: fetchStarboardConfig,
  });

  const [enabled, setEnabled] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [emoji, setEmoji] = useState("⭐");
  const [threshold, setThreshold] = useState(3);
  const [selfStar, setSelfStar] = useState(true);

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled);
      setChannelId(data.channel_id);
      setEmoji(data.emoji);
      setThreshold(data.threshold);
      setSelfStar(data.self_star);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveStarboardConfig({
        channel_id: channelId,
        emoji,
        threshold,
        self_star: selfStar,
        ignored_channels: data?.ignored_channels ?? [],
        enabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["starboard-config"] });
      toast({ title: t("toast_starboardSaved") });
    },
    onError: () => {
      toast({ title: t("toast_saveFailed"), variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Star className="h-6 w-6 text-yellow-500" />
          {t("starboard_title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("starboard_title")}
        </p>
      </div>

      {/* Config Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("config")}</CardTitle>
          <CardDescription>
            {t("starboard_title")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{t("enable")} Starboard</p>
              <p className="text-sm text-muted-foreground">
                {t("starboard_title")}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Channel */}
          <div className="space-y-2">
            <Label>{t("starboard_channel")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("starboard_channel")}
            </p>
            <ChannelSelect
              value={channelId}
              onChange={setChannelId}
              placeholder={t("selectChannel")}
              filter="text"
            />
          </div>

          {/* Emoji */}
          <div className="space-y-2">
            <Label>{t("starboard_emoji")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("starboard_emoji")}
            </p>
            <Input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="⭐"
            />
          </div>

          {/* Threshold */}
          <div className="space-y-2">
            <Label>{t("starboard_minStars")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("starboard_minStars")}
            </p>
            <Input
              type="number"
              min={1}
              max={50}
              value={threshold}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setThreshold(Math.min(50, Math.max(1, v)));
              }}
            />
          </div>

          {/* Self-star toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{t("starboard_selfStarAllowed")}</p>
              <p className="text-sm text-muted-foreground">
                {t("starboard_selfStarAllowed")}
              </p>
            </div>
            <Switch checked={selfStar} onCheckedChange={setSelfStar} />
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full"
      >
        {saveMutation.isPending ? t("saving") : t("save")}
      </Button>
    </div>
  );
}
