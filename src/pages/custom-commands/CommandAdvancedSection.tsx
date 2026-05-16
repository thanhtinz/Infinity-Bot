import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import type { CommandForm } from "./ccTypes";

interface CommandAdvancedSectionProps {
  form: CommandForm;
  onFormChange: React.Dispatch<React.SetStateAction<CommandForm>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandAdvancedSection({ form, onFormChange, open, onOpenChange }: CommandAdvancedSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center justify-between w-full">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Advanced Options (optional)
          </p>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              Cooldown (seconds)
            </Label>
            <Input
              type="number"
              min={0}
              value={form.cooldown}
              onChange={(e) => onFormChange((p) => ({ ...p, cooldown: Math.max(0, parseInt(e.target.value) || 0) }))}
              placeholder="2"
            />
          </div>
          <div className="space-y-2">
            <Label>Delete After (seconds)</Label>
            <Input
              type="number"
              min={0}
              value={form.delete_after}
              onChange={(e) => onFormChange((p) => ({ ...p, delete_after: Math.max(0, parseInt(e.target.value) || 0) }))}
              placeholder="10"
            />
            <p className="text-[11px] text-muted-foreground">0 = no auto delete</p>
          </div>
          <div className="space-y-2">
            <Label>Required Arguments</Label>
            <Input
              type="number"
              min={0}
              value={form.required_args}
              onChange={(e) => onFormChange((p) => ({ ...p, required_args: Math.max(0, parseInt(e.target.value) || 0) }))}
              placeholder="1"
            />
            <p className="text-[11px] text-muted-foreground">Min $N count</p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
