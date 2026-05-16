import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { Variable } from "lucide-react";
import type { CommandForm } from "./ccTypes";
import { CommandSettingsAdvanced } from "./CommandSettingsAdvanced";

interface CommandSettingsSectionProps {
  form: CommandForm;
  onFormChange: React.Dispatch<React.SetStateAction<CommandForm>>;
  aliasInput: string;
  onAliasInputChange: (v: string) => void;
  onAliasKeyDown: (e: React.KeyboardEvent) => void;
  onAddAlias: () => void;
  onRemoveAlias: (alias: string) => void;
  onAddChannel: (chId: string) => void;
  onRemoveChannel: (chId: string) => void;
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
}

export function CommandSettingsSection({
  form,
  onFormChange,
  aliasInput,
  onAliasInputChange,
  onAliasKeyDown,
  onAddAlias,
  onRemoveAlias,
  onAddChannel,
  onRemoveChannel,
  advancedOpen,
  onAdvancedOpenChange,
}: CommandSettingsSectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
        <Variable className="h-3.5 w-3.5" />
        Cài đặt
      </p>

      {/* Ephemeral toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Ẩn (Ephemeral)</Label>
          <p className="text-[11px] text-muted-foreground">
            Chỉ người dùng lệnh mới thấy phản hồi.
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
          <Label>Kích hoạt</Label>
          <p className="text-[11px] text-muted-foreground">
            Bật/tắt command này.
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
        <Label>Role yêu cầu</Label>
        <MultiRoleSelect
          value={form.required_roles}
          onChange={(roles) =>
            onFormChange((p) => ({ ...p, required_roles: roles }))
          }
          placeholder="Chọn role yêu cầu..."
        />
      </div>

      <div className="border-t my-2" />

      {/* ── Cài đặt nâng cao (collapsible) ── */}
      <CommandSettingsAdvanced
        form={form}
        onFormChange={onFormChange}
        aliasInput={aliasInput}
        onAliasInputChange={onAliasInputChange}
        onAliasKeyDown={onAliasKeyDown}
        onAddAlias={onAddAlias}
        onRemoveAlias={onRemoveAlias}
        onAddChannel={onAddChannel}
        onRemoveChannel={onRemoveChannel}
        open={advancedOpen}
        onOpenChange={onAdvancedOpenChange}
      />
    </div>
  );
}
