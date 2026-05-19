import { Label } from "@/components/ui/label";
import { EmojiTextarea } from "@/components/EmojiInput";
import { ChevronDown, ChevronRight, Type, Layout, Variable } from "lucide-react";
import { cn } from "@/lib/utils";
import { VARIABLE_GROUPS } from "./ccConstants";
import type { CommandForm, EmbedField } from "./ccTypes";
import { EmbedResponseEditor } from "./EmbedResponseEditor";
import { useT } from "@/i18n";

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
  const { t } = useT();
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
        <Layout className="h-3.5 w-3.5" />
        {t("cc_response")}
      </p>

      {/* Response type toggle */}
      <div className="space-y-2">
        <Label>{t("cc_responseType")}</Label>
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
            {t("cc_text")}
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
            {t("cc_embed")}
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
            {t("cc_availableVariables")}
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
              {t("cc_clickVariableHint")}
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
          <Label>{t("cc_content")}</Label>
          <EmojiTextarea
            value={form.response_text}
            onChange={(e) =>
              onFormChange((p) => ({ ...p, response_text: e.target.value }))
            }
            placeholder={t("cc_responseContentPlaceholder")}
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
