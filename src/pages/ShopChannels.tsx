import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelSelect } from "@/components/ChannelSelect";
import { useGuild } from "@/contexts/GuildContext";
import { apiFetch } from "@/hooks/useApi";
import { toast } from "@/hooks/use-toast";
import { useT } from "@/i18n";
import { Save, Loader2, Hash } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/yuri";

interface ShopChannelsConfig {
  orders_channel_id: string;
  feedback_channel_id: string;
  coupon_log_channel_id: string;
  price_list_channel_id: string;
  welcome_channel_id: string;
  flash_sale_channel_id: string;
  spending_leaderboard_channel_id: string;
  spending_leaderboard_schedule: string;
  spending_leaderboard_time: string;
  inventory_low_stock_threshold: number;
  timezone: string;
}

const TIMEZONES = [
  { value: "Asia/Ho_Chi_Minh", label: "Asia/Ho_Chi_Minh (UTC+7)" },
  { value: "Asia/Bangkok",     label: "Asia/Bangkok (UTC+7)" },
  { value: "Asia/Singapore",   label: "Asia/Singapore (UTC+8)" },
  { value: "Asia/Tokyo",       label: "Asia/Tokyo (UTC+9)" },
  { value: "Asia/Seoul",       label: "Asia/Seoul (UTC+9)" },
  { value: "Asia/Shanghai",    label: "Asia/Shanghai (UTC+8)" },
  { value: "Asia/Jakarta",     label: "Asia/Jakarta (UTC+7)" },
  { value: "Asia/Kolkata",     label: "Asia/Kolkata (UTC+5:30)" },
  { value: "Asia/Dubai",       label: "Asia/Dubai (UTC+4)" },
  { value: "Europe/London",    label: "Europe/London (UTC+0/+1)" },
  { value: "Europe/Paris",     label: "Europe/Paris (UTC+1/+2)" },
  { value: "America/New_York", label: "America/New_York (UTC-5/-4)" },
  { value: "America/Chicago",  label: "America/Chicago (UTC-6/-5)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (UTC-8/-7)" },
  { value: "UTC",              label: "UTC (UTC+0)" },
];

const CHANNEL_FIELDS: { key: keyof ShopChannelsConfig; label: string }[] = [
  { key: "orders_channel_id", label: "Orders channel" },
  { key: "feedback_channel_id", label: "Feedback channel" },
  { key: "coupon_log_channel_id", label: "Coupon log channel" },
  { key: "price_list_channel_id", label: "Price list channel" },
  { key: "welcome_channel_id", label: "Welcome channel" },
  { key: "flash_sale_channel_id", label: "Flash Sale channel" },
  { key: "spending_leaderboard_channel_id", label: "Auto Leaderboard channel" },
];

export function ShopChannels() {
  const { t } = useT();
  const { selectedGuildId } = useGuild();
  const guildId = selectedGuildId ?? undefined;

  const [form, setForm] = useState<ShopChannelsConfig>({
    orders_channel_id: "",
    feedback_channel_id: "",
    coupon_log_channel_id: "",
    price_list_channel_id: "",
    welcome_channel_id: "",
    flash_sale_channel_id: "",
    spending_leaderboard_channel_id: "",
    spending_leaderboard_schedule: "daily",
    spending_leaderboard_time: "00:00",
    inventory_low_stock_threshold: 5,
    timezone: "Asia/Ho_Chi_Minh",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [savingCard, setSavingCard] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedGuildId) return;
    setIsLoading(true);
    apiFetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        setForm({
          orders_channel_id: data.orders_channel_id || data.don_hang_channel_id || "",
          feedback_channel_id: data.feedback_channel_id || "",
          coupon_log_channel_id: data.coupon_log_channel_id || data.coupon_channel_id || "",
          price_list_channel_id: data.price_list_channel_id || data.bang_gia_channel_id || "",
          welcome_channel_id: data.welcome_channel_id || "",
          flash_sale_channel_id: data.flash_sale_channel_id || "",
          spending_leaderboard_channel_id: data.spending_leaderboard_channel_id || "",
          spending_leaderboard_schedule: data.spending_leaderboard_schedule || "daily",
          spending_leaderboard_time: data.spending_leaderboard_time || "00:00",
          inventory_low_stock_threshold: data.inventory_low_stock_threshold ?? 5,
          timezone: data.timezone || "Asia/Ho_Chi_Minh",
        });
      })
      .catch(() => toast({ title: t("error"), variant: "destructive" }))
      .finally(() => setIsLoading(false));
  }, [selectedGuildId]);

  const set = (key: keyof ShopChannelsConfig, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const saveCard = async (cardId: string, payload: Partial<ShopChannelsConfig>) => {
    setSavingCard(cardId);
    try {
      const r = await apiFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Saved" });
    } catch {
      toast({ title: t("error"), variant: "destructive" });
    } finally {
      setSavingCard(null);
    }
  };

  const SaveBtn = ({ cardId }: { cardId: string }) => (
    <Button
      size="sm"
      onClick={() => {
        const channelKeys: (keyof ShopChannelsConfig)[] = [
          "orders_channel_id", "feedback_channel_id", "coupon_log_channel_id",
          "price_list_channel_id", "welcome_channel_id", "flash_sale_channel_id",
          "spending_leaderboard_channel_id",
        ];
        const leaderboardKeys: (keyof ShopChannelsConfig)[] = [
          "spending_leaderboard_channel_id",
          "spending_leaderboard_schedule",
          "spending_leaderboard_time",
        ];
        const inventoryKeys: (keyof ShopChannelsConfig)[] = [
          "inventory_low_stock_threshold",
        ];

        const keyMap: Record<string, (keyof ShopChannelsConfig)[]> = {
          channels: channelKeys,
          leaderboard: leaderboardKeys,
          inventory: inventoryKeys,
          timezone: ["timezone"],
        };

        const keys = keyMap[cardId] ?? [];
        const payload = Object.fromEntries(
          keys.map((k) => [k, form[k]])
        ) as Partial<ShopChannelsConfig>;
        saveCard(cardId, payload);
      }}
      disabled={savingCard === cardId}
    >
      {savingCard === cardId
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <Save className="h-4 w-4 mr-2" />}
      {savingCard === cardId ? t("saving") : t("save")}
    </Button>
  );

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-60 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );

  return (
    <PageContainer size="sm">
      <PageHeader title="Shop Config" icon={Hash} />

      {/* Card 1: Shop Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shop Channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {CHANNEL_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <label className="text-sm font-medium">{label}</label>
              <ChannelSelect
                value={form[key] as string}
                onChange={(v) => set(key, v)}
                guildId={guildId}
                filter="text"
                placeholder={label}
              />
            </div>
          ))}
        </CardContent>
        <CardFooter className="border-t pt-4">
          <SaveBtn cardId="channels" />
        </CardFooter>
      </Card>

      {/* Card 2: Auto Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auto Leaderboard Config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Schedule</Label>
            <Select
              value={form.spending_leaderboard_schedule}
              onValueChange={(v) => set("spending_leaderboard_schedule", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select schedule" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Time</Label>
            <div className="flex items-center gap-2">
              <Select
                value={form.spending_leaderboard_time.split(":")[0] || "00"}
                onValueChange={(h) => {
                  const m = form.spending_leaderboard_time.split(":")[1] || "00";
                  set("spending_leaderboard_time", `${h}:${m}`);
                }}
              >
                <SelectTrigger className="w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-56 overflow-y-auto">
                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground font-medium">:</span>
              <Select
                value={form.spending_leaderboard_time.split(":")[1] || "00"}
                onValueChange={(m) => {
                  const h = form.spending_leaderboard_time.split(":")[0] || "00";
                  set("spending_leaderboard_time", `${h}:${m}`);
                }}
              >
                <SelectTrigger className="w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-56 overflow-y-auto">
                  {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <SaveBtn cardId="leaderboard" />
        </CardFooter>
      </Card>

      {/* Card 3: Inventory */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Low stock warning threshold</Label>
            <Input
              type="number"
              min={0}
              className="w-32"
              value={form.inventory_low_stock_threshold}
              onChange={(e) => set("inventory_low_stock_threshold", Number(e.target.value))}
            />
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <SaveBtn cardId="inventory" />
        </CardFooter>
      </Card>

      {/* Card 4: Timezone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timezone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Múi giờ</Label>
            <Select
              value={form.timezone}
              onValueChange={(v) => set("timezone", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <SaveBtn cardId="timezone" />
        </CardFooter>
      </Card>

    </PageContainer>
  );
}
