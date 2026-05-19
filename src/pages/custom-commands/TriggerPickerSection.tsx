import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Zap } from "lucide-react";
import type { CommandForm, TriggerType, TriggerConfigField } from "./ccTypes";
import { TRIGGER_GROUPS, TRIGGER_BY_TYPE } from "./ccConstants";

interface Props {
  form: CommandForm;
  onFormChange: React.Dispatch<React.SetStateAction<CommandForm>>;
}

export function TriggerPickerSection({ form, onFormChange }: Props) {
  const [open, setOpen] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");

  const selected = TRIGGER_BY_TYPE[form.event_trigger];

  const filtered = TRIGGER_GROUPS.map((g) => ({
    ...g,
    triggers: g.triggers.filter(
      (t) =>
        t.label.toLowerCase().includes(search.toLowerCase()) ||
        t.type.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((g) => g.triggers.length > 0);

  const selectTrigger = (type: TriggerType) => {
    onFormChange((p) => ({
      ...p,
      event_trigger: type,
      trigger_config: {},
    }));
    setShowPicker(false);
    setSearch("");
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors rounded-lg"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Trigger
          {selected && (
            <span className="ml-2 text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {selected.icon} {selected.label}
            </span>
          )}
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {/* Current trigger display */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Loại trigger</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 text-sm">
                {selected ? (
                  <>
                    <span>{selected.icon}</span>
                    <span className="font-medium">{selected.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto font-mono">{form.event_trigger}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Chọn trigger...</span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPicker((s) => !s)}
              >
                Thay đổi
              </Button>
            </div>
          </div>

          {/* Picker dropdown */}
          {showPicker && (
            <div className="rounded-md border border-border bg-popover shadow-lg overflow-hidden">
              <div className="p-2 border-b border-border">
                <Input
                  placeholder="Tìm trigger..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
              <div className="max-h-72 overflow-y-auto">
                {filtered.map((g) => (
                  <div key={g.group}>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0 flex items-center gap-1">
                      <g.icon className="h-3 w-3" /> {g.group}
                    </div>
                    {g.triggers.map((t) => (
                      <button
                        key={t.type}
                        type="button"
                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted/60 transition-colors text-left ${
                          form.event_trigger === t.type ? "bg-primary/10 text-primary font-medium" : ""
                        }`}
                        onClick={() => selectTrigger(t.type as TriggerType)}
                      >
                        <span className="w-5 text-center">{t.icon}</span>
                        <span className="flex-1">{t.label}</span>
                        {t.hasConfig && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 rounded">config</span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Không tìm thấy trigger</p>
                )}
              </div>
            </div>
          )}

          {/* Trigger config fields */}
          {selected?.hasConfig && selected.configFields && (
            <TriggerConfigFields
              configFields={selected.configFields}
              triggerConfig={form.trigger_config}
              onChange={(cfg) => onFormChange((p) => ({ ...p, trigger_config: cfg }))}
            />
          )}

          {/* Name field hint for non-prefix triggers */}
          {form.event_trigger !== "prefix_command" && (
            <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
              💡 Tên lệnh dùng để phân biệt các custom command — không phải trigger key.
              Nhiều lệnh có thể dùng cùng một loại trigger.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Trigger config sub-form ───────────────────────────────────────────────────

interface ConfigFieldsProps {
  configFields: TriggerConfigField[];
  triggerConfig: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
}

function TriggerConfigFields({ configFields, triggerConfig, onChange }: ConfigFieldsProps) {
  const set = (key: string, value: unknown) => onChange({ ...triggerConfig, [key]: value });

  return (
    <div className="space-y-3 rounded-md bg-muted/30 p-3 border border-border">
      <p className="text-xs font-medium text-muted-foreground">Cấu hình trigger</p>
      {configFields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label className="text-xs">{f.label}</Label>
          {f.type === "select" ? (
            <Select
              value={String(triggerConfig[f.key] ?? "")}
              onValueChange={(v) => set(f.key, v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {f.options?.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={String(triggerConfig[f.key] ?? "")}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="h-8 text-sm"
            />
          )}
        </div>
      ))}
    </div>
  );
}
