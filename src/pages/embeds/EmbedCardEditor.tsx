import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronDown, ChevronRight,
  Plus, Trash2, Copy,
  ArrowUp, ArrowDown,
} from "lucide-react";
import { EmojiPicker } from "@/components/EmojiPicker";
import type { EmbedData, EmbedField, EmbedOpenState } from "./embedTypes";
import { defaultEmbedOpen } from "./customMessagesHelpers";
import { useT } from "@/i18n";

interface EmbedCardEditorProps {
  embeds: EmbedData[];
  openStates: EmbedOpenState[];
  onUpdateEmbed: (idx: number, patch: Partial<EmbedData>) => void;
  onRemoveEmbed: (idx: number) => void;
  onDuplicateEmbed: (idx: number) => void;
  onMoveEmbed: (idx: number, dir: "up" | "down") => void;
  onAddField: (embedIdx: number) => void;
  onRemoveField: (embedIdx: number, fieldIdx: number) => void;
  onUpdateField: (embedIdx: number, fieldIdx: number, key: keyof EmbedField, val: string | boolean) => void;
  onSetOpenState: (idx: number, patch: Partial<EmbedOpenState>) => void;
}

export function EmbedCardEditor({
  embeds,
  openStates,
  onUpdateEmbed,
  onRemoveEmbed,
  onDuplicateEmbed,
  onMoveEmbed,
  onAddField,
  onRemoveField,
  onUpdateField,
  onSetOpenState,
}: EmbedCardEditorProps) {
  const { t } = useT();
  return (
    <>
      {embeds.map((emb, idx) => {
        const openState = openStates[idx] ?? defaultEmbedOpen();
        const borderColor = emb.color || "#5865F2";
        return (
          <div key={idx} className="rounded-lg border overflow-hidden bg-card" style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}>
            {/* Embed header */}
            <div className="flex items-center gap-1 px-3 py-2 bg-muted/30">
              <button type="button" className="flex-1 flex items-center gap-2 text-sm font-semibold text-left"
                onClick={() => onSetOpenState(idx, { main: !openState.main })}>
                {openState.main ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Embed {idx + 1}{emb.title ? ` — ${emb.title}` : ""}
              </button>
              <Button size="icon" variant="ghost" className="h-7 w-7" title={t("embed_moveUp")} disabled={idx === 0} onClick={() => onMoveEmbed(idx, "up")}><ArrowUp className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" title={t("embed_moveDown")} disabled={idx === embeds.length - 1} onClick={() => onMoveEmbed(idx, "down")}><ArrowDown className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" title={t("embed_duplicate")} onClick={() => onDuplicateEmbed(idx)}><Copy className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title={t("delete")} onClick={() => onRemoveEmbed(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>

            {openState.main && (
              <div className="px-4 pb-4 pt-3 space-y-4">
                {/* Author — collapsible */}
                <div className="rounded-md border">
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50"
                    onClick={() => onSetOpenState(idx, { author: !openState.author })}>
                    {openState.author ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {t("embed_author")}
                  </button>
                  {openState.author && (
                    <div className="px-3 pb-3 space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("embed_authorName")} <span className="text-[10px]">{emb.author.length}/256</span></Label>
                        <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                          <Input className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm" placeholder={t("embed_authorName")} maxLength={256}
                            value={emb.author} onChange={(e) => onUpdateEmbed(idx, { author: e.target.value })} />
                          <EmojiPicker onSelect={(em) => onUpdateEmbed(idx, { author: emb.author + em })} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("embed_iconUrl")}</Label>
                        <Input className="text-sm" placeholder="https://..." value={emb.author_icon_url} onChange={(e) => onUpdateEmbed(idx, { author_icon_url: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Body: Title, Description, Color */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">{t("embed_title")}</Label>
                      <span className="text-[11px] text-muted-foreground">{emb.title.length}/256</span>
                    </div>
                    <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Input className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm" placeholder={t("embed_titleEmbedPlaceholder")} maxLength={256}
                        value={emb.title} onChange={(e) => onUpdateEmbed(idx, { title: e.target.value })} />
                      <EmojiPicker onSelect={(em) => onUpdateEmbed(idx, { title: emb.title + em })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">{t("embed_description")}</Label>
                      <span className="text-[11px] text-muted-foreground">{emb.description.length}/4096</span>
                    </div>
                    <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Textarea className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 text-sm resize-y" placeholder={t("embed_descriptionPlaceholder")} rows={4} maxLength={4096}
                        value={emb.description} onChange={(e) => onUpdateEmbed(idx, { description: e.target.value })} />
                      <EmojiPicker onSelect={(em) => onUpdateEmbed(idx, { description: emb.description + em })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("embed_colors")}</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={emb.color} onChange={(e) => onUpdateEmbed(idx, { color: e.target.value })}
                        className="h-8 w-8 rounded cursor-pointer border-0 p-0" />
                      <Input value={emb.color} onChange={(e) => onUpdateEmbed(idx, { color: e.target.value })}
                        className="w-28 font-mono text-xs" maxLength={7} />
                    </div>
                  </div>
                </div>

                {/* Images — collapsible */}
                <div className="rounded-md border">
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50"
                    onClick={() => onSetOpenState(idx, { images: !openState.images })}>
                    {openState.images ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {t("embed_image")}
                  </button>
                  {openState.images && (
                    <div className="px-3 pb-3 space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("embed_thumbnailUrl")}</Label>
                        <Input className="text-sm" placeholder="https://..." value={emb.thumbnail_url} onChange={(e) => onUpdateEmbed(idx, { thumbnail_url: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("embed_imageUrlLarge")}</Label>
                        <Input className="text-sm" placeholder="https://..." value={emb.image_url} onChange={(e) => onUpdateEmbed(idx, { image_url: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">{t("embed_footer")}</Label>
                    <span className="text-[11px] text-muted-foreground">{emb.footer.length}/2048</span>
                  </div>
                  <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                    <Input className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm" placeholder={t("embed_footerContent")} maxLength={2048}
                      value={emb.footer} onChange={(e) => onUpdateEmbed(idx, { footer: e.target.value })} />
                    <EmojiPicker onSelect={(em) => onUpdateEmbed(idx, { footer: emb.footer + em })} />
                  </div>
                </div>

                {/* Fields — collapsible */}
                <div className="rounded-md border">
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50"
                    onClick={() => onSetOpenState(idx, { fields: !openState.fields })}>
                    {openState.fields ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {t("embed_fields")} ({emb.fields.length}/25)
                  </button>
                  {openState.fields && (
                    <div className="px-3 pb-3 space-y-2 pt-1">
                      {emb.fields.map((field, fi) => (
                        <div key={fi} className="rounded-md border bg-muted/30 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">{t("embed_field")} {fi + 1}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onRemoveField(idx, fi)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                              <Input placeholder={t("embed_nameFieldPlaceholder")} value={field.name} onChange={(e) => onUpdateField(idx, fi, "name", e.target.value)}
                                className="text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                              <EmojiPicker onSelect={(em) => onUpdateField(idx, fi, "name", field.name + em)} />
                            </div>
                            <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                              <Input placeholder={t("embed_value")} value={field.value} onChange={(e) => onUpdateField(idx, fi, "value", e.target.value)}
                                className="text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                              <EmojiPicker onSelect={(em) => onUpdateField(idx, fi, "value", field.value + em)} />
                            </div>
                          </div>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                            <input type="checkbox" checked={field.inline} onChange={(e) => onUpdateField(idx, fi, "inline", e.target.checked)} className="rounded border-input" />
                            {t("embed_inline")}
                          </label>
                        </div>
                      ))}
                      {emb.fields.length < 25 && (
                        <Button variant="outline" size="sm" onClick={() => onAddField(idx)} className="w-full border-dashed">
                          <Plus className="h-3.5 w-3.5 mr-1.5" />{t("embed_addField")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
