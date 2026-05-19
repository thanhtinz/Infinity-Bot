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

interface ShopChannelsConfig {
  orders_channel_id: string;
  feedback_channel_id: string;
  coupon_log_channel_id: string;
  price_list_channel_id: string;
  welcome_channel_id: string;
}

const FIELDS: { key: keyof ShopChannelsConfig; label: string }[] = [
  { key: "orders_channel_id", label: "Orders channel" },
  { key: "feedback_channel_id", label: "Feedback channel" },
  { key: "coupon_log_channel_id", label: "Coupon log channel" },
  { key: "price_list_channel_id", label: "Price list channel" },
  { key: "welcome_channel_id", label: "Welcome channel" },
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
        });
      })
      .catch(() => toast({ title: t("error"), variant: "destructive" }))
      .finally(() => setIsLoading(false));
  }, [selectedGuildId]);

  const set = (key: keyof ShopChannelsConfig, value: string) =>
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

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 sm:mr-2" />}
        <span className="hidden sm:inline">{isSaving ? t("saving") : t("save")}</span>
      </Button>
    </div>
  );
}
