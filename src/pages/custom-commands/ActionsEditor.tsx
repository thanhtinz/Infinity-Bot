import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";import { ChevronDown, ChevronRight, Trash2, GripVertical, Play } from "lucide-react";
import type { CommandAction, ActionType, CommandForm } from "./ccTypes";
import { ACTION_GROUPS } from "./ccConstants";

interface Props {
  form: CommandForm;
  onFormChange: React.Dispatch<React.SetStateAction<CommandForm>>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// Flat lookup: type → { label, fields }
type FieldMeta = { key: string; label: string; type: string; placeholder?: string; options?: { value: string; label: string }[] };
type ActionMeta = { label: string; fields: FieldMeta[] };
const ACTION_META: Record<string, ActionMeta> = {};
ACTION_GROUPS.forEach((g) =>
  g.actions.forEach((a) => {
    ACTION_META[a.type] = { label: a.label, fields: a.fields };
  })
);

export function ActionsEditor({ form, onFormChange, open, onOpenChange }: Props) {
  const actions = form.actions || [];

  const addAction = (type: ActionType) => {
    const meta = ACTION_META[type];
    const config: Record<string, string | number | boolean | string[]> = {};
    (meta?.fields ?? []).forEach((f) => { config[f.key] = ""; });
    onFormChange((p) => ({ ...p, actions: [...(p.actions || []), { type, config }] }));
  };

  const removeAction = (idx: number) => {
    onFormChange((p) => ({ ...p, actions: (p.actions || []).filter((_, i) => i !== idx) }));
  };

  const updateConfig = (idx: number, key: string, value: string | number | boolean | string[]) => {
    onFormChange((p) => {
      const acts = [...(p.actions || [])];
      acts[idx] = { ...acts[idx], config: { ...acts[idx].config, [key]: value } };
      return { ...p, actions: acts };
    });
  };

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center justify-between w-full">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Play className="h-3.5 w-3.5" />
            System Actions
            {actions.length > 0 && (
              <span className="ml-1 text-xs font-normal bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                {actions.length}
              </span>
            )}
          </p>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3 pt-3">
        <p className="text-xs text-muted-foreground">
          Actions run <strong>after responses</strong>, in order. Vars like{" "}
          <code className="text-xs bg-muted px-1 rounded">{"{user.mention}"}</code> are supported in config fields.
        </p>

        {/* Action list */}
        {actions.length > 0 && (
          <div className="space-y-2">
            {actions.map((action, idx) => (
              <ActionRow
                key={idx}
                action={action}
                index={idx}
                onUpdateConfig={(k, v) => updateConfig(idx, k, v)}
                onRemove={() => removeAction(idx)}
              />
            ))}
          </div>
        )}

        {/* Add via Select */}
        <Select
          value=""
          onValueChange={(v) => { if (v) addAction(v as ActionType); }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Add action..." />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {ACTION_GROUPS.map((g) => (
              <SelectGroup key={g.group}>
                <SelectLabel className="flex items-center gap-1.5 bg-muted/60 text-foreground text-xs uppercase tracking-wider font-semibold px-3 py-1.5 mt-1 first:mt-0">
                  <g.icon className="h-3 w-3" />
                  {g.group}
                </SelectLabel>
                {g.actions.map((a) => (
                  <SelectItem key={a.type} value={a.type}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Single action row ─────────────────────────────────────────────────────────

interface RowProps {
  action: CommandAction;
  index: number;
  onUpdateConfig: (key: string, value: string | number | boolean | string[]) => void;
  onRemove: () => void;
}

function ActionRow({ action, index, onUpdateConfig, onRemove }: RowProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = ACTION_META[action.type];
  const hasFields = (meta?.fields ?? []).length > 0;

  return (
    <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
        <span className="text-xs text-muted-foreground font-mono w-4 text-center flex-shrink-0">
          {index + 1}
        </span>
        <span className="flex-1 text-sm font-medium truncate">{meta?.label ?? action.type}</span>
        {hasFields && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {hasFields && expanded && (
        <div className="px-3 pb-3 pt-2 space-y-2 border-t border-border">
          {meta.fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              <Input
                value={String(action.config[f.key] ?? "")}
                onChange={(e) => onUpdateConfig(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
