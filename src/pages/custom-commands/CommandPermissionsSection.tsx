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
              placeholder="Allowed roles (leave empty = all)..."
            />
          </div>

          {/* Ignored Roles */}
          <div className="space-y-2">
            <Label>Ignored Roles</Label>
            <MultiRoleSelect
              value={form.ignored_roles}
              onChange={(roles) => onFormChange((p) => ({ ...p, ignored_roles: roles }))}
              placeholder="Blocked roles..."
            />
          </div>

          {/* Allowed Channels */}
          <div className="space-y-2">
            <Label>Allowed Channels</Label>
            <MultiChannelSelect
              value={form.allowed_channels}
              onChange={(chs) => onFormChange((p) => ({ ...p, allowed_channels: chs }))}
              placeholder="Allowed channels (leave empty = all)..."
            />
          </div>

          {/* Ignored Channels */}
          <div className="space-y-2">
            <Label>Ignored Channels</Label>
            <MultiChannelSelect
              value={form.ignored_channels}
              onChange={(chs) => onFormChange((p) => ({ ...p, ignored_channels: chs }))}
              placeholder="Blocked channels..."
            />
          </div>

          {/* Response Channel */}
          <div className="space-y-2">
            <Label>Response Channel</Label>
            <ChannelSelect
              filter="text"
              value={form.response_channel_id}
              onChange={(chId) => onFormChange((p) => ({ ...p, response_channel_id: chId }))}
              placeholder="Override response channel..."
            />
            <p className="text-[11px] text-muted-foreground">Leave empty = respond in the channel the user called the command</p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
