import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Plus, Trash2, GripVertical, Play } from "lucide-react";
import type { CommandAction, ActionType, CommandForm } from "./ccTypes";
import { ACTION_GROUPS } from "./ccConstants";

interface Props {
  form: CommandForm;
  onFormChange: React.Dispatch<React.SetStateAction<CommandForm>>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// Build flat lookup: type → { label, fields }
type FieldMeta = { key: string; label: string; type: string; placeholder?: string; options?: { value: string; label: string }[] };
type ActionMeta = { label: string; fields: FieldMeta[] };
const ACTION_META: Record<string, ActionMeta> = {};
ACTION_GROUPS.forEach((g) =>
  g.actions.forEach((a) => {
    ACTION_META[a.type] = { label: a.label, fields: a.fields };
  })
);

export function ActionsEditor({ form, onFormChange, open, onOpenChange }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState("");

  const actions = form.actions || [];

  const addAction = (type: ActionType) => {
    const meta = ACTION_META[type];
    const config: Record<string, string | number | boolean | string[]> = {};
    (meta?.fields ?? []).forEach((f) => { config[f.key] = ""; });
    onFormChange((p) => ({ ...p, actions: [...(p.actions || []), { type, config }] }));
    setShowMenu(false);
    setSearch("");
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

  const filtered = ACTION_GROUPS.map((g) => ({
    ...g,
    actions: g.actions.filter(
      (a) =>
        !search ||
        a.label.toLowerCase().includes(search.toLowerCase()) ||
        a.type.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((g) => g.actions.length > 0);

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors rounded-lg"
        onClick={() => onOpenChange(!open)}
      >
        <span className="flex items-center gap-2">
          <Play className="h-4 w-4 text-primary" />
          System Actions
          {actions.length > 0 && (
            <span className="ml-1 text-xs font-normal bg-primary/15 text-primary px-2 py-0.5 rounded-full">
              {actions.length}
            </span>
          )}
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
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

          {/* Add button + dropdown */}
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => setShowMenu((s) => !s)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add action
            </Button>

            {showMenu && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-border bg-popover shadow-xl overflow-hidden">
                <div className="p-2 border-b border-border">
                  <Input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search actions..."
                    className="h-8 text-sm"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {filtered.map((g) => (
                    <div key={g.group}>
                      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                        {g.emoji} {g.group}
                      </div>
                      {g.actions.map((a) => (
                        <button
                          key={a.type}
                          type="button"
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted/60 transition-colors text-left"
                          onClick={() => addAction(a.type as ActionType)}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No results found</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single row ────────────────────────────────────────────────────────────────

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
    <div className="rounded-md border border-border bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
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
