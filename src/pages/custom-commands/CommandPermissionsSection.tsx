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

interface CommandPermissionsSectionProps {
  form: CommandForm;
  onFormChange: React.Dispatch<React.SetStateAction<CommandForm>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPermissionsSection({ form, onFormChange, open, onOpenChange }: CommandPermissionsSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center justify-between w-full">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Permissions
          </p>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="grid grid-cols-1 gap-4">
          {/* Allowed Roles */}
          <div className="space-y-2">
            <Label>Allowed Roles</Label>
            <MultiRoleSelect
              value={form.allowed_roles}
              onChange={(roles) => onFormChange((p) => ({ ...p, allowed_roles: roles }))}
              placeholder="Roles được phép dùng (để trống = tất cả)..."
            />
          </div>

          {/* Ignored Roles */}
          <div className="space-y-2">
            <Label>Ignored Roles</Label>
            <MultiRoleSelect
              value={form.ignored_roles}
              onChange={(roles) => onFormChange((p) => ({ ...p, ignored_roles: roles }))}
              placeholder="Roles bị chặn..."
            />
          </div>

          {/* Allowed Channels */}
          <div className="space-y-2">
            <Label>Allowed Channels</Label>
            <MultiChannelSelect
              value={form.allowed_channels}
              onChange={(chs) => onFormChange((p) => ({ ...p, allowed_channels: chs }))}
              placeholder="Channels được phép (để trống = tất cả)..."
            />
          </div>

          {/* Ignored Channels */}
          <div className="space-y-2">
            <Label>Ignored Channels</Label>
            <MultiChannelSelect
              value={form.ignored_channels}
              onChange={(chs) => onFormChange((p) => ({ ...p, ignored_channels: chs }))}
              placeholder="Channels bị chặn..."
            />
          </div>

          {/* Response Channel */}
          <div className="space-y-2">
            <Label>Response Channel</Label>
            <ChannelSelect
              filter="text"
              value={form.response_channel_id}
              onChange={(chId) => onFormChange((p) => ({ ...p, response_channel_id: chId }))}
              placeholder="Override kênh bot phản hồi..."
            />
            <p className="text-[11px] text-muted-foreground">Để trống = phản hồi trong kênh user gọi lệnh</p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
