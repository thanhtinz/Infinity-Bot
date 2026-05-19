import { Button } from "@/components/ui/button";
import { EmojiInput, EmojiTextarea } from "@/components/EmojiInput";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Plus, X, ChevronDown, ChevronRight, ListPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { emptyEmbed } from "./ccConstants";
import type { CommandForm } from "./ccTypes";
import { useT } from "@/i18n";

interface CommandAdditionalResponsesProps {
  form: CommandForm;
  onFormChange: React.Dispatch<React.SetStateAction<CommandForm>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandAdditionalResponses({ form, onFormChange, open, onOpenChange }: CommandAdditionalResponsesProps) {
  const { t } = useT();
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center justify-between w-full">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <ListPlus className="h-3.5 w-3.5" />
            {t("cc_additionalResponses")}
          </p>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="space-y-4">

          {form.additional_responses.length > 0 && (
            <div className="space-y-3">
              {form.additional_responses.map((resp, idx) => (
                <div key={idx} className="rounded-lg border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onFormChange((p) => ({
                          ...p,
                          additional_responses: p.additional_responses.map((r, i) =>
                            i === idx ? { ...r, type: "text" } : r
                          ),
                        }))}
                        className={cn(
                          "rounded px-2 py-0.5 text-xs border transition-colors",
                          resp.type === "text" ? "bg-foreground text-background border-foreground" : "border-input hover:bg-muted"
                        )}
                      >
                        Text
                      </button>
                      <button
                        type="button"
                        onClick={() => onFormChange((p) => ({
                          ...p,
                          additional_responses: p.additional_responses.map((r, i) =>
                            i === idx ? { ...r, type: "embed" } : r
                          ),
                        }))}
                        className={cn(
                          "rounded px-2 py-0.5 text-xs border transition-colors",
                          resp.type === "embed" ? "bg-foreground text-background border-foreground" : "border-input hover:bg-muted"
                        )}
                      >
                        Embed
                      </button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => onFormChange((p) => ({
                        ...p,
                        additional_responses: p.additional_responses.filter((_, i) => i !== idx),
                      }))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {resp.type === "text" ? (
                    <EmojiTextarea
                      value={resp.content ?? ""}
                      onChange={(e) => onFormChange((p) => ({
                        ...p,
                        additional_responses: p.additional_responses.map((r, i) =>
                          i === idx ? { ...r, content: e.target.value } : r
                        ),
                      }))}
                      placeholder="Additional response content..."
                      rows={3}
                    />
                  ) : (
                    <div className="space-y-2">
                      <EmojiInput
                        value={resp.embed?.title ?? ""}
                        onChange={(e) => onFormChange((p) => ({
                          ...p,
                          additional_responses: p.additional_responses.map((r, i) =>
                            i === idx ? { ...r, embed: { ...emptyEmbed(), ...r.embed, title: e.target.value } } : r
                          ),
                        }))}
                        placeholder="Title embed"
                      />
                      <EmojiTextarea
                        value={resp.embed?.description ?? ""}
                        onChange={(e) => onFormChange((p) => ({
                          ...p,
                          additional_responses: p.additional_responses.map((r, i) =>
                            i === idx ? { ...r, embed: { ...emptyEmbed(), ...r.embed, description: e.target.value } } : r
                          ),
                        }))}
                        placeholder="Description embed"
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onFormChange((p) => ({
                ...p,
                additional_responses: [...p.additional_responses, { type: "text", content: "" }],
              }))}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Response
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onFormChange((p) => ({
                ...p,
                additional_responses: [...p.additional_responses, { type: "embed", embed: emptyEmbed() }],
              }))}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Embed Response
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
