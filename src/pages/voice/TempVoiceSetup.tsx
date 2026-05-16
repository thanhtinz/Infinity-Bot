import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelSelect } from "@/components/ChannelSelect";
import { useVoiceConfig } from "@/hooks/useVoiceConfig";
import type { VoiceConfig } from "@/hooks/useVoiceConfig";
import { useGuild } from "@/contexts/GuildContext";
import { useT } from "@/i18n";

export function TempVoiceSetup() {
  const { t } = useT();
  const { selectedGuildId } = useGuild();
  const guildId = selectedGuildId ?? undefined;
  const { config, save, isSaving, isLoading } = useVoiceConfig();
  const [form, setForm] = useState<Partial<VoiceConfig>>({});

  useEffect(() => { setForm(config); }, [config]);

  const set = <K extends keyof VoiceConfig>(key: K, value: VoiceConfig[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("voice_setup")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("voice_joinChannel")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChannelSelect
            value={form.join_channel_id ?? ""}
            onChange={(v) => set("join_channel_id", v || null)}
            guildId={guildId}
            filter="voice"
            placeholder={t("voice_joinChannel")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("voice_category")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChannelSelect
            value={form.category_id ?? ""}
            onChange={(v) => set("category_id", v || null)}
            guildId={guildId}
            filter="category"
            placeholder={t("voice_category")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("voice_interfaceChannel")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChannelSelect
            value={form.interface_channel_id ?? ""}
            onChange={(v) => set("interface_channel_id", v || null)}
            guildId={guildId}
            filter="text"
            placeholder={t("voice_interfaceChannel")}
          />
        </CardContent>
      </Card>

      <Button onClick={() => save(form as VoiceConfig)} disabled={isSaving}>
        {isSaving ? t("saving") : t("save")}
      </Button>
    </div>
  );
}
