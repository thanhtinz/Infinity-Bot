import { useState, useEffect } from "react";
import { useT } from "@/i18n";
import type { ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleSelect, MultiRoleSelect } from "@/components/RoleSelect";
import { ChannelSelect, MultiChannelSelect } from "@/components/ChannelSelect";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import { Save } from "lucide-react";
import type { ModerationConfig } from "./shared";

export function ModerationSettings() {
  const { t } = useT();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [configForm, setConfigForm] = useState<ModerationConfig>({
    mute_role_id: "",
    mod_log_channel_id: "",
    lockdown_channels: "",
    ignored_users: "",
    ignored_roles: "",
    ignored_channels: "",
    dm_on_action: false,
    show_mod_in_dm: false,
    auto_dehoist: false,
  });

  // ── Queries ──

  const { data: config } = useQuery<ModerationConfig>({
    queryKey: ["moderation-config"],
    queryFn: () => apiFetch("/api/moderation/config").then((r) => r.json()),
  });

  // Sync config form when config loads
  useEffect(() => {
    if (config) {
      const toStr = (v: unknown) =>
        Array.isArray(v) ? v.join(",") : (v == null ? "" : String(v));
      setConfigForm({
        ...config,
        lockdown_channels: toStr(config.lockdown_channels),
        ignored_users: toStr(config.ignored_users),
        ignored_roles: toStr(config.ignored_roles),
        ignored_channels: toStr(config.ignored_channels),
      });
    }
  }, [config]);

  // ── Mutations ──

  const saveConfigMutation = useMutation({
    mutationFn: (body: ModerationConfig) =>
      apiFetch("/api/moderation/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Save config failed");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-config"] });
      toast({ title: t("toast_saved") });
    },
    onError: () =>
      toast({ title: t("toast_error"), variant: "destructive" }),
  });

  // ── Config helpers ──

  function updateConfig(key: keyof ModerationConfig, value: string | boolean) {
    setConfigForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleConfigInput(key: keyof ModerationConfig, e: ChangeEvent<HTMLInputElement>) {
    updateConfig(key, e.target.value);
  }

  return (
    <div className="space-y-6">
      {/* ── Settings form ── */}
      <Card>
        <CardContent className="p-4 space-y-6">
          {/* ID fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("mod_muteRoleId")}</Label>
              <RoleSelect
                value={configForm.mute_role_id ?? ""}
                onChange={(val) => updateConfig("mute_role_id", val)}
                placeholder={t("mod_roleId")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("mod_modLogChannelId")}</Label>
              <ChannelSelect
                value={configForm.mod_log_channel_id ?? ""}
                onChange={(val) => updateConfig("mod_log_channel_id", val)}
                placeholder={t("mod_channelId")}
                filter="text"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("mod_lockdownChannels")}</Label>
            <MultiChannelSelect
              value={(configForm.lockdown_channels ?? "").split(",").filter(Boolean)}
              onChange={(vals) => updateConfig("lockdown_channels", vals.join(","))}
              placeholder={t("mod_commaSeparatedChannelIds")}
              filter="text"
            />
            <p className="text-[11px] text-muted-foreground">
              {t("mod_channelIdsComma")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t("mod_ignoredUsers")}</Label>
              <Input
                placeholder={t("mod_commaSeparatedUserIds")}
                value={configForm.ignored_users}
                onChange={(e) => handleConfigInput("ignored_users", e)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("mod_ignoredRolesLabel")}</Label>
              <MultiRoleSelect
                value={(configForm.ignored_roles ?? "").split(",").filter(Boolean)}
                onChange={(vals) => updateConfig("ignored_roles", vals.join(","))}
                placeholder={t("mod_commaSeparatedRoleIds")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("mod_ignoredChannelsLabel")}</Label>
              <MultiChannelSelect
                value={(configForm.ignored_channels ?? "").split(",").filter(Boolean)}
                onChange={(vals) => updateConfig("ignored_channels", vals.join(","))}
                placeholder={t("mod_commaSeparatedChannelIds")}
                filter="text"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t("mod_dmOnAction")}</Label>
                <p className="text-[11px] text-muted-foreground">
                  {t("mod_dmOnActionDesc")}
                </p>
              </div>
              <Switch
                checked={configForm.dm_on_action}
                onCheckedChange={(v) => updateConfig("dm_on_action", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t("mod_showModerator")}</Label>
                <p className="text-[11px] text-muted-foreground">
                  {t("mod_suppressEmbeds")}
                </p>
              </div>
              <Switch
                checked={configForm.show_mod_in_dm}
                onCheckedChange={(v) => updateConfig("show_mod_in_dm", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t("mod_autoDehoist")}</Label>
                <p className="text-[11px] text-muted-foreground">
                  {t("mod_suppressPings")}
                </p>
              </div>
              <Switch
                checked={configForm.auto_dehoist}
                onCheckedChange={(v) => updateConfig("auto_dehoist", v)}
              />
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button
              disabled={saveConfigMutation.isPending}
              onClick={() => saveConfigMutation.mutate(configForm)}
            >
              <Save className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{saveConfigMutation.isPending ? t("saving") : t("save")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
