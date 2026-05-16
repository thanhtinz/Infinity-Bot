/**
 * BotSettings.tsx — Unified Bot Settings
 * Accordion: General | Channels & Roles | TempVoice | Logging
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Settings, Terminal, Hash, Mic, ScrollText, Shield,
  ShieldCheck, Users, Server, Filter, X, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { ChannelSelect } from "@/components/ChannelSelect";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { useGuild } from "@/contexts/GuildContext";

// ─── shared query ────────────────────────────────────────────────────────────

function useConfig() {
  const { selectedGuildId } = useGuild();
  return useQuery({
    queryKey: ["config", selectedGuildId],
    queryFn: () =>
      fetch("/api/config", {
        credentials: "include",
        headers: selectedGuildId ? { "X-Guild-ID": selectedGuildId } : {},
      }).then((r) => r.json()),
    staleTime: 60_000,
    enabled: !!selectedGuildId,
  });
}

// ─── Section: General ────────────────────────────────────────────────────────

function GeneralSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();
  const { data: config } = useConfig();

  const [lang, setLang] = useState<"en" | "vi">("en");
  const [prefix, setPrefix] = useState("!");
  const [adminRoles, setAdminRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      if (config.language) setLang(config.language as "en" | "vi");
      if (config.command_prefix) setPrefix(config.command_prefix);
      if (config.admin_role_id) {
        setAdminRoles(config.admin_role_id.split(",").map((s: string) => s.trim()).filter(Boolean));
      }
    }
  }, [config]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/config", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(selectedGuildId ? { "X-Guild-ID": selectedGuildId } : {}),
        },
        body: JSON.stringify({
          language: lang,
          command_prefix: prefix,
          admin_role_id: adminRoles.join(","),
        }),
      });
      qc.invalidateQueries({ queryKey: ["config", selectedGuildId] });
      toast({ title: "Saved", description: "General settings updated." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Language */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold">Bot Language</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Language used for bot notifications, welcome messages, and auto-replies.
            Change anytime with <code className="bg-muted px-1 rounded">/language</code> in Discord.
          </p>
        </div>
        <div className="flex gap-3">
          {(["en", "vi"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                lang === l
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <span className="text-lg">{l === "en" ? "🇬🇧" : "🇻🇳"}</span>
              {l === "en" ? "English" : "Tiếng Việt"}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Prefix */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold">Command Prefix</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            For legacy prefix commands. Slash commands are unaffected.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.slice(0, 5))}
            placeholder="!"
            className="font-mono text-lg w-28"
          />
          <p className="text-xs text-muted-foreground">
            e.g. <code className="bg-muted px-1 rounded">{prefix || "!"}hug @user</code>
          </p>
        </div>
      </div>

      <Separator />

      {/* Admin Roles */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Admin Roles
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Members with any of these roles can access the dashboard and use admin commands.
          </p>
        </div>
        <MultiRoleSelect
          value={adminRoles}
          onChange={setAdminRoles}
          guildId={selectedGuildId || undefined}
          placeholder="Select roles..."
        />
      </div>

      <Button onClick={save} disabled={saving} size="sm" className="gap-2">
        <Save className="w-3.5 h-3.5" />
        {saving ? "Saving..." : "Save General"}
      </Button>
    </div>
  );
}

// ─── Section: Channels & Roles ───────────────────────────────────────────────

const channelSchema = z.object({
  don_hang_channel_id: z.string().optional(),
  feedback_channel_id: z.string().optional(),
  coupon_channel_id: z.string().optional(),
  bang_gia_channel_id: z.string().optional(),
  welcome_channel_id: z.string().optional(),
});
type ChannelFormValues = z.infer<typeof channelSchema>;

function DiscordSelectField({
  value, onChange, options, placeholder, disabled,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ChannelsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();
  const { data: config, isLoading } = useConfig();

  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelSchema),
    defaultValues: {
      don_hang_channel_id: "", feedback_channel_id: "",
      coupon_channel_id: "", bang_gia_channel_id: "", welcome_channel_id: "",
    },
  });

  useEffect(() => {
    if (config)
      form.reset({
        don_hang_channel_id: config.don_hang_channel_id || "",
        feedback_channel_id: config.feedback_channel_id || "",
        coupon_channel_id: config.coupon_channel_id || "",
        bang_gia_channel_id: config.bang_gia_channel_id || "",
        welcome_channel_id: config.welcome_channel_id || "",
      });
  }, [config]);

  const activeGuildId = selectedGuildId || config?.guild_id;

  const { data: channels = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["discord_channels", activeGuildId],
    queryFn: () =>
      fetch(`/api/discord/channels?guild_id=${activeGuildId}`, { credentials: "include" }).then((r) =>
        r.ok ? r.json() : []
      ),
    enabled: !!activeGuildId,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (v: ChannelFormValues) =>
      fetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(selectedGuildId ? { "X-Guild-ID": selectedGuildId } : {}),
        },
        credentials: "include",
        body: JSON.stringify(v),
      }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config", selectedGuildId] });
      toast({ title: "Saved", description: "Channels & roles updated." });
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Failed to save." }),
  });

  const channelFields: { name: keyof ChannelFormValues; label: string; desc: string }[] = [
    { name: "don_hang_channel_id",  label: "Orders Channel",    desc: "New order notifications" },
    { name: "feedback_channel_id",  label: "Feedback Channel",  desc: "User feedback & reviews" },
    { name: "coupon_channel_id",    label: "Coupon Channel",    desc: "Coupon announcements" },
    { name: "bang_gia_channel_id",  label: "Price List Channel",desc: "Product price board" },
    { name: "welcome_channel_id",   label: "Welcome Channel",   desc: "Member join/leave messages" },
  ];

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        {/* Notification Channels */}
        <div className="space-y-1">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5" /> Notification Channels
          </Label>
          <p className="text-xs text-muted-foreground">Bot will send notifications to these channels.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channelFields.map(({ name, label, desc }) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">{label}</FormLabel>
                  <p className="text-xs text-muted-foreground -mt-1">{desc}</p>
                  <FormControl>
                    {channels.length > 0 ? (
                      <DiscordSelectField
                        value={field.value}
                        onChange={field.onChange}
                        options={channels.map((c) => ({ id: c.id, name: `#${c.name}` }))}
                        placeholder="Select channel..."
                      />
                    ) : (
                      <Input
                        placeholder={activeGuildId ? "Loading channels..." : "Select a server first"}
                        disabled={!activeGuildId}
                        {...field}
                        value={field.value || ""}
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

        <Button type="submit" disabled={mutation.isPending} size="sm" className="gap-2">
          <Save className="w-3.5 h-3.5" />
          {mutation.isPending ? "Saving..." : "Save Channels"}
        </Button>
      </form>
    </Form>
  );
}

// ─── Section: TempVoice ──────────────────────────────────────────────────────

const VOICE_BUTTON_OPTIONS = [
  { key: "name",     label: "Name",     desc: "Rename the room",      emoji: "✏️" },
  { key: "limit",    label: "Limit",    desc: "Set user limit",       emoji: "👥" },
  { key: "privacy",  label: "Privacy",  desc: "Toggle private",       emoji: "🔐" },
  { key: "trust",    label: "Trust",    desc: "Allow a user",         emoji: "✅" },
  { key: "untrust",  label: "Untrust",  desc: "Remove a user",        emoji: "➖" },
  { key: "invite",   label: "Invite",   desc: "Invite a user",        emoji: "📨" },
  { key: "kick",     label: "Kick",     desc: "Kick from channel",    emoji: "👢" },
  { key: "region",   label: "Region",   desc: "Set voice region",     emoji: "🌍" },
  { key: "block",    label: "Block",    desc: "Block a user",         emoji: "🚫" },
  { key: "unblock",  label: "Unblock",  desc: "Unblock a user",       emoji: "🔓" },
  { key: "claim",    label: "Claim",    desc: "Claim ownerless room", emoji: "🙋" },
  { key: "transfer", label: "Transfer", desc: "Transfer ownership",   emoji: "👑" },
  { key: "delete",   label: "Delete",   desc: "Delete the room",      emoji: "🗑️" },
];
const DEFAULT_VOICE_BUTTONS = VOICE_BUTTON_OPTIONS.map((b) => b.key);

const BITRATE_OPTIONS = [
  { value: 8000,   label: "8 kbps" },
  { value: 32000,  label: "32 kbps" },
  { value: 64000,  label: "64 kbps" },
  { value: 96000,  label: "96 kbps" },
  { value: 128000, label: "128 kbps" },
  { value: 256000, label: "256 kbps" },
  { value: 384000, label: "384 kbps" },
];

function TempVoiceSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();

  const { data: tvConfig } = useQuery({
    queryKey: ["tempvoice_config"],
    queryFn: () => fetch("/api/tempvoice/config", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const [enabled, setEnabled] = useState(false);
  const [joinChannel, setJoinChannel] = useState("");
  const [category, setCategory] = useState("");
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

  const toggleBtn = (key: string, checked: boolean) =>
    setVoiceButtons((cur) => checked ? [...new Set([...cur, key])] : cur.filter((k) => k !== key));

  const mutation = useMutation({
    mutationFn: () =>
      fetch("/api/tempvoice/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          enabled, join_channel_id: joinChannel, category_id: category,
          default_user_limit: defaultUserLimit, default_bitrate: defaultBitrate,
          naming_format: namingFormat, allow_rename: allowRename, allow_limit: allowLimit,
          allow_lock: allowLock, allow_hide: allowHide, interface_channel_id: interfaceChannel,
          voice_buttons: voiceButtons, auto_delete_seconds: autoDeleteSeconds,
        }),
      }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tempvoice_config"] });
      toast({ title: "Saved", description: "TempVoice config updated." });
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Failed to save." }),
  });

  return (
    <div className="space-y-6">
      {/* Enable */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-semibold">Enable TempVoice</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            When a user joins the "Join to Create" channel, the bot creates a private voice room for them.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className={enabled ? "border-green-500/40 text-green-600 bg-green-500/10" : "text-muted-foreground"}>
            {enabled ? "Enabled" : "Disabled"}
          </Badge>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      <Separator />

      {/* Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm">"Join to Create" Channel</Label>
          <ChannelSelect value={joinChannel} onChange={setJoinChannel} placeholder="Select voice channel..." filter="voice" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Room Category</Label>
          <ChannelSelect value={category} onChange={setCategory} placeholder="Select category..." filter="category" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Control Panel Channel</Label>
          <ChannelSelect value={interfaceChannel} onChange={setInterfaceChannel} placeholder="Select text channel..." filter="text" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Default Room Name</Label>
          <Input value={namingFormat} onChange={(e) => setNamingFormat(e.target.value)} placeholder="{user}'s Channel" />
          <p className="text-xs text-muted-foreground">Variable: <code className="bg-muted px-1 rounded">{"{user}"}</code></p>
        </div>
      </div>

      {/* Limits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Label className="text-sm">User Limit ({defaultUserLimit === 0 ? "Unlimited" : defaultUserLimit})</Label>
          <Slider min={0} max={99} step={1} value={[defaultUserLimit]} onValueChange={([v]) => setDefaultUserLimit(v)} />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Default Bitrate</Label>
          <Select value={String(defaultBitrate)} onValueChange={(v) => setDefaultBitrate(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {BITRATE_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Permissions */}
      <div className="space-y-1">
        <Label className="text-sm font-semibold">User Permissions</Label>
        <p className="text-xs text-muted-foreground">What room owners are allowed to do.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: "rename", label: "Rename room",  state: allowRename, set: setAllowRename },
          { key: "limit",  label: "Set limit",    state: allowLimit,  set: setAllowLimit  },
          { key: "lock",   label: "Lock room",    state: allowLock,   set: setAllowLock   },
          { key: "hide",   label: "Hide room",    state: allowHide,   set: setAllowHide   },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <Label className="font-normal text-sm">{item.label}</Label>
            <Switch checked={item.state} onCheckedChange={item.set} />
          </div>
        ))}
      </div>

      <Separator />

      {/* Panel buttons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-semibold">Control Panel Buttons</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {voiceButtons.length}/{VOICE_BUTTON_OPTIONS.length} enabled
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setVoiceButtons(DEFAULT_VOICE_BUTTONS)}>
            Select all
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VOICE_BUTTON_OPTIONS.map((btn) => (
            <div key={btn.key} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{btn.emoji} {btn.label}</p>
                <p className="text-xs text-muted-foreground">{btn.desc}</p>
              </div>
              <Switch checked={voiceButtons.includes(btn.key)} onCheckedChange={(c) => toggleBtn(btn.key, c)} />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Auto delete */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Auto-delete Delay (seconds)</Label>
        <Input type="number" min={0} value={autoDeleteSeconds} onChange={(e) => setAutoDeleteSeconds(Number(e.target.value))} placeholder="0" className="w-36" />
        <p className="text-xs text-muted-foreground">
          {autoDeleteSeconds === 0 ? "Delete immediately when empty." : `Delete ${autoDeleteSeconds}s after the room becomes empty.`}
        </p>
      </div>

      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} size="sm" className="gap-2">
        <Save className="w-3.5 h-3.5" />
        {mutation.isPending ? "Saving..." : "Save TempVoice"}
      </Button>
    </div>
  );
}

// ─── Section: Logging ────────────────────────────────────────────────────────

interface LoggingData {
  message_log_channel_id: string;
  voice_log_channel_id: string;
  mod_log_channel_id: string;
  member_log_channel_id: string;
  server_log_channel_id: string;
  ignored_channels: string[];
  ignored_roles: string[];
}

function LoggingSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<LoggingData>({
    queryKey: ["logging-config"],
    queryFn: () => fetch("/api/logging/config", { credentials: "include" }).then((r) => {
      if (!r.ok) throw new Error();
      return r.json();
    }),
    staleTime: 60_000,
  });

  const [messageLog, setMessageLog] = useState("");
  const [voiceLog, setVoiceLog]     = useState("");
  const [modLog, setModLog]         = useState("");
  const [memberLog, setMemberLog]   = useState("");
  const [serverLog, setServerLog]   = useState("");
  const [ignoredRoles, setIgnoredRoles] = useState<string[]>([]);

  useEffect(() => {
    if (data) {
      setMessageLog(data.message_log_channel_id ?? "");
      setVoiceLog(data.voice_log_channel_id ?? "");
      setModLog(data.mod_log_channel_id ?? "");
      setMemberLog(data.member_log_channel_id ?? "");
      setServerLog(data.server_log_channel_id ?? "");
      setIgnoredRoles(data.ignored_roles ?? []);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      fetch("/api/logging/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message_log_channel_id: messageLog,
          voice_log_channel_id: voiceLog,
          mod_log_channel_id: modLog,
          member_log_channel_id: memberLog,
          server_log_channel_id: serverLog,
          ignored_channels: data?.ignored_channels ?? [],
          ignored_roles: ignoredRoles,
        }),
      }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logging-config"] });
      toast({ title: "Saved", description: "Logging config updated." });
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Failed to save." }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  const logFields = [
    { label: "Message Log", desc: "Deleted / edited messages", icon: <ScrollText className="h-3.5 w-3.5" />, value: messageLog, set: setMessageLog },
    { label: "Voice Log",   desc: "Join / leave voice",        icon: <Mic className="h-3.5 w-3.5" />,        value: voiceLog,   set: setVoiceLog   },
    { label: "Mod Log",     desc: "Ban / kick / warn",          icon: <ShieldCheck className="h-3.5 w-3.5" />, value: modLog,     set: setModLog     },
    { label: "Member Log",  desc: "Join / leave / role changes",icon: <Users className="h-3.5 w-3.5" />,      value: memberLog,  set: setMemberLog  },
    { label: "Server Log",  desc: "Channel create / delete",    icon: <Server className="h-3.5 w-3.5" />,     value: serverLog,  set: setServerLog  },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {logFields.map((f) => (
          <div key={f.label} className="space-y-2">
            <Label className="text-sm flex items-center gap-1.5 text-muted-foreground">
              {f.icon} {f.label}
            </Label>
            <p className="text-xs text-muted-foreground -mt-1">{f.desc}</p>
            <div className="flex items-center gap-1.5">
              <ChannelSelect value={f.value} onChange={f.set} placeholder="Select channel..." filter="text" />
              {f.value && (
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => f.set("")}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" /> Ignored Roles
        </Label>
        <p className="text-xs text-muted-foreground">Actions from these roles will not be logged.</p>
        <MultiRoleSelect value={ignoredRoles} onChange={setIgnoredRoles} placeholder="Select roles to ignore..." />
      </div>

      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} size="sm" className="gap-2">
        <Save className="w-3.5 h-3.5" />
        {mutation.isPending ? "Saving..." : "Save Logging"}
      </Button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function BotSettings() {
  return (
    <div className="space-y-4 max-w-3xl">
      <Accordion type="multiple" defaultValue={["general"]} className="space-y-2">

        <AccordionItem value="general" className="border rounded-xl px-5">
          <AccordionTrigger className="hover:no-underline py-4">
            <span className="flex items-center gap-2.5 text-sm font-semibold">
              <Settings className="w-4 h-4 text-muted-foreground" />
              General
              <span className="text-xs font-normal text-muted-foreground">Language · Prefix · Admin roles</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-5">
            <GeneralSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="channels" className="border rounded-xl px-5">
          <AccordionTrigger className="hover:no-underline py-4">
            <span className="flex items-center gap-2.5 text-sm font-semibold">
              <Hash className="w-4 h-4 text-muted-foreground" />
              Channels &amp; Roles
              <span className="text-xs font-normal text-muted-foreground">Notification channels</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-5">
            <ChannelsSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tempvoice" className="border rounded-xl px-5">
          <AccordionTrigger className="hover:no-underline py-4">
            <span className="flex items-center gap-2.5 text-sm font-semibold">
              <Mic className="w-4 h-4 text-muted-foreground" />
              TempVoice
              <span className="text-xs font-normal text-muted-foreground">Auto voice rooms</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-5">
            <TempVoiceSection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="logging" className="border rounded-xl px-5">
          <AccordionTrigger className="hover:no-underline py-4">
            <span className="flex items-center gap-2.5 text-sm font-semibold">
              <ScrollText className="w-4 h-4 text-muted-foreground" />
              Logging
              <span className="text-xs font-normal text-muted-foreground">Event log channels</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-5">
            <LoggingSection />
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  );
}
