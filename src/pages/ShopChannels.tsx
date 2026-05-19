import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelSelect } from "@/components/ChannelSelect";
import { useGuild } from "@/contexts/GuildContext";
import { apiFetch } from "@/hooks/useApi";
import { toast } from "@/hooks/use-toast";
import { useT } from "@/i18n";
import { Save, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
}

const FIELDS: { key: keyof ShopChannelsConfig; label: string }[] = [
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
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
        });
      })
      .catch(() => toast({ title: t("error"), variant: "destructive" }))
      .finally(() => setIsLoading(false));
  }, [selectedGuildId]);

  const set = (key: keyof ShopChannelsConfig, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const r = await apiFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Saved" });
    } catch {
      toast({ title: t("error"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-60 w-full" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shop Channels</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Channel Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <label className="text-sm font-medium">{label}</label>
              <ChannelSelect
                value={form[key]}
                onChange={(v) => set(key, v)}
                guildId={guildId}
                filter="text"
                placeholder={label}
              />
            </div>
          ))}
        </CardContent>
      </Card>

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
            <Input
              type="time"
              value={form.spending_leaderboard_time}
              onChange={(e) => set("spending_leaderboard_time", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Low stock threshold</Label>
            <Input
              type="number"
              min={0}
              value={form.inventory_low_stock_threshold}
              onChange={(e) => set("inventory_low_stock_threshold", Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 sm:mr-2" />}
        <span className="hidden sm:inline">{isSaving ? t("saving") : t("save")}</span>
      </Button>
    </div>
  );
}
