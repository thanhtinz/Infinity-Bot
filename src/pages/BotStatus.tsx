import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Square,
  RefreshCw,
  UserPlus,
  Copy,
  Wifi,
  Globe,
  Users,
  Timer,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import type { SystemConfig } from "../types";

interface BotInfo {
  online: boolean;
  username: string;
  discriminator: string;
  avatar_url: string | null;
  bot_id: string;
  latency_ms: number;
  guild_count: number;
  member_count: number;
  uptime_seconds: number;
}

function formatUptime(seconds: number): string {
  if (seconds <= 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ngày`);
  if (hours > 0) parts.push(`${hours} giờ`);
  if (minutes > 0) parts.push(`${minutes} phút`);
  if (parts.length === 0) parts.push("Vài giây");
  return parts.join(" ");
}

function latencyColor(ms: number): string {
  if (ms < 80) return "text-green-500";
  if (ms <= 200) return "text-yellow-500";
  return "text-red-500";
}

export function BotStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: botInfo, isLoading: infoLoading } = useQuery<BotInfo>({
    queryKey: ["bot_info"],
    queryFn: () =>
      fetch("/api/bot/info", { credentials: "include" }).then((r) => r.json()),
    refetchInterval: (query) =>
      query.state.data?.online ? 10_000 : 30_000,
  });

  const { data: config } = useQuery<SystemConfig>({
    queryKey: ["config"],
    queryFn: () =>
      fetch("/api/config", { credentials: "include" }).then((r) => r.json()),
    staleTime: 30_000,
  });

  const isRunning = botInfo?.online ?? false;

  const handleMutationResponse = async (res: Response, label: string) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Lỗi không xác định" }));
      toast({
        variant: "destructive",
        title: `${label} thất bại`,
        description: err.detail || String(err),
      });
    } else {
      toast({ title: label, description: "Thành công." });
      queryClient.invalidateQueries({ queryKey: ["bot_info"] });
      queryClient.invalidateQueries({ queryKey: ["config"] });
    }
  };

  const startMutation = useMutation({
    mutationFn: () =>
      fetch("/api/bot/start", { method: "POST", credentials: "include" }),
    onSuccess: (res) => handleMutationResponse(res, "Start Bot"),
    onError: () => toast({ variant: "destructive", title: "Lỗi kết nối" }),
  });

  const stopMutation = useMutation({
    mutationFn: () =>
      fetch("/api/bot/stop", { method: "POST", credentials: "include" }),
    onSuccess: (res) => handleMutationResponse(res, "Tắt Bot"),
    onError: () => toast({ variant: "destructive", title: "Lỗi kết nối" }),
  });

  const restartMutation = useMutation({
    mutationFn: () =>
      fetch("/api/bot/restart", { method: "POST", credentials: "include" }),
    onSuccess: (res) => handleMutationResponse(res, "Khởi động lại"),
    onError: () => toast({ variant: "destructive", title: "Lỗi kết nối" }),
  });

  const profileMutation = useMutation({
    mutationFn: (body: { username?: string; avatar_base64?: string }) =>
      fetch("/api/bot/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (res) => handleMutationResponse(res, "Cập nhật hồ sơ"),
    onError: () => toast({ variant: "destructive", title: "Lỗi kết nối" }),
  });

  const presenceMutation = useMutation({
    mutationFn: (body: {
      status: "online" | "idle" | "dnd" | "invisible";
      activity_type: "playing" | "watching" | "listening" | "competing" | "streaming";
      activity_name: string;
      stream_url?: string;
    }) =>
      fetch("/api/bot/presence", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (res) => handleMutationResponse(res, "Cập nhật trạng thái"),
    onError: () => toast({ variant: "destructive", title: "Lỗi kết nối" }),
  });

  const invisibleMutation = useMutation({
    mutationFn: (invisible: boolean) =>
      fetch("/api/config", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_invisible: invisible }),
      }),
    onSuccess: async (res, invisible) => {
      if (res.ok) {
        toast({ title: invisible ? "Đã bật chế độ ẩn" : "Đã tắt chế độ ẩn" });
        queryClient.invalidateQueries({ queryKey: ["config"] });
        // Apply immediately if bot is running
        if (isRunning) {
          await fetch("/api/bot/presence", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: invisible ? "invisible" : "online",
              activity_type: "playing",
              activity_name: "",
            }),
          });
        }
      }
    },
    onError: () => toast({ variant: "destructive", title: "Lỗi kết nối" }),
  });

  // Profile form state
  const [profileUsername, setProfileUsername] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      setAvatarBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = () => {
    const body: { username?: string; avatar_base64?: string } = {};
    if (profileUsername.trim()) body.username = profileUsername.trim();
    if (avatarBase64) body.avatar_base64 = avatarBase64;
    if (Object.keys(body).length === 0) {
      toast({ description: "Không có thay đổi nào." });
      return;
    }
    profileMutation.mutate(body);
  };

  // Presence form state
  const [presenceStatus, setPresenceStatus] = useState<
    "online" | "idle" | "dnd" | "invisible"
  >("online");
  const [activityType, setActivityType] = useState<
    "playing" | "watching" | "listening" | "competing" | "streaming"
  >("playing");
  const [activityName, setActivityName] = useState("");
  const [streamUrl, setStreamUrl] = useState("");

  const handlePresenceSubmit = () => {
    const body: Parameters<typeof presenceMutation.mutate>[0] = {
      status: presenceStatus,
      activity_type: activityType,
      activity_name: activityName,
    };
    if (activityType === "streaming" && streamUrl.trim()) {
      body.stream_url = streamUrl.trim();
    }
    presenceMutation.mutate(body);
  };

  const inviteUrl = config?.discord_client_id
    ? `https://discord.com/oauth2/authorize?client_id=${config.discord_client_id}&permissions=8&scope=bot%20applications.commands`
    : null;

  const copyBotId = () => {
    if (botInfo?.bot_id) {
      navigator.clipboard.writeText(botInfo.bot_id);
      toast({ title: "Đã sao chép Bot ID" });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl w-full">
      <h1 className="text-xl font-semibold">Trạng thái Bot</h1>

      {/* ── Row 1: Bot Identity Card ── */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            {/* Top: Avatar + Info */}
            <div className="flex items-center gap-4">
              {infoLoading ? (
                <Skeleton className="h-14 w-14 rounded-full shrink-0" />
              ) : (
                <Avatar className="h-14 w-14 shrink-0">
                  <AvatarImage src={botInfo?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xl">
                    {botInfo?.username?.charAt(0)?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="space-y-1 min-w-0">
                {infoLoading ? (
                  <>
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-28" />
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold truncate">
                        {botInfo?.username ?? "Bot"}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        #{botInfo?.discriminator ?? "0"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[160px]">
                        {botInfo?.bot_id ?? "—"}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={copyBotId}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isRunning ? "default" : "secondary"}
                        className={cn("text-xs", isRunning ? "bg-green-600 text-white" : "bg-muted text-muted-foreground")}
                      >
                        <span className={cn("inline-block h-1.5 w-1.5 rounded-full mr-1", isRunning ? "bg-white" : "bg-destructive")} />
                        {isRunning ? "Online" : "Offline"}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bottom: Power buttons — always wraps */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => startMutation.mutate()}
                disabled={isRunning || startMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Play className="mr-1 h-3.5 w-3.5" /> Bật Bot
              </Button>
              <Button
                size="sm"
                onClick={() => stopMutation.mutate()}
                disabled={!isRunning || stopMutation.isPending}
                variant="destructive"
              >
                <Square className="mr-1 h-3.5 w-3.5" /> Tắt Bot
              </Button>
              <Button
                size="sm"
                onClick={() => restartMutation.mutate()}
                disabled={!isRunning || restartMutation.isPending}
                variant="outline"
              >
                <RefreshCw
                  className={`mr-1 h-3.5 w-3.5 ${
                    restartMutation.isPending ? "animate-spin" : ""
                  }`}
                />{" "}
                Khởi động lại
              </Button>
              {inviteUrl && (
                <Button size="sm" variant="secondary" asChild>
                  <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
                    <UserPlus className="mr-1 h-3.5 w-3.5" /> Mời Bot
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Row 2: 4 Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Latency */}
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <Wifi className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Độ trễ</p>
              {infoLoading ? (
                <Skeleton className="h-6 w-16 mt-1" />
              ) : (
                <p
                  className={`text-xl font-bold ${
                    botInfo?.online ? latencyColor(botInfo.latency_ms) : ""
                  }`}
                >
                  {botInfo?.online ? `${botInfo.latency_ms}ms` : "—"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Servers */}
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <Globe className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Servers</p>
              {infoLoading ? (
                <Skeleton className="h-6 w-12 mt-1" />
              ) : (
                <p className="text-xl font-bold">
                  {botInfo?.guild_count ?? 0}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    servers
                  </span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Members</p>
              {infoLoading ? (
                <Skeleton className="h-6 w-16 mt-1" />
              ) : (
                <p className="text-xl font-bold">
                  {botInfo?.member_count?.toLocaleString("vi-VN") ?? 0}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    total
                  </span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <Timer className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Uptime</p>
              {infoLoading ? (
                <Skeleton className="h-6 w-28 mt-1" />
              ) : (
                <p className="text-xl font-bold">
                  {botInfo?.online
                    ? formatUptime(botInfo.uptime_seconds)
                    : "—"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Edit Profile + Presence ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Edit Profile */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Chỉnh sửa Bot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bot-username">Username</Label>
              <Input
                id="bot-username"
                placeholder={botInfo?.username ?? "Tên bot"}
                value={profileUsername}
                onChange={(e) => setProfileUsername(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Avatar</Label>
              <div className="flex items-center gap-3">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Preview"
                    className="h-16 w-16 rounded-full object-cover border"
                  />
                ) : botInfo?.avatar_url ? (
                  <img
                    src={botInfo.avatar_url}
                    alt="Current avatar"
                    className="h-16 w-16 rounded-full object-cover border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold border">
                    {botInfo?.username?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                )}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="text-sm"
                    onChange={handleAvatarChange}
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Discord giới hạn đổi tên 2 lần/giờ
            </p>

            <Button
              size="sm"
              onClick={handleProfileSubmit}
              disabled={profileMutation.isPending}
            >
              Lưu thay đổi
            </Button>
          </CardContent>
        </Card>

        {/* Right: Presence */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Trạng thái &amp; Hoạt động
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={presenceStatus}
                onValueChange={(v) =>
                  setPresenceStatus(v as typeof presenceStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                      Online
                    </span>
                  </SelectItem>
                  <SelectItem value="idle">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" />
                      Idle
                    </span>
                  </SelectItem>
                  <SelectItem value="dnd">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                      Không làm phiền
                    </span>
                  </SelectItem>
                  <SelectItem value="invisible">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-gray-400 inline-block" />
                      Ẩn
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Loại hoạt động</Label>
              <Select
                value={activityType}
                onValueChange={(v) =>
                  setActivityType(v as typeof activityType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="playing">Đang chơi</SelectItem>
                  <SelectItem value="watching">Đang xem</SelectItem>
                  <SelectItem value="listening">Đang nghe</SelectItem>
                  <SelectItem value="competing">Đang thi đấu</SelectItem>
                  <SelectItem value="streaming">Đang stream</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity-name">Tên hoạt động</Label>
              <Input
                id="activity-name"
                placeholder="Minecraft"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
              />
            </div>

            {activityType === "streaming" && (
              <div className="space-y-2">
                <Label htmlFor="stream-url">Stream URL</Label>
                <Input
                  id="stream-url"
                  placeholder="https://twitch.tv/..."
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                />
              </div>
            )}

            <Button
              size="sm"
              onClick={handlePresenceSubmit}
              disabled={presenceMutation.isPending}
            >
              Cập nhật
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Invisible mode ── */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground shrink-0">
              <EyeOff className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Ẩn tình trạng bot</p>
              <p className="text-xs text-muted-foreground">
                Bot hiển thị offline với tất cả mọi người trên Discord. Chỉ bạn thấy trạng thái thực qua dashboard này.
              </p>
            </div>
          </div>
          <Switch
            checked={config?.bot_invisible ?? false}
            onCheckedChange={(v) => invisibleMutation.mutate(v)}
            disabled={invisibleMutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
