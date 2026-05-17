import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  Type,
  User,
  ImageIcon,
  Footprints,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

import type { EmbedField, EmbedData } from "./smTypes";
import { PRESET_COLORS, DEFAULT_COLOR } from "./smConstants";
import { DiscordEmbedPreview } from "./EmbedPreview";

interface EmbedEditorSectionProps {
  embedData: EmbedData;
  setForm: React.Dispatch<React.SetStateAction<{
    channel_id: string;
    content: string;
    add_embed: boolean;
    embed_data: EmbedData;
    send_at: string;
    repeat_type: "none" | "hourly" | "daily" | "weekly" | "monthly";
    enabled: boolean;
  }>>;
  embedBodyOpen: boolean;
  setEmbedBodyOpen: React.Dispatch<React.SetStateAction<boolean>>;
  embedAuthorOpen: boolean;
  setEmbedAuthorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  embedFieldsOpen: boolean;
  setEmbedFieldsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  embedImagesOpen: boolean;
  setEmbedImagesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  embedFooterOpen: boolean;
  setEmbedFooterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  embedPreviewOpen: boolean;
  setEmbedPreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  addEmbedField: () => void;
  removeEmbedField: (idx: number) => void;
  updateEmbedField: (idx: number, patch: Partial<EmbedField>) => void;
}

export function EmbedEditorSection({
  embedData,
  setForm,
  embedBodyOpen,
  setEmbedBodyOpen,
  embedAuthorOpen,
  setEmbedAuthorOpen,
  embedFieldsOpen,
  setEmbedFieldsOpen,
  embedImagesOpen,
  setEmbedImagesOpen,
  embedFooterOpen,
  setEmbedFooterOpen,
  embedPreviewOpen,
  setEmbedPreviewOpen,
  addEmbedField,
  removeEmbedField,
  updateEmbedField,
}: EmbedEditorSectionProps) {
  const { t } = useT();
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
        <Type className="h-3.5 w-3.5" />
        🎨 {t("scheduler_configEmbed")}
      </p>

      {/* ── Embed Preview — collapsible ── */}
      <div className="rounded-lg border">
        <button
          type="button"
          className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
          onClick={() => setEmbedPreviewOpen(!embedPreviewOpen)}
        >
          <span className="flex items-center gap-2">
            <ChevronDown className={cn("h-4 w-4 transition-transform", embedPreviewOpen && "rotate-180")} />
            {t("scheduler_preview")}
          </span>
        </button>
        {embedPreviewOpen && (
          <div className="px-4 pb-4">
            <DiscordEmbedPreview data={embedData} />
          </div>
        )}
      </div>

      {/* ── Body — collapsible with colored left border ── */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{
          borderLeftWidth: 4,
          borderLeftColor: embedData.color || DEFAULT_COLOR,
        }}
      >
        <button
          type="button"
          className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
          onClick={() => setEmbedBodyOpen(!embedBodyOpen)}
        >
          <span className="flex items-center gap-2">
            <ChevronDown className={cn("h-4 w-4 transition-transform", embedBodyOpen && "rotate-180")} />
            <Type className="h-3.5 w-3.5 text-muted-foreground" />
            {t("scheduler_mainContent")}
            {embedData.title && (
              <span className="text-xs font-normal text-muted-foreground truncate max-w-[200px]">
                — {embedData.title}
              </span>
            )}
          </span>
        </button>
        {embedBodyOpen && (
          <div className="px-4 pb-4 space-y-4">
            {/* Title */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("scheduler_titleLabel")}</Label>
              <Input
                value={embedData.title}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    embed_data: { ...f.embed_data, title: e.target.value },
                  }))
                }
                placeholder={t("scheduler_titlePlaceholder")}
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t("scheduler_descLabel")}</Label>
                <span className="text-[11px] text-muted-foreground">
                  {embedData.description.length}/4096
                </span>
              </div>
              <Textarea
                value={embedData.description}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    embed_data: {
                      ...f.embed_data,
                      description: e.target.value,
                    },
                  }))
                }
                placeholder={t("scheduler_descPlaceholder")}
                rows={4}
              />
            </div>

            {/* Color */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("scheduler_colors")}</Label>
              <div className="flex items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        embed_data: { ...f.embed_data, color: c },
                      }))
                    }
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-all",
                      embedData.color?.toLowerCase() === c.toLowerCase()
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Select color ${c}`}
                  />
                ))}
                <div className="flex items-center gap-1.5 ml-1">
                  <Input
                    type="color"
                    value={embedData.color || DEFAULT_COLOR}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        embed_data: { ...f.embed_data, color: e.target.value },
                      }))
                    }
                    className="h-7 w-9 p-0 border-0 cursor-pointer rounded"
                  />
                  <Input
                    value={embedData.color || DEFAULT_COLOR}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        embed_data: { ...f.embed_data, color: e.target.value },
                      }))
                    }
                    className="w-24 font-mono text-xs h-7"
                    maxLength={7}
                    placeholder="#5865F2"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Author — collapsible ── */}
      <div className="rounded-lg border">
        <button
          type="button"
          className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
          onClick={() => setEmbedAuthorOpen(!embedAuthorOpen)}
        >
          <span className="flex items-center gap-2">
            <ChevronDown className={cn("h-4 w-4 transition-transform", embedAuthorOpen && "rotate-180")} />
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            {t("scheduler_authorSection")}
          </span>
          {embedData.author_name && !embedAuthorOpen && (
            <span className="text-xs font-normal text-muted-foreground truncate max-w-[200px]">
              {embedData.author_name}
            </span>
          )}
        </button>
        {embedAuthorOpen && (
          <div className="px-4 pb-4 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("scheduler_authorName")}</Label>
              <Input
                value={embedData.author_name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    embed_data: { ...f.embed_data, author_name: e.target.value },
                  }))
                }
                placeholder={t("scheduler_authorNamePlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("scheduler_iconUrl")}</Label>
              <Input
                value={embedData.author_icon_url}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    embed_data: { ...f.embed_data, author_icon_url: e.target.value },
                  }))
                }
                placeholder="https://example.com/icon.png"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Fields — collapsible with count ── */}
      <div className="rounded-lg border">
        <button
          type="button"
          className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
          onClick={() => setEmbedFieldsOpen(!embedFieldsOpen)}
        >
          <span className="flex items-center gap-2">
            <ChevronDown className={cn("h-4 w-4 transition-transform", embedFieldsOpen && "rotate-180")} />
            <Type className="h-3.5 w-3.5 text-muted-foreground" />
            {t("scheduler_fieldsSection")}
            <span className="text-xs text-muted-foreground font-normal">
              ({embedData.fields.length}/25)
            </span>
          </span>
        </button>
        {embedFieldsOpen && (
          <div className="px-4 pb-4 space-y-3">
            {embedData.fields.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                {t("scheduler_noFieldsYet")}
              </p>
            )}
            {embedData.fields.map((field, idx) => (
              <div
                key={idx}
                className="rounded-md border bg-muted/30 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Field #{idx + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => removeEmbedField(idx)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("scheduler_nameLabel")}</Label>
                    <Input
                      value={field.name}
                      onChange={(e) =>
                        updateEmbedField(idx, { name: e.target.value })
                      }
                      placeholder={t("scheduler_nameFieldPlaceholder")}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("scheduler_valueLabel")}</Label>
                    <Input
                      value={field.value}
                      onChange={(e) =>
                        updateEmbedField(idx, { value: e.target.value })
                      }
                      placeholder={t("scheduler_contentPlaceholder")}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={field.inline}
                    onChange={(e) =>
                      updateEmbedField(idx, { inline: e.target.checked })
                    }
                    className="rounded border-input"
                  />
                  {t("scheduler_inlineHint")}
                </label>
              </div>
            ))}
            {embedData.fields.length < 25 && (
              <Button
                variant="outline"
                size="sm"
                onClick={addEmbedField}
                className="w-full border-dashed"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {t("scheduler_addField")}
              </Button>
            )}
            {embedData.fields.length >= 25 && (
              <p className="text-xs text-muted-foreground text-center">
                {t("scheduler_fieldsLimit")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Images — collapsible ── */}
      <div className="rounded-lg border">
        <button
          type="button"
          className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
          onClick={() => setEmbedImagesOpen(!embedImagesOpen)}
        >
          <span className="flex items-center gap-2">
            <ChevronDown className={cn("h-4 w-4 transition-transform", embedImagesOpen && "rotate-180")} />
            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
            {t("scheduler_imageSection")}
          </span>
        </button>
        {embedImagesOpen && (
          <div className="px-4 pb-4 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("scheduler_thumbnailUrl")}</Label>
              <Input
                value={embedData.thumbnail_url}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    embed_data: {
                      ...f.embed_data,
                      thumbnail_url: e.target.value,
                    },
                  }))
                }
                placeholder="https://example.com/thumb.png"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("scheduler_largeImageUrl")}</Label>
              <Input
                value={embedData.image_url}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    embed_data: {
                      ...f.embed_data,
                      image_url: e.target.value,
                    },
                  }))
                }
                placeholder="https://example.com/image.png"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Footer — collapsible ── */}
      <div className="rounded-lg border">
        <button
          type="button"
          className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
          onClick={() => setEmbedFooterOpen(!embedFooterOpen)}
        >
          <span className="flex items-center gap-2">
            <ChevronDown className={cn("h-4 w-4 transition-transform", embedFooterOpen && "rotate-180")} />
            <Footprints className="h-3.5 w-3.5 text-muted-foreground" />
            {t("scheduler_footerSection")}
          </span>
          {embedData.footer && !embedFooterOpen && (
            <span className="text-xs font-normal text-muted-foreground truncate max-w-[200px]">
              {embedData.footer}
            </span>
          )}
        </button>
        {embedFooterOpen && (
          <div className="px-4 pb-4 space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t("scheduler_footerContent")}</Label>
                <span className="text-[11px] text-muted-foreground">
                  {embedData.footer.length}/2048
                </span>
              </div>
              <Input
                value={embedData.footer}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    embed_data: {
                      ...f.embed_data,
                      footer: e.target.value,
                    },
                  }))
                }
                placeholder={t("scheduler_footerPlaceholder")}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
