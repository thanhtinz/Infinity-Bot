import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
  if (!res.ok) throw new Error("Tải cấu hình thất bại");
  return res.json();
}

async function saveStarboardConfig(data: StarboardConfigData): Promise<{ ok: boolean }> {
  const res = await apiFetch("/api/starboard/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Lưu thất bại");
  return res.json();
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StarboardConfig() {
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
      toast({ title: "Đã lưu cấu hình Starboard" });
    },
    onError: () => {
      toast({ title: "Lưu thất bại", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Star className="h-6 w-6 text-yellow-500" />
          Starboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Ghim tin nhắn được react nhiều vào kênh riêng
        </p>
      </div>

      {/* Config Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cấu hình chung</CardTitle>
          <CardDescription>
            Thiết lập kênh và điều kiện để tin nhắn xuất hiện trên Starboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Enable Starboard</p>
              <p className="text-sm text-muted-foreground">
                Kích hoạt tính năng ghim tin nhắn nổi bật.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Channel */}
          <div className="space-y-2">
            <Label>Kênh Starboard</Label>
            <p className="text-xs text-muted-foreground">
              Kênh nơi tin nhắn nổi bật sẽ được ghim.
            </p>
            <ChannelSelect
              value={channelId}
              onChange={setChannelId}
              placeholder="Select channel..."
              filter="text"
            />
          </div>

          {/* Emoji */}
          <div className="space-y-2">
            <Label>Emoji</Label>
            <p className="text-xs text-muted-foreground">
              Emoji dùng để vote cho tin nhắn.
            </p>
            <Input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="⭐"
            />
          </div>

          {/* Threshold */}
          <div className="space-y-2">
            <Label>Số reaction tối thiểu</Label>
            <p className="text-xs text-muted-foreground">
              Số lượng reaction cần thiết để tin nhắn lên Starboard.
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
              <p className="font-medium">Cho phép tự react</p>
              <p className="text-sm text-muted-foreground">
                Đếm reaction từ chính người gửi tin nhắn.
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
        {saveMutation.isPending ? "Saving..." : "Lưu cấu hình"}
      </Button>
    </div>
  );
}
