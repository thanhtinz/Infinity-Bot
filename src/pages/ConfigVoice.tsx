import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/useApi";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChannelSelect } from "@/components/ChannelSelect";
import { Mic, Server, Settings, Shield, Wrench } from "lucide-react";

const VOICE_BUTTON_OPTIONS = [
  { key: "name", label: "Name", desc: "Rename room", emoji: "✏️" },
  { key: "limit", label: "Limit", desc: "User limit", emoji: "👥" },
  { key: "privacy", label: "Privacy", desc: "Toggle privacy", emoji: "🔐" },
  { key: "trust", label: "Trust", desc: "Allow user", emoji: "✅" },
  { key: "untrust", label: "Untrust", desc: "Remove user trust", emoji: "➖" },
  { key: "invite", label: "Invite", desc: "Invite user", emoji: "📨" },
  { key: "kick", label: "Kick", desc: "Kick user", emoji: "👢" },
  { key: "region", label: "Region", desc: "Set automatic region", emoji: "🌍" },
  { key: "block", label: "Block", desc: "Block user", emoji: "🚫" },
  { key: "unblock", label: "Unblock", desc: "Unblock user", emoji: "🔓" },
  { key: "claim", label: "Claim", desc: "Claim ownerless room", emoji: "🙋" },
  { key: "transfer", label: "Transfer", desc: "Transfer ownership", emoji: "👑" },
  { key: "delete", label: "Delete", desc: "Delete room", emoji: "🗑️" },
];
const DEFAULT_VOICE_BUTTONS = VOICE_BUTTON_OPTIONS.map((button) => button.key);

const BITRATE_OPTIONS = [
  { value: 8000, label: "8 kbps" },
  { value: 32000, label: "32 kbps" },
  { value: 64000, label: "64 kbps" },
  { value: 96000, label: "96 kbps" },
  { value: 128000, label: "128 kbps" },
  { value: 256000, label: "256 kbps" },
  { value: 384000, label: "384 kbps" },
];

export function ConfigVoice() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: () => apiFetch("/api/config", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: tvConfig } = useQuery({
    queryKey: ["tempvoice_config"],
    queryFn: () => apiFetch("/api/tempvoice/config", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const [enabled, setEnabled] = useState(false);
  const [joinChannel, setJoinChannel] = useState("");
  const [category, setCategory] = useState("");
  const [guildId, setGuildId] = useState("");
  const [defaultUserLimit, setDefaultUserLimit] = useState(0);
  const [defaultBitrate, setDefaultBitrate] = useState(64000);
  const [namingFormat, setNamingFormat] = useState("{user}'s Channel");
  const [allowRename, setAllowRename] = useState(true);
  const [allowLimit, setAllowLimit] = useState(true);
  const [allowLock, setAllowLock] = useState(true);
  const [allowHide, setAllowHide] = useState(true);
  const [interfaceChannel, setInterfaceChannel] = useState("");
  const [voiceButtons, setVoiceButtons] = useState<string[]>(DEFAULT_VOICE_BUTTONS);
  const [autoDeleteSeconds, setAutoDeleteSeconds] = useState(0);

  useEffect(() => {
    if (config) setGuildId(config.guild_id || "");
  }, [config]);

  useEffect(() => {
    if (tvConfig) {
      setEnabled(tvConfig.enabled ?? false);
      setJoinChannel(tvConfig.join_channel_id || "");
      setCategory(tvConfig.category_id || "");
      setDefaultUserLimit(tvConfig.default_user_limit ?? 0);
      setDefaultBitrate(tvConfig.default_bitrate ?? 64000);
      setNamingFormat(tvConfig.naming_format || "{user}'s Channel");
      setAllowRename(tvConfig.allow_rename ?? true);
      setAllowLimit(tvConfig.allow_limit ?? true);
      setAllowLock(tvConfig.allow_lock ?? true);
      setAllowHide(tvConfig.allow_hide ?? true);
      setInterfaceChannel(tvConfig.interface_channel_id || "");
      setVoiceButtons(tvConfig.voice_buttons?.length ? tvConfig.voice_buttons : DEFAULT_VOICE_BUTTONS);
      setAutoDeleteSeconds(tvConfig.auto_delete_seconds ?? 0);
    }
  }, [tvConfig]);

  const activeGuildId = guildId || config?.guild_id;
  const toggleVoiceButton = (key: string, checked: boolean) => {
    setVoiceButtons((current) => checked ? [...new Set([...current, key])] : current.filter((item) => item !== key));
  };

  const { data: guilds = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["discord_guilds"],
    queryFn: () => apiFetch("/api/discord/guilds", { credentials: "include" }).then((r) =>
      r.ok ? r.json() : []
    ),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/tempvoice/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          enabled,
          join_channel_id: joinChannel,
          category_id: category,
          default_user_limit: defaultUserLimit,
          default_bitrate: defaultBitrate,
          naming_format: namingFormat,
          allow_rename: allowRename,
          allow_limit: allowLimit,
          allow_lock: allowLock,
          allow_hide: allowHide,
          interface_channel_id: interfaceChannel,
          voice_buttons: voiceButtons,
          auto_delete_seconds: autoDeleteSeconds,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tempvoice_config"] });
      toast({ title: "Saved", description: "TempVoice config saved." });
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Save failed." }),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Mic className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Temp Voice</h1>
          <p className="text-sm text-muted-foreground">
            When users join the "Join to Create" channel, the bot creates a private voice room.
          </p>
        </div>
        <Badge
          className={
            enabled
              ? "ml-auto bg-green-500/15 text-green-600 border-green-500/30"
              : "ml-auto bg-gray-500/15 text-gray-500 border-gray-500/30"
          }
        >
          {enabled ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Server select */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="w-4 h-4" /> Server Discord
          </CardTitle>
          <CardDescription>Select a server to load voice channels and categories.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={guildId || ""} onValueChange={setGuildId}>
            <SelectTrigger>
              <SelectValue placeholder="Select server..." />
            </SelectTrigger>
            <SelectContent>
              {guilds.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {guilds.length === 0 && (
            <Input
              className="mt-2"
              placeholder="Discord server ID (Bot Token required first)"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
            />
          )}
        </CardContent>
      </Card>

      {/* Basic config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4" /> Basic Config
          </CardTitle>
          <CardDescription>Set up the channel and category for temporary voice rooms.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Enable feature</p>
              <p className="text-sm text-muted-foreground">Automatically creates voice rooms.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Voice room category</Label>
            <ChannelSelect
              value={category}
              onChange={setCategory}
              filter="category"
              placeholder="Select category..."
              guildId={activeGuildId}
            />
            <p className="text-xs text-muted-foreground">Temporary voice rooms will be created in this category.</p>
          </div>

          {/* Join to Create channel */}
          <div className="space-y-2">
            <Label>Channel "Join to Create"</Label>
            <ChannelSelect
              value={joinChannel}
              onChange={setJoinChannel}
              filter="voice"
              placeholder="Select voice channel..."
              guildId={activeGuildId}
            />
            <p className="text-xs text-muted-foreground">User joins this channel → bot creates a private voice room.</p>
          </div>
        </CardContent>
      </Card>

      {/* Voice Channel Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="w-4 h-4" /> Voice Channel Defaults
          </CardTitle>
          <CardDescription>Set default values for newly created voice rooms.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* User Limit */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>User limit</Label>
              <span className="text-sm text-muted-foreground">
                {defaultUserLimit === 0 ? "Unlimited" : defaultUserLimit}
              </span>
            </div>
            <Slider
              value={[defaultUserLimit]}
              onValueChange={([v]) => setDefaultUserLimit(v)}
              min={0}
              max={99}
              step={1}
            />
            <p className="text-xs text-muted-foreground">0 = No user limit.</p>
          </div>

          <Separator />

          {/* Bitrate */}
          <div className="space-y-2">
            <Label>Bitrate</Label>
            <Select value={String(defaultBitrate)} onValueChange={(v) => setDefaultBitrate(Number(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Select bitrate..." />
              </SelectTrigger>
              <SelectContent>
                {BITRATE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Naming Format */}
          <div className="space-y-2">
            <Label>Channel name format</Label>
            <Input
              value={namingFormat}
              onChange={(e) => setNamingFormat(e.target.value)}
              placeholder="{user}'s Channel"
            />
            <p className="text-xs text-muted-foreground">
              Variables: <code className="rounded bg-muted px-1 py-0.5 text-xs">{`{user}`}</code>{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">{`{count}`}</code>{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">{`{game}`}</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* User Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" /> Permission user
          </CardTitle>
          <CardDescription>Allow users to manage their own voice rooms.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border divide-y">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Rename channel</p>
                <p className="text-sm text-muted-foreground">Allow rename voice room</p>
              </div>
              <Switch checked={allowRename} onCheckedChange={setAllowRename} />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">User limit</p>
                <p className="text-sm text-muted-foreground">Allow changing user limit</p>
              </div>
              <Switch checked={allowLimit} onCheckedChange={setAllowLimit} />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Lock channel</p>
                <p className="text-sm text-muted-foreground">Allow lock/unlock channel</p>
              </div>
              <Switch checked={allowLock} onCheckedChange={setAllowLock} />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Hidden channel</p>
                <p className="text-sm text-muted-foreground">Allow hide/show channel</p>
              </div>
              <Switch checked={allowHide} onCheckedChange={setAllowHide} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Advanced
          </CardTitle>
          <CardDescription>Advanced config for the TempVoice system.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Interface Channel */}
          <div className="space-y-2">
            <Label>Control panel channel</Label>
            <ChannelSelect
              value={interfaceChannel}
              onChange={setInterfaceChannel}
              filter="text"
              placeholder="Select text channel..."
              guildId={activeGuildId}
            />
            <p className="text-xs text-muted-foreground">Channel containing voice room control buttons.</p>
          </div>

          <Separator />

          {/* Panel Buttons */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Custom panel buttons</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Select buttons to show in the voice room control embed.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setVoiceButtons(DEFAULT_VOICE_BUTTONS)}>
                Select all
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VOICE_BUTTON_OPTIONS.map((button) => (
                <div key={button.key} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{button.emoji} {button.label}</p>
                    <p className="text-xs text-muted-foreground">{button.desc}</p>
                  </div>
                  <Switch
                    checked={voiceButtons.includes(button.key)}
                    onCheckedChange={(checked) => toggleVoiceButton(button.key, checked)}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Active {voiceButtons.length}/{VOICE_BUTTON_OPTIONS.length} buttons: {voiceButtons.join(", ")}
            </p>
          </div>

          <Separator />

          {/* Auto Delete */}
          <div className="space-y-2">
            <Label>Auto-delete (seconds)</Label>
            <Input
              type="number"
              min={0}
              value={autoDeleteSeconds}
              onChange={(e) => setAutoDeleteSeconds(Number(e.target.value))}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              {autoDeleteSeconds === 0
                ? "Delete immediately when empty"
                : `Delete after ${autoDeleteSeconds}s when the channel is empty.`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? "Saving..." : "Save Config"}
      </Button>
    </div>
  );
}
