import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { Variable } from "lucide-react";
import type { CommandForm } from "./ccTypes";
import { CommandSettingsAdvanced } from "./CommandSettingsAdvanced";
import { useT } from "@/i18n";

interface CommandSettingsSectionProps {
  form: CommandForm;
  onFormChange: React.Dispatch<React.SetStateAction<CommandForm>>;
  aliasInput: string;
  onAliasesInputChange: (v: string) => void;
  onAliasesKeyDown: (e: React.KeyboardEvent) => void;
  onAddAliases: () => void;
  onRemoveAliases: (alias: string) => void;
  onAddChannel: (chId: string) => void;
  onRemoveChannel: (chId: string) => void;
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
}

export function CommandSettingsSection({
  form,
  onFormChange,
  aliasInput,
  onAliasesInputChange,
  onAliasesKeyDown,
  onAddAliases,
  onRemoveAliases,
  onAddChannel,
  onRemoveChannel,
  advancedOpen,
  onAdvancedOpenChange,
}: CommandSettingsSectionProps) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
        <Variable className="h-3.5 w-3.5" />
        {t("cc_settings")}
      </p>

      {/* Ephemeral toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>{t("cc_hiddenEphemeral")}</Label>
          <p className="text-[11px] text-muted-foreground">
            {t("cc_ephemeralDesc")}
          </p>
        </div>
        <Switch
          checked={form.ephemeral}
          onCheckedChange={(checked) =>
            onFormChange((p) => ({ ...p, ephemeral: checked }))
          }
        />
      </div>

      {/* Enabled toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>{t("cc_activate")}</Label>
          <p className="text-[11px] text-muted-foreground">
            {t("cc_activateDesc")}
          </p>
        </div>
        <Switch
          checked={form.enabled}
          onCheckedChange={(checked) =>
            onFormChange((p) => ({ ...p, enabled: checked }))
          }
        />
      </div>

      {/* Required roles */}
      <div className="space-y-2">
        <Label>{t("cc_requiredRoles")}</Label>
        <MultiRoleSelect
          value={form.required_roles}
          onChange={(roles) =>
            onFormChange((p) => ({ ...p, required_roles: roles }))
          }
          placeholder={t("cc_selectRequiredRole")}
        />
      </div>

      <div className="border-t my-2" />

      {/* ── Advanced settings (collapsible) ── */}
      <CommandSettingsAdvanced
        form={form}
        onFormChange={onFormChange}
        aliasInput={aliasInput}
        onAliasesInputChange={onAliasesInputChange}
        onAliasesKeyDown={onAliasesKeyDown}
        onAddAliases={onAddAliases}
        onRemoveAliases={onRemoveAliases}
        onAddChannel={onAddChannel}
        onRemoveChannel={onRemoveChannel}
        open={advancedOpen}
        onOpenChange={onAdvancedOpenChange}
      />
    </div>
  );
}
