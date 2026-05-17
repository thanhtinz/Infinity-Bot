import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  MessageSquare,
  MousePointerClick,
  Settings,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChannelSelect } from "@/components/ChannelSelect";
import { EmojiPicker } from "@/components/EmojiPicker";
import { useT } from "@/i18n";
import type {
  TicketPanel,
  PanelForm,
  ButtonForm,
} from "./tpTypes";
import {
  MAX_BUTTONS,
  PRESET_COLORS,
  getButtonStyle,
} from "./tpConstants";
import { DiscordPreview, ButtonStylePicker, CollapsibleSection } from "./tpComponents";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface PanelEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPanel: TicketPanel | null;
  form: PanelForm;
  setField: <K extends keyof PanelForm>(field: K, value: PanelForm[K]) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  // Button editing
  editingBtnIdx: number | null;
  btnForm: ButtonForm;
  setBtnField: <K extends keyof ButtonForm>(field: K, value: ButtonForm[K]) => void;
  startAddButton: () => void;
  startEditButton: (idx: number) => void;
  confirmButton: () => void;
  removeButton: (idx: number) => void;
  cancelButtonEdit: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PanelEditDialog({
  open,
  onOpenChange,
  editingPanel,
  form,
  setField,
  activeTab,
  setActiveTab,
  isSaving,
  onSave,
  onCancel,
  editingBtnIdx,
  btnForm,
  setBtnField,
  startAddButton,
  startEditButton,
  confirmButton,
  removeButton,
  cancelButtonEdit,
}: PanelEditDialogProps) {
  const { t } = useT();
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onOpenChange(false);
      }}
    >
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingPanel ? t("ticketPanels_editPanel") : t("ticketPanels_createPanel")}
          </DialogTitle>
          <DialogDescription>
            {editingPanel
              ? t("ticketPanels_updatePanelDesc")
              : t("ticketPanels_createPanelDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          {/* Panel name */}
          <div className="space-y-1.5">
            <Label>
              {t("ticketPanels_namePanel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder={t("ticketPanels_namePlaceholder")}
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              {t("ticketPanels_nameHint")}
            </p>
          </div>

          {/* Channel ID */}
          <div className="space-y-1.5">
            <Label>{t("ticketPanels_channelDiscord")}</Label>
            <ChannelSelect
              filter="text"
              value={form.channel_id}
              onChange={(v) => setField("channel_id", v === "__clear__" ? "" : v)}
              placeholder={t("selectChannel")}
            />
          </div>

          <Separator />

          {/* Tabs: Embed / Buttons */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="embed" className="flex-1 gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                {t("ticketPanels_embed")}
              </TabsTrigger>
              <TabsTrigger value="buttons" className="flex-1 gap-1.5">
                <MousePointerClick className="h-3.5 w-3.5" />
                {t("ticketPanels_buttons")}
              </TabsTrigger>
              <TabsTrigger value="config" className="flex-1 gap-1.5">
                <Settings className="h-3.5 w-3.5" />
                {t("settings")}
              </TabsTrigger>
            </TabsList>

            {/* ── Embed Tab ── */}
            <TabsContent value="embed" className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>{t("ticketPanels_title")}</Label>
                <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                  <Input
                    placeholder={t("ticketPanels_titlePlaceholder")}
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <EmojiPicker onSelect={(em) => setField("title", form.title + em)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("description")}</Label>
                <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                  <Textarea
                    placeholder={t("ticketPanels_descPlaceholder")}
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    rows={3}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                  />
                  <EmojiPicker onSelect={(em) => setField("description", form.description + em)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("color")}</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setField("color", e.target.value)}
                    className="h-9 w-12 rounded border cursor-pointer shrink-0"
                  />
                  <Input
                    value={form.color}
                    onChange={(e) => setField("color", e.target.value)}
                    className="w-28 font-mono"
                    placeholder="#5865F2"
                  />
                </div>
                {/* Preset colors */}
                <div className="flex gap-2 mt-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setField("color", c)}
                      className={cn(
                        "h-7 w-7 rounded-full border-2 transition-all",
                        form.color === c
                          ? "border-foreground scale-110"
                          : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Info box */}
              <div className="rounded-lg border bg-muted/40 p-3 flex gap-2.5">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("ticketPanels_sendPanelHint")}
                </p>
              </div>

              {/* Discord Live Preview */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">
                  {t("ticketPanels_previewOnDiscord")}
                </Label>
                <DiscordPreview form={form} buttons={form.buttons} />
              </div>
            </TabsContent>

            {/* ── Buttons Tab ── */}
            <TabsContent value="buttons" className="space-y-4 pt-2">
              {/* Button list */}
              {form.buttons.length === 0 && editingBtnIdx === null ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <MousePointerClick className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t("ticketPanels_noButtonsYet")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("ticketPanels_addButtonsHint")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {form.buttons.map((btn, idx) => {
                    const s = getButtonStyle(btn.style);
                    return (
                      <div
                        key={btn.id ?? idx}
                        className="flex items-center gap-2 rounded-lg border p-2.5"
                      >
                        {/* Style dot */}
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: s.bg }}
                        />
                        {/* Emoji + Label */}
                        <span className="text-sm truncate flex-1 min-w-0">
                          {btn.emoji && (
                            <span className="mr-1">{btn.emoji}</span>
                          )}
                          {btn.label || t("ticketPanels_button")}
                        </span>
                        {/* Style badge */}
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 shrink-0"
                        >
                          {s.label}
                        </Badge>
                        {/* Edit */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={() => startEditButton(idx)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => removeButton(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add button */}
              {form.buttons.length < MAX_BUTTONS && editingBtnIdx === null && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={startAddButton}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {t("ticketPanels_addButton")}
                </Button>
              )}

              {/* Inline button editor */}
              {editingBtnIdx !== null && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {editingBtnIdx < form.buttons.length
                        ? t("ticketPanels_editButton")
                        : t("ticketPanels_addButton")}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={cancelButtonEdit}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t("ticketPanels_label")}</Label>
                    <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Input
                        placeholder={t("ticketPanels_namePlaceholder")}
                        value={btnForm.label}
                        onChange={(e) => setBtnField("label", e.target.value)}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <EmojiPicker onSelect={(em) => setBtnField("label", btnForm.label + em)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t("ticketPanels_emoji")}</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        placeholder={t("ticketPanels_enterEmoji")}
                        value={btnForm.emoji}
                        onChange={(e) => setBtnField("emoji", e.target.value)}
                        className="w-24"
                        maxLength={4}
                      />
                      <EmojiPicker onSelect={(emoji) => setBtnField("emoji", emoji)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t("ticket_buttonStyle")}</Label>
                    <ButtonStylePicker
                      value={btnForm.style}
                      onChange={(v) => setBtnField("style", v)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t("ticket_ticketCategory")}</Label>
                    <ChannelSelect
                      filter="category"
                      value={btnForm.category_id}
                      onChange={(v) =>
                        setBtnField("category_id", v === "__clear__" ? "" : v)
                      }
                      placeholder={t("ticketPanels_selectCategory")}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {t("ticketPanels_categoryHint")}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t("ticketPanels_formIdOptional")}</Label>
                    <Input
                      placeholder={t("ticketPanels_formIdPlaceholder")}
                      value={btnForm.form_id}
                      onChange={(e) => setBtnField("form_id", e.target.value)}
                    />
                  </div>

                  {/* Inline preview */}
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">
                      {t("preview")}
                    </Label>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const s = getButtonStyle(btnForm.style);
                        return (
                          <div
                            className="inline-flex items-center gap-1.5 rounded-[3px] px-4 py-1.5 text-xs font-medium"
                            style={{
                              backgroundColor: s.bg,
                              color: s.text,
                            }}
                          >
                            {btnForm.emoji && <span>{btnForm.emoji}</span>}
                            {btnForm.label || t("ticketPanels_button")}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={cancelButtonEdit}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={!btnForm.label.trim()}
                      onClick={confirmButton}
                    >
                      {editingBtnIdx < form.buttons.length
                        ? t("update")
                        : t("add")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Discord preview at bottom of buttons tab */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">
                  {t("ticketPanels_previewOnDiscord")}
                </Label>
                <DiscordPreview form={form} buttons={form.buttons} />
              </div>
            </TabsContent>

            {/* ── Config Tab ── */}
            <TabsContent value="config" className="space-y-4 pt-2">
              <div className="rounded-lg border bg-muted/40 p-3 flex gap-2.5">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("ticketPanels_useGlobalConfigHint")}
                </p>
              </div>

              {/* Naming format */}
              <div className="space-y-1.5">
                <Label>{t("ticket_ticketNameFormat")}</Label>
                <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                  <Input
                    placeholder="ticket-{number}"
                    value={form.naming_format}
                    onChange={(e) => setField("naming_format", e.target.value)}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <EmojiPicker onSelect={(em) => setField("naming_format", form.naming_format + em)} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t("ticketPanels_namingFormatHint")}
                </p>
              </div>

              <Separator />

              {/* Open message - Collapsible */}
              <CollapsibleSection
                title={t("ticketPanels_openMessages")}
                hasContent={!!(form.open_message_title || form.open_message_body)}
              >
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>{t("ticketPanels_title")}</Label>
                    <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Input
                        placeholder={t("ticketPanels_defaultGlobal")}
                        value={form.open_message_title}
                        onChange={(e) => setField("open_message_title", e.target.value)}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <EmojiPicker onSelect={(em) => setField("open_message_title", form.open_message_title + em)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("ticketPanels_content")}</Label>
                    <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Textarea
                        placeholder={t("ticketPanels_defaultGlobal")}
                        value={form.open_message_body}
                        onChange={(e) => setField("open_message_body", e.target.value)}
                        rows={3}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                      />
                      <EmojiPicker onSelect={(em) => setField("open_message_body", form.open_message_body + em)} />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Close message - Collapsible */}
              <CollapsibleSection
                title={t("ticketPanels_closeMessages")}
                hasContent={!!(form.close_message_title || form.close_message_body)}
              >
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>{t("ticketPanels_title")}</Label>
                    <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Input
                        placeholder={t("ticketPanels_defaultGlobal")}
                        value={form.close_message_title}
                        onChange={(e) => setField("close_message_title", e.target.value)}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <EmojiPicker onSelect={(em) => setField("close_message_title", form.close_message_title + em)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("ticketPanels_content")}</Label>
                    <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Textarea
                        placeholder={t("ticketPanels_defaultGlobal")}
                        value={form.close_message_body}
                        onChange={(e) => setField("close_message_body", e.target.value)}
                        rows={3}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                      />
                      <EmojiPicker onSelect={(em) => setField("close_message_body", form.close_message_body + em)} />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Claim message - Collapsible */}
              <CollapsibleSection
                title={t("ticketPanels_claimMessages")}
                hasContent={!!(form.claim_message_title || form.claim_message_body)}
              >
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>{t("ticketPanels_title")}</Label>
                    <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Input
                        placeholder={t("ticketPanels_defaultGlobal")}
                        value={form.claim_message_title}
                        onChange={(e) => setField("claim_message_title", e.target.value)}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <EmojiPicker onSelect={(em) => setField("claim_message_title", form.claim_message_title + em)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("ticketPanels_content")}</Label>
                    <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Textarea
                        placeholder={t("ticketPanels_defaultGlobal")}
                        value={form.claim_message_body}
                        onChange={(e) => setField("claim_message_body", e.target.value)}
                        rows={3}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                      />
                      <EmojiPicker onSelect={(em) => setField("claim_message_body", form.claim_message_body + em)} />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            </TabsContent>
          </Tabs>

          {/* ── Save / Cancel ── */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              {t("cancel")}
            </Button>
            <Button
              className="flex-1"
              disabled={!form.name.trim() || isSaving}
              onClick={onSave}
            >
              {isSaving
                ? t("saving")
                : editingPanel
                  ? t("update")
                  : t("create")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
