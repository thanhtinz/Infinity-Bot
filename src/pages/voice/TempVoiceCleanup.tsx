import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useVoiceConfig } from "@/hooks/useVoiceConfig";
import type { VoiceConfig } from "@/hooks/useVoiceConfig";
import { useT } from "@/i18n";

const FIELDS: { key: keyof VoiceConfig; label: string }[] = [
  { key: "auto_delete_seconds", label: "Delete delay after empty (seconds, 0 = instant)" },
  { key: "inactive_cleanup_minutes", label: "Inactive cleanup timer (minutes, 0 = off)" },
  { key: "max_rooms_per_guild", label: "Max rooms per server (0 = unlimited)" },
  { key: "max_rooms_per_user", label: "Max rooms per user (0 = unlimited)" },
  { key: "rename_cooldown_seconds", label: "Rename cooldown (seconds)" },
];

export function TempVoiceCleanup() {
  const { t } = useT();
  const { config, save, isSaving, isLoading } = useVoiceConfig();
  const [form, setForm] = useState<Partial<VoiceConfig>>({});

  useEffect(() => { setForm(config); }, [config]);

  const set = <K extends keyof VoiceConfig>(key: K, value: VoiceConfig[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-60 w-full" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("voice_cleanup")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("voice_cleanup")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <Input
                type="number"
                min={0}
                value={form[key] as number ?? 0}
                onChange={(e) => set(key, Number(e.target.value))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={() => save(form as VoiceConfig)} disabled={isSaving}>
        {isSaving ? t("saving") : t("save")}
      </Button>
    </div>
  );
}
