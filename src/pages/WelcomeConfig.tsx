import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChannelSelect } from "@/components/ChannelSelect";
import { HandMetal, LogOut, MessageSquare, UserCog } from "lucide-react";
interface WelcomeConfigData {
  welcome_enabled: boolean;
  welcome_channel_id: string;
  welcome_message: string;
  welcome_embed_enabled: boolean;
  welcome_dm_enabled: boolean;
  welcome_dm_message: string;
  goodbye_enabled: boolean;
  goodbye_channel_id: string;
  goodbye_message: string;
  goodbye_embed_enabled: boolean;
  auto_nickname_template: string;
}

async function fetchConfig(): Promise<WelcomeConfigData> {
  const res = await fetch("/api/welcome/config", { credentials: "include" });
  if (!res.ok) throw new Error("Tải cấu hình thất bại");
  return res.json();
}

async function saveConfig(data: WelcomeConfigData): Promise<{ ok: boolean }> {
  const res = await fetch("/api/welcome/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Lưu thất bại");
  return res.json();
}

export function WelcomeConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["welcome_config"],
    queryFn: fetchConfig,
    staleTime: 60_000,
  });

  // Form state
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [welcomeChannelId, setWelcomeChannelId] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [welcomeEmbedEnabled, setWelcomeEmbedEnabled] = useState(false);
  const [welcomeDmEnabled, setWelcomeDmEnabled] = useState(false);
  const [welcomeDmMessage, setWelcomeDmMessage] = useState("");
  const [goodbyeEnabled, setGoodbyeEnabled] = useState(false);
  const [goodbyeChannelId, setGoodbyeChannelId] = useState("");
  const [goodbyeMessage, setGoodbyeMessage] = useState("");
  const [goodbyeEmbedEnabled, setGoodbyeEmbedEnabled] = useState(false);
  const [autoNicknameTemplate, setAutoNicknameTemplate] = useState("");

  // Reset form when data loads
  useEffect(() => {
    if (data) {
      setWelcomeEnabled(data.welcome_enabled ?? false);
      setWelcomeChannelId(data.welcome_channel_id || "");
      setWelcomeMessage(data.welcome_message || "");
      setWelcomeEmbedEnabled(data.welcome_embed_enabled ?? false);
      setWelcomeDmEnabled(data.welcome_dm_enabled ?? false);
      setWelcomeDmMessage(data.welcome_dm_message || "");
      setGoodbyeEnabled(data.goodbye_enabled ?? false);
      setGoodbyeChannelId(data.goodbye_channel_id || "");
      setGoodbyeMessage(data.goodbye_message || "");
      setGoodbyeEmbedEnabled(data.goodbye_embed_enabled ?? false);
      setAutoNicknameTemplate(data.auto_nickname_template || "");
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      saveConfig({
        welcome_enabled: welcomeEnabled,
        welcome_channel_id: welcomeChannelId,
        welcome_message: welcomeMessage,
        welcome_embed_enabled: welcomeEmbedEnabled,
        welcome_dm_enabled: welcomeDmEnabled,
        welcome_dm_message: welcomeDmMessage,
        goodbye_enabled: goodbyeEnabled,
        goodbye_channel_id: goodbyeChannelId,
        goodbye_message: goodbyeMessage,
        goodbye_embed_enabled: goodbyeEmbedEnabled,
        auto_nickname_template: autoNicknameTemplate,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["welcome_config"] });
      toast({ title: "Đã lưu", description: "Cấu hình Welcome & Goodbye đã được lưu." });
    },
    onError: () =>
      toast({ variant: "destructive", title: "Lỗi", description: "Lưu thất bại." }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <HandMetal className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Chào mừng & Tạm biệt</h1>
          <p className="text-sm text-muted-foreground">
            Cấu hình tin nhắn chào mừng thành viên mới và tạm biệt khi rời server.
          </p>
        </div>
      </div>

      {/* Welcome Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" /> Chào mừng
          </CardTitle>
          <CardDescription>
            Gửi tin nhắn chào mừng khi có thành viên mới tham gia server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Bật chào mừng</p>
              <p className="text-sm text-muted-foreground">Kích hoạt tin nhắn chào mừng.</p>
            </div>
            <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
          </div>

          {/* Channel */}
          <div className="space-y-2">
            <Label>Kênh chào mừng</Label>
            <ChannelSelect
              value={welcomeChannelId}
              onChange={setWelcomeChannelId}
              filter="text"
              placeholder="Chọn kênh..."
            />
          </div>

          {/* Embed toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Chế độ Embed</p>
              <p className="text-sm text-muted-foreground">Hiển thị tin nhắn dưới dạng embed.</p>
            </div>
            <Switch checked={welcomeEmbedEnabled} onCheckedChange={setWelcomeEmbedEnabled} />
          </div>

          {/* Plain text message (shown when embed disabled) */}
          {!welcomeEmbedEnabled && (
            <div className="space-y-2">
              <Label>Tin nhắn chào mừng</Label>
              <Textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Chào mừng {username} đã tham gia {server}! 🎉"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Có dùng: {"{username}"}, {"{server}"}, {"{mention}"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Welcome DM Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" /> Chào mừng DM
          </CardTitle>
          <CardDescription>
            Gửi tin nhắn chào mừng trực tiếp (DM) cho thành viên mới.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Bật chào mừng DM</p>
              <p className="text-sm text-muted-foreground">Gửi tin nhắn riêng cho thành viên mới.</p>
            </div>
            <Switch checked={welcomeDmEnabled} onCheckedChange={setWelcomeDmEnabled} />
          </div>

          {/* DM Message */}
          <div className="space-y-2">
            <Label>Tin nhắn DM</Label>
            <Textarea
              value={welcomeDmMessage}
              onChange={(e) => setWelcomeDmMessage(e.target.value)}
              placeholder="Chào {username}, cảm ơn bạn đã tham gia {server}!"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Có dùng: {"{username}"}, {"{server}"}, {"{mention}"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Goodbye Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LogOut className="w-4 h-4" /> Tạm biệt
          </CardTitle>
          <CardDescription>
            Gửi tin nhắn tạm biệt khi thành viên rời server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Bật tạm biệt</p>
              <p className="text-sm text-muted-foreground">Kích hoạt tin nhắn tạm biệt.</p>
            </div>
            <Switch checked={goodbyeEnabled} onCheckedChange={setGoodbyeEnabled} />
          </div>

          {/* Channel */}
          <div className="space-y-2">
            <Label>Kênh tạm biệt</Label>
            <ChannelSelect
              value={goodbyeChannelId}
              onChange={setGoodbyeChannelId}
              filter="text"
              placeholder="Chọn kênh..."
            />
          </div>

          {/* Embed toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Chế độ Embed</p>
              <p className="text-sm text-muted-foreground">Hiển thị tin nhắn dưới dạng embed.</p>
            </div>
            <Switch checked={goodbyeEmbedEnabled} onCheckedChange={setGoodbyeEmbedEnabled} />
          </div>

          {/* Plain text message (shown when embed disabled) */}
          {!goodbyeEmbedEnabled && (
            <div className="space-y-2">
              <Label>Tin nhắn tạm biệt</Label>
              <Textarea
                value={goodbyeMessage}
                onChange={(e) => setGoodbyeMessage(e.target.value)}
                placeholder="{username} đã rời khỏi {server}. 👋"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Có dùng: {"{username}"}, {"{server}"}, {"{member_count}"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto Nickname Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCog className="w-4 h-4" /> Tự động đặt biệt danh
          </CardTitle>
          <CardDescription>
            Tự động đổi biệt danh cho thành viên khi tham gia server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Mẫu biệt danh</Label>
          <Input
            value={autoNicknameTemplate}
            onChange={(e) => setAutoNicknameTemplate(e.target.value)}
            placeholder="Để trống để tắt"
          />
          <p className="text-xs text-muted-foreground">
            Các biến có sẵn: {"{username}"}, {"{server}"}, {"{discriminator}"}
          </p>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? "Đang lưu..." : "Lưu cấu hình"}
      </Button>
    </div>
  );
}
