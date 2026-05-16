import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { ChannelSelect } from "@/components/ChannelSelect";
import { MultiRoleSelect } from "@/components/RoleSelect";
import {
  Shield,
  MessageSquareOff,
  Link2Off,
  Ban,
  CaseSensitive,
  AtSign,
  ChevronDown,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AutoModConfigData {
  anti_spam_enabled: boolean;
  anti_spam_max_messages: number;
  anti_spam_interval: number;
  anti_spam_action: string;
  anti_link_enabled: boolean;
  anti_link_whitelist: string[];
  bad_words_enabled: boolean;
  bad_words_list: string[];
  caps_lock_enabled: boolean;
  caps_lock_min_length: number;
  caps_lock_percentage: number;
  mention_spam_enabled: boolean;
  mention_spam_max: number;
  mention_spam_action: string;
  ignored_channels: string[];
  ignored_roles: string[];
  log_channel_id: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ACTION_OPTIONS = [
  { value: "warn", label: "Cảnh cáo" },
  { value: "mute", label: "Mute 5 phút" },
  { value: "kick", label: "Kick" },
] as const;

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchAutoModConfig(): Promise<AutoModConfigData> {
  const res = await fetch("/api/automod/config", { credentials: "include" });
  if (!res.ok) throw new Error("Tải cấu hình thất bại");
  return res.json();
}

async function saveAutoModConfig(data: AutoModConfigData): Promise<{ ok: boolean }> {
  const res = await fetch("/api/automod/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Lưu thất bại");
  return res.json();
}

// ─── Helper: array ↔ textarea ────────────────────────────────────────────────

function arrToText(arr: string[]): string {
  return arr.join("\n");
}

function textToArr(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AutoModConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ["automod_config"],
    queryFn: fetchAutoModConfig,
    staleTime: 60_000,
  });

  // Anti-spam
  const [antiSpamEnabled, setAntiSpamEnabled] = useState(false);
  const [antiSpamMaxMessages, setAntiSpamMaxMessages] = useState(5);
  const [antiSpamInterval, setAntiSpamInterval] = useState(10);
  const [antiSpamAction, setAntiSpamAction] = useState("warn");

  // Anti-link
  const [antiLinkEnabled, setAntiLinkEnabled] = useState(false);
  const [antiLinkWhitelist, setAntiLinkWhitelist] = useState("");

  // Bad words
  const [badWordsEnabled, setBadWordsEnabled] = useState(false);
  const [badWordsList, setBadWordsList] = useState("");

  // Caps lock
  const [capsLockEnabled, setCapsLockEnabled] = useState(false);
  const [capsLockMinLength, setCapsLockMinLength] = useState(8);
  const [capsLockPercentage, setCapsLockPercentage] = useState(70);

  // Mention spam
  const [mentionSpamEnabled, setMentionSpamEnabled] = useState(false);
  const [mentionSpamMax, setMentionSpamMax] = useState(5);
  const [mentionSpamAction, setMentionSpamAction] = useState("warn");

  // Global
  const [ignoredChannels, setIgnoredChannels] = useState<string[]>([]);
  const [ignoredRoles, setIgnoredRoles] = useState<string[]>([]);
  const [logChannelId, setLogChannelId] = useState<string | null>(null);

  // Collapsible open states
  const [antiSpamOpen, setAntiSpamOpen] = useState(false);
  const [antiLinkOpen, setAntiLinkOpen] = useState(false);
  const [badWordsOpen, setBadWordsOpen] = useState(false);
  const [capsLockOpen, setCapsLockOpen] = useState(false);
  const [mentionSpamOpen, setMentionSpamOpen] = useState(false);

  useEffect(() => {
    if (config) {
      setAntiSpamEnabled(config.anti_spam_enabled);
      setAntiSpamMaxMessages(config.anti_spam_max_messages);
      setAntiSpamInterval(config.anti_spam_interval);
      setAntiSpamAction(config.anti_spam_action);
      setAntiLinkEnabled(config.anti_link_enabled);
      setAntiLinkWhitelist(arrToText(config.anti_link_whitelist ?? []));
      setBadWordsEnabled(config.bad_words_enabled);
      setBadWordsList(arrToText(config.bad_words_list ?? []));
      setCapsLockEnabled(config.caps_lock_enabled);
      setCapsLockMinLength(config.caps_lock_min_length);
      setCapsLockPercentage(config.caps_lock_percentage);
      setMentionSpamEnabled(config.mention_spam_enabled);
      setMentionSpamMax(config.mention_spam_max);
      setMentionSpamAction(config.mention_spam_action);
      setIgnoredChannels(config.ignored_channels ?? []);
      setIgnoredRoles(config.ignored_roles ?? []);
      setLogChannelId(config.log_channel_id);

      // Auto-expand enabled sections
      setAntiSpamOpen(config.anti_spam_enabled);
      setAntiLinkOpen(config.anti_link_enabled);
      setBadWordsOpen(config.bad_words_enabled);
      setCapsLockOpen(config.caps_lock_enabled);
      setMentionSpamOpen(config.mention_spam_enabled);
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: () =>
      saveAutoModConfig({
        anti_spam_enabled: antiSpamEnabled,
        anti_spam_max_messages: antiSpamMaxMessages,
        anti_spam_interval: antiSpamInterval,
        anti_spam_action: antiSpamAction,
        anti_link_enabled: antiLinkEnabled,
        anti_link_whitelist: textToArr(antiLinkWhitelist),
        bad_words_enabled: badWordsEnabled,
        bad_words_list: textToArr(badWordsList),
        caps_lock_enabled: capsLockEnabled,
        caps_lock_min_length: capsLockMinLength,
        caps_lock_percentage: capsLockPercentage,
        mention_spam_enabled: mentionSpamEnabled,
        mention_spam_max: mentionSpamMax,
        mention_spam_action: mentionSpamAction,
        ignored_channels: ignoredChannels,
        ignored_roles: ignoredRoles,
        log_channel_id: logChannelId,
      }),
    onSuccess: () => {
      toast({ title: "Saved", description: "Cấu hình Auto Mod đã được cập nhật." });
      qc.invalidateQueries({ queryKey: ["automod_config"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          <h2 className="text-2xl font-bold tracking-tight">Auto Mod</h2>
        </div>
        <p className="text-muted-foreground mt-1">Tự động kiểm duyệt tin nhắn</p>
      </div>

      {/* ── Anti-Spam ── */}
      <Card>
        <Collapsible open={antiSpamOpen} onOpenChange={setAntiSpamOpen}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquareOff className="w-4 h-4" /> Chống Spam
              </CardTitle>
              <div className="flex items-center gap-3">
                <Switch
                  checked={antiSpamEnabled}
                  onCheckedChange={(v) => {
                    setAntiSpamEnabled(v);
                    if (v) setAntiSpamOpen(true);
                  }}
                />
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${antiSpamOpen ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Số tin nhắn tối đa</Label>
                  <Input
                    type="number"
                    min={1}
                    value={antiSpamMaxMessages}
                    onChange={(e) => setAntiSpamMaxMessages(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Khoảng thời gian (giây)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={antiSpamInterval}
                    onChange={(e) => setAntiSpamInterval(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Actions</Label>
                <Select value={antiSpamAction} onValueChange={setAntiSpamAction}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* ── Anti-Link ── */}
      <Card>
        <Collapsible open={antiLinkOpen} onOpenChange={setAntiLinkOpen}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2Off className="w-4 h-4" /> Chống Link
              </CardTitle>
              <div className="flex items-center gap-3">
                <Switch
                  checked={antiLinkEnabled}
                  onCheckedChange={(v) => {
                    setAntiLinkEnabled(v);
                    if (v) setAntiLinkOpen(true);
                  }}
                />
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${antiLinkOpen ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="space-y-2">
                <Label>Whitelist (mỗi dòng một domain)</Label>
                <Textarea
                  value={antiLinkWhitelist}
                  onChange={(e) => setAntiLinkWhitelist(e.target.value)}
                  placeholder={"discord.com\ngithub.com"}
                  rows={4}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* ── Bad Words ── */}
      <Card>
        <Collapsible open={badWordsOpen} onOpenChange={setBadWordsOpen}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Ban className="w-4 h-4" /> Từ cấm
              </CardTitle>
              <div className="flex items-center gap-3">
                <Switch
                  checked={badWordsEnabled}
                  onCheckedChange={(v) => {
                    setBadWordsEnabled(v);
                    if (v) setBadWordsOpen(true);
                  }}
                />
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${badWordsOpen ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="space-y-2">
                <Label>Danh sách từ cấm (mỗi dòng một từ)</Label>
                <Textarea
                  value={badWordsList}
                  onChange={(e) => setBadWordsList(e.target.value)}
                  placeholder={"badword1\nbadword2"}
                  rows={4}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* ── Caps Lock ── */}
      <Card>
        <Collapsible open={capsLockOpen} onOpenChange={setCapsLockOpen}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <CaseSensitive className="w-4 h-4" /> Chống Viết Hoa
              </CardTitle>
              <div className="flex items-center gap-3">
                <Switch
                  checked={capsLockEnabled}
                  onCheckedChange={(v) => {
                    setCapsLockEnabled(v);
                    if (v) setCapsLockOpen(true);
                  }}
                />
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${capsLockOpen ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="space-y-2">
                <Label>Độ dài tối thiểu</Label>
                <Input
                  type="number"
                  min={1}
                  value={capsLockMinLength}
                  onChange={(e) => setCapsLockMinLength(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Chỉ kiểm tra tin nhắn dài hơn giá trị này.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Phần trăm viết hoa: {capsLockPercentage}%</Label>
                <Slider
                  value={[capsLockPercentage]}
                  onValueChange={([v]) => setCapsLockPercentage(v)}
                  min={10}
                  max={100}
                  step={5}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* ── Mention Spam ── */}
      <Card>
        <Collapsible open={mentionSpamOpen} onOpenChange={setMentionSpamOpen}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <AtSign className="w-4 h-4" /> Chống Tag Hàng Loạt
              </CardTitle>
              <div className="flex items-center gap-3">
                <Switch
                  checked={mentionSpamEnabled}
                  onCheckedChange={(v) => {
                    setMentionSpamEnabled(v);
                    if (v) setMentionSpamOpen(true);
                  }}
                />
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${mentionSpamOpen ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="space-y-2">
                <Label>Số tag tối đa</Label>
                <Input
                  type="number"
                  min={1}
                  value={mentionSpamMax}
                  onChange={(e) => setMentionSpamMax(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Actions</Label>
                <Select value={mentionSpamAction} onValueChange={setMentionSpamAction}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* ── Bộ lọc ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bộ lọc</CardTitle>
          <CardDescription>
            Các kênh và role sẽ bị bỏ qua bởi tất cả bộ lọc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Kênh bỏ qua</Label>
            <ChannelSelect
              value={ignoredChannels[0] ?? ""}
              onChange={(v) => setIgnoredChannels(v ? [v] : [])}
              placeholder="Select channel..."
              filter="text"
            />
            <p className="text-xs text-muted-foreground">
              Kênh sẽ không bị kiểm tra bởi Auto Mod.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Role bỏ qua</Label>
            <MultiRoleSelect
              value={ignoredRoles}
              onChange={setIgnoredRoles}
              placeholder="Chọn roles..."
            />
          </div>

          <div className="space-y-2">
            <Label>Log channel</Label>
            <ChannelSelect
              value={logChannelId ?? ""}
              onChange={setLogChannelId}
              placeholder="Select channel..."
              filter="text"
            />
            <p className="text-xs text-muted-foreground">
              Kênh ghi lại các hành động của Auto Mod.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? "Saving..." : "Lưu cấu hình"}
      </Button>
    </div>
  );
}
