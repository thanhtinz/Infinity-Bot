import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { ChannelSelect, MultiChannelSelect } from "@/components/ChannelSelect";
import { ChevronDown, ChevronRight, Shield } from "lucide-react";
import type { CommandForm } from "./ccTypes";
import { useT } from "@/i18n";

interface CommandPermissionsSectionProps {
  form: CommandForm;
  onFormChange: React.Dispatch<React.SetStateAction<CommandForm>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPermissionsSection({ form, onFormChange, open, onOpenChange }: CommandPermissionsSectionProps) {
  const { t } = useT();
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center justify-between w-full">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            {t("cc_permissions")}
          </p>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="grid grid-cols-1 gap-4">
          {/* Allowed Roles */}
          <div className="space-y-2">
            <Label>{t("cc_allowedRoles")}</Label>
            <MultiRoleSelect
              value={form.allowed_roles}
              onChange={(roles) => onFormChange((p) => ({ ...p, allowed_roles: roles }))}
              placeholder={t("cc_allowedRolesPlaceholder")}
            />
          </div>

          {/* Ignored Roles */}
          <div className="space-y-2">
            <Label>{t("cc_ignoredRoles")}</Label>
            <MultiRoleSelect
              value={form.ignored_roles}
              onChange={(roles) => onFormChange((p) => ({ ...p, ignored_roles: roles }))}
              placeholder={t("cc_ignoredRolesPlaceholder")}
            />
          </div>

          {/* Allowed Channels */}
          <div className="space-y-2">
            <Label>{t("cc_allowedChannels")}</Label>
            <MultiChannelSelect
              value={form.allowed_channels}
              onChange={(chs) => onFormChange((p) => ({ ...p, allowed_channels: chs }))}
              placeholder={t("cc_allowedChannelsPlaceholder")}
            />
          </div>

          {/* Ignored Channels */}
          <div className="space-y-2">
            <Label>{t("cc_ignoredChannels")}</Label>
            <MultiChannelSelect
              value={form.ignored_channels}
              onChange={(chs) => onFormChange((p) => ({ ...p, ignored_channels: chs }))}
              placeholder={t("cc_ignoredChannelsPlaceholder")}
            />
          </div>

          {/* Response Channel */}
          <div className="space-y-2">
            <Label>{t("cc_responseChannel")}</Label>
            <ChannelSelect
              filter="text"
              value={form.response_channel_id}
              onChange={(chId) => onFormChange((p) => ({ ...p, response_channel_id: chId }))}
              placeholder={t("cc_overrideChannel")}
            />
            <p className="text-[11px] text-muted-foreground">{t("cc_responseChannelHint")}</p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
