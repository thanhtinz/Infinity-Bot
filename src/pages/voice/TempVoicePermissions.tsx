import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { useVoiceConfig } from "@/hooks/useVoiceConfig";
import type { VoiceConfig } from "@/hooks/useVoiceConfig";
import { VOICE_CONFIG_DEFAULT } from "@/hooks/useVoiceConfig";
import { useGuild } from "@/contexts/GuildContext";
import { useT } from "@/i18n";

const TOGGLES: { key: keyof VoiceConfig; labelKey: string }[] = [
  { key: "allow_rename", labelKey: "voice_allowRename" },
  { key: "allow_limit", labelKey: "voice_allowLimit" },
  { key: "allow_lock", labelKey: "voice_allowLock" },
  { key: "allow_hide", labelKey: "voice_allowHide" },
  { key: "allow_invite", labelKey: "voice_allowInvite" },
  { key: "allow_kick", labelKey: "voice_allowKick" },
  { key: "allow_transfer", labelKey: "voice_allowTransfer" },
  { key: "allow_claim", labelKey: "voice_allowClaim" },
];

const PANEL_BUTTONS: { key: string; label: string; emoji: string }[] = [
  { key: "name",     label: "Name",     emoji: "✏️" },
  { key: "limit",    label: "Limit",    emoji: "👥" },
  { key: "privacy",  label: "Privacy",  emoji: "🔐" },
  { key: "trust",    label: "Trust",    emoji: "✅" },
  { key: "untrust",  label: "Untrust",  emoji: "➖" },
  { key: "invite",   label: "Invite",   emoji: "📨" },
  { key: "kick",     label: "Kick",     emoji: "👢" },
  { key: "region",   label: "Region",   emoji: "🌍" },
  { key: "block",    label: "Block",    emoji: "🚫" },
  { key: "unblock",  label: "Unblock",  emoji: "🔓" },
  { key: "claim",    label: "Claim",    emoji: "🙋" },
  { key: "transfer", label: "Transfer", emoji: "👑" },
  { key: "delete",   label: "Delete",   emoji: "🗑️" },
];

export function TempVoicePermissions() {
  const { t } = useT();
  const { selectedGuildId } = useGuild();
  const guildId = selectedGuildId ?? undefined;
  const { config, save, isSaving, isLoading } = useVoiceConfig();
  const [form, setForm] = useState<Partial<VoiceConfig>>({});

  useEffect(() => { setForm(config); }, [config]);

  const set = <K extends keyof VoiceConfig>(key: K, value: VoiceConfig[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleBtn = (key: string, checked: boolean) =>
    setForm((prev) => {
      const cur = prev.voice_buttons ?? VOICE_CONFIG_DEFAULT.voice_buttons;
      return { ...prev, voice_buttons: checked ? [...new Set([...cur, key])] : cur.filter((k) => k !== key) };
    });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-60 w-full" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("voice_permissions")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("voice_permissions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {TOGGLES.map(({ key, labelKey }) => (
            <div key={key} className="flex items-center justify-between">
              <Label>{t(labelKey as Parameters<typeof t>[0])}</Label>
              <Switch
                checked={form[key] as boolean ?? false}
                onCheckedChange={(v) => set(key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      {/* Panel Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("voice_panelButtons")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PANEL_BUTTONS.map((btn) => {
              const active = (form.voice_buttons ?? VOICE_CONFIG_DEFAULT.voice_buttons).includes(btn.key);
              return (
                <div key={btn.key} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                  <span className="text-sm">{btn.emoji} {btn.label}</span>
                  <Switch checked={active} onCheckedChange={(c) => toggleBtn(btn.key, c)} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("voice_bypassRoles")}</CardTitle>
        </CardHeader>
        <CardContent>
          <MultiRoleSelect
            value={form.bypass_role_ids ?? []}
            onChange={(v) => set("bypass_role_ids", v)}
            guildId={guildId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("voice_blacklistRoles")}</CardTitle>
        </CardHeader>
        <CardContent>
          <MultiRoleSelect
            value={form.blacklist_role_ids ?? []}
            onChange={(v) => set("blacklist_role_ids", v)}
            guildId={guildId}
          />
        </CardContent>
      </Card>

      <Button onClick={() => save(form as VoiceConfig)} disabled={isSaving}>
        {isSaving ? t("saving") : t("save")}
      </Button>
    </div>
  );
}
