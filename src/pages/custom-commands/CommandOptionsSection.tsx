import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import type { CommandForm } from "./ccTypes";

interface CommandOptionsSectionProps {
  form: CommandForm;
  onFormChange: React.Dispatch<React.SetStateAction<CommandForm>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandOptionsSection({ form, onFormChange, open, onOpenChange }: CommandOptionsSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center justify-between w-full">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Options
          </p>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        {/* Delete Command */}
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <Checkbox
            checked={form.delete_trigger}
            onCheckedChange={(v) => onFormChange((p) => ({ ...p, delete_trigger: !!v }))}
          />
          <div className="flex-1 space-y-0.5">
            <Label className="text-sm font-medium">Delete Command</Label>
            <p className="text-[11px] text-muted-foreground">Delete the user's !command message after the bot responds</p>
          </div>
        </div>

        {/* Silent Command */}
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <Checkbox
            checked={form.silent}
            onCheckedChange={(v) => onFormChange((p) => ({ ...p, silent: !!v }))}
          />
          <div className="flex-1 space-y-0.5">
            <Label className="text-sm font-medium">Silent Command</Label>
            <p className="text-[11px] text-muted-foreground">Execute the command silently without sending a response</p>
          </div>
        </div>

        {/* DM Response */}
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <Checkbox
            checked={form.dm_response}
            onCheckedChange={(v) => onFormChange((p) => ({ ...p, dm_response: !!v }))}
          />
          <div className="flex-1 space-y-0.5">
            <Label className="text-sm font-medium">DM Response</Label>
            <p className="text-[11px] text-muted-foreground">Send the response via DM instead of the channel</p>
          </div>
        </div>

        {/* Disable pings */}
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <Checkbox
            checked={form.no_everyone}
            onCheckedChange={(v) => onFormChange((p) => ({ ...p, no_everyone: !!v }))}
          />
          <div className="flex-1 space-y-0.5">
            <Label className="text-sm font-medium">Disable @everyone, @here and role pings</Label>
            <p className="text-[11px] text-muted-foreground">Suppress all pings in the response</p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
