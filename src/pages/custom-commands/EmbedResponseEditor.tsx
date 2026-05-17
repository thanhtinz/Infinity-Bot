import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRESET_COLORS } from "./ccConstants";
import type { CommandForm, EmbedField } from "./ccTypes";
import { useT } from "@/i18n";

interface EmbedResponseEditorProps {
  form: CommandForm;
  onFormChange: React.Dispatch<React.SetStateAction<CommandForm>>;
  onAddField: () => void;
  onRemoveField: (idx: number) => void;
  onUpdateField: (idx: number, patch: Partial<EmbedField>) => void;
  onFocusDescription: () => void;
}

export function EmbedResponseEditor({
  form,
  onFormChange,
  onAddField,
  onRemoveField,
  onUpdateField,
  onFocusDescription,
}: EmbedResponseEditorProps) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("cc_titleEmbed")}</Label>
        <Input
          value={form.response_embed.title}
          onChange={(e) =>
            onFormChange((p) => ({
              ...p,
              response_embed: {
                ...p.response_embed,
                title: e.target.value,
              },
            }))
          }
          placeholder={t("cc_titleEmbedPlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("description")}</Label>
        <Textarea
          value={form.response_embed.description}
          onChange={(e) =>
            onFormChange((p) => ({
              ...p,
              response_embed: {
                ...p.response_embed,
                description: e.target.value,
              },
            }))
          }
          onFocus={onFocusDescription}
          placeholder={t("cc_contentEmbedPlaceholder")}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("cc_color")}</Label>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() =>
                  onFormChange((p) => ({
                    ...p,
                    response_embed: { ...p.response_embed, color: c },
                  }))
                }
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition-all",
                  form.response_embed.color === c
                    ? "border-foreground scale-110"
                    : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <Input
            type="color"
            value={form.response_embed.color}
            onChange={(e) =>
              onFormChange((p) => ({
                ...p,
                response_embed: {
                  ...p.response_embed,
                  color: e.target.value,
                },
              }))
            }
            className="h-7 w-10 p-0 border-0 cursor-pointer"
          />
        </div>
      </div>

      <Separator />

      {/* Embed extras: Author, Footer, Thumbnail, Image */}
      <div className="space-y-3">
        <p className="text-sm font-medium">{t("cc_additionalOptions")}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("cc_author")}</Label>
            <Input
              value={form.response_embed.author}
              onChange={(e) =>
                onFormChange((p) => ({
                  ...p,
                  response_embed: {
                    ...p.response_embed,
                    author: e.target.value,
                  },
                }))
              }
              placeholder={t("cc_authorNamePlaceholder")}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("cc_footer")}</Label>
            <Input
              value={form.response_embed.footer}
              onChange={(e) =>
                onFormChange((p) => ({
                  ...p,
                  response_embed: {
                    ...p.response_embed,
                    footer: e.target.value,
                  },
                }))
              }
              placeholder={t("cc_footer")}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("cc_thumbnailUrl")}</Label>
            <Input
              value={form.response_embed.thumbnail_url}
              onChange={(e) =>
                onFormChange((p) => ({
                  ...p,
                  response_embed: {
                    ...p.response_embed,
                    thumbnail_url: e.target.value,
                  },
                }))
              }
              placeholder="https://..."
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("cc_imageUrl")}</Label>
            <Input
              value={form.response_embed.image_url}
              onChange={(e) =>
                onFormChange((p) => ({
                  ...p,
                  response_embed: {
                    ...p.response_embed,
                    image_url: e.target.value,
                  },
                }))
              }
              placeholder="https://..."
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Fields builder */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{t("cc_fields")}</p>
          <Button variant="outline" size="sm" onClick={onAddField}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("cc_addField")}
          </Button>
        </div>

        {form.response_embed.fields.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t("cc_noFieldsYet")}
          </p>
        )}

        <div className="space-y-3">
          {form.response_embed.fields.map((field, idx) => (
            <div
              key={idx}
              className="rounded-lg border bg-muted/30 p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("cc_field")} #{idx + 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => onRemoveField(idx)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("name")}</Label>
                  <Input
                    value={field.name}
                    onChange={(e) =>
                      onUpdateField(idx, { name: e.target.value })
                    }
                    placeholder={t("cc_nameFieldPlaceholder")}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("cc_value")}</Label>
                  <Input
                    value={field.value}
                    onChange={(e) =>
                      onUpdateField(idx, { value: e.target.value })
                    }
                    placeholder={t("cc_contentPlaceholder")}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={field.inline}
                  onCheckedChange={(checked) =>
                    onUpdateField(idx, { inline: checked })
                  }
                  className="scale-75"
                />
                <Label className="text-xs">{t("cc_inline")}</Label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
