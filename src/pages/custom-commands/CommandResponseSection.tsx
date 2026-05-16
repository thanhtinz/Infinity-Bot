import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight, Type, Layout, Variable } from "lucide-react";
import { cn } from "@/lib/utils";
import { VARIABLE_GROUPS } from "./ccConstants";
import type { CommandForm, EmbedField } from "./ccTypes";
import { EmbedResponseEditor } from "./EmbedResponseEditor";

interface CommandResponseSectionProps {
  form: CommandForm;
  onFormChange: React.Dispatch<React.SetStateAction<CommandForm>>;
  varsOpen: boolean;
  onToggleVars: () => void;
  onInsertVariable: (key: string) => void;
  onAddField: () => void;
  onRemoveField: (idx: number) => void;
  onUpdateField: (idx: number, patch: Partial<EmbedField>) => void;
  onFocusEmbedDesc: () => void;
}

export function CommandResponseSection({
  form,
  onFormChange,
  varsOpen,
  onToggleVars,
  onInsertVariable,
  onAddField,
  onRemoveField,
  onUpdateField,
  onFocusEmbedDesc,
}: CommandResponseSectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
        <Layout className="h-3.5 w-3.5" />
        Phản hồi
      </p>

      {/* Response type toggle */}
      <div className="space-y-2">
        <Label>Loại phản hồi</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              onFormChange((p) => ({ ...p, response_type: "text" }))
            }
            className={cn(
              "flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 transition-all text-sm",
              form.response_type === "text"
                ? "border-foreground bg-foreground/5"
                : "border-transparent bg-muted/30 hover:bg-muted/50"
            )}
          >
            <Type className="h-4 w-4" />
            Văn bản
          </button>
          <button
            type="button"
            onClick={() =>
              onFormChange((p) => ({ ...p, response_type: "embed" }))
            }
            className={cn(
              "flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 transition-all text-sm",
              form.response_type === "embed"
                ? "border-foreground bg-foreground/5"
                : "border-transparent bg-muted/30 hover:bg-muted/50"
            )}
          >
            <Layout className="h-4 w-4" />
            Embed
          </button>
        </div>
      </div>

      {/* Variables Reference Panel */}
      <div className="rounded-lg border bg-muted/20">
        <button
          type="button"
          onClick={onToggleVars}
          className="flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium hover:bg-muted/30 transition-colors rounded-lg"
        >
          <span className="flex items-center gap-2">
            <Variable className="h-4 w-4 text-indigo-500" />
            Biến số (Variables)
          </span>
          {varsOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {varsOpen && (
          <div className="px-3 pb-3 space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Nhấn vào biến để chèn vào nội dung. Click vào ô văn bản trước để chọn vị trí chèn.
            </p>
            {VARIABLE_GROUPS.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.label} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Icon className="h-3 w-3" />
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {group.vars.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => onInsertVariable(v.key)}
                        className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-[11px] font-mono hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer"
                        title={v.desc}
                      >
                        {v.key}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Text response */}
      {form.response_type === "text" && (
        <div className="space-y-2">
          <Label>Nội dung</Label>
          <Textarea
            value={form.response_text}
            onChange={(e) =>
              onFormChange((p) => ({ ...p, response_text: e.target.value }))
            }
            placeholder="Nội dung bot sẽ gửi khi dùng lệnh..."
            rows={5}
          />
        </div>
      )}

      {/* Embed response */}
      {form.response_type === "embed" && (
        <EmbedResponseEditor
          form={form}
          onFormChange={onFormChange}
          onAddField={onAddField}
          onRemoveField={onRemoveField}
          onUpdateField={onUpdateField}
          onFocusDescription={onFocusEmbedDesc}
        />
      )}
    </div>
  );
}
