import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useVoiceConfig } from "@/hooks/useVoiceConfig";
import type { VoiceConfig } from "@/hooks/useVoiceConfig";
import { useT } from "@/i18n";

const BITRATE_OPTIONS = [
  { value: 8000,   label: "8 kbps" },
  { value: 32000,  label: "32 kbps" },
  { value: 64000,  label: "64 kbps" },
  { value: 96000,  label: "96 kbps" },
  { value: 128000, label: "128 kbps" },
  { value: 256000, label: "256 kbps" },
  { value: 384000, label: "384 kbps" },
];

export function TempVoiceDefaults() {
  const { t } = useT();
  const { config, save, isSaving, isLoading } = useVoiceConfig();
  const [form, setForm] = useState<Partial<VoiceConfig>>({});

  useEffect(() => { setForm(config); }, [config]);

  const set = <K extends keyof VoiceConfig>(key: K, value: VoiceConfig[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-60 w-full" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("voice_defaults")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("voice_namingFormat")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={form.naming_format ?? ""}
            onChange={(e) => set("naming_format", e.target.value)}
            placeholder="{user}'s Channel"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("voice_defaultLimit")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="number"
            min={0}
            max={99}
            value={form.default_user_limit ?? 0}
            onChange={(e) => set("default_user_limit", Number(e.target.value))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("voice_defaultBitrate")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={String(form.default_bitrate ?? 64000)}
            onValueChange={(v) => set("default_bitrate", Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BITRATE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("voice_defaultVisibility")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={form.default_visibility ?? "public"}
            onValueChange={(v) => set("default_visibility", v as "public" | "private")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">{t("voice_public")}</SelectItem>
              <SelectItem value="private">{t("voice_private")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Button onClick={() => save(form as VoiceConfig)} disabled={isSaving}>
        {isSaving ? t("saving") : t("save")}
      </Button>
    </div>
  );
}
