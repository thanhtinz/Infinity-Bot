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
            {editingPanel ? "Edit Panel" : "Tạo Panel"}
          </DialogTitle>
          <DialogDescription>
            {editingPanel
              ? "Cập nhật cấu hình panel ticket"
              : "Tạo panel ticket mới cho server"}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          {/* Panel name */}
          <div className="space-y-1.5">
            <Label>
              Tên Panel <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Ví dụ: Hỗ trợ chung"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Tên nội bộ, không hiển thị trên Discord
            </p>
          </div>

          {/* Channel ID */}
          <div className="space-y-1.5">
            <Label>Kênh Discord</Label>
            <ChannelSelect
              filter="text"
              value={form.channel_id}
              onChange={(v) => setField("channel_id", v === "__clear__" ? "" : v)}
              placeholder="Select channel..."
            />
          </div>

          <Separator />

          {/* Tabs: Embed / Buttons */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="embed" className="flex-1 gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Embed
              </TabsTrigger>
              <TabsTrigger value="buttons" className="flex-1 gap-1.5">
                <MousePointerClick className="h-3.5 w-3.5" />
                Nút bấm
              </TabsTrigger>
              <TabsTrigger value="config" className="flex-1 gap-1.5">
                <Settings className="h-3.5 w-3.5" />
                Cấu hình
              </TabsTrigger>
            </TabsList>

            {/* ── Embed Tab ── */}
            <TabsContent value="embed" className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                  <Input
                    placeholder="Ví dụ: Tạo Ticket"
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <EmojiPicker onSelect={(em) => setField("title", form.title + em)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                  <Textarea
                    placeholder="Mô tả hiển thị trong embed..."
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    rows={3}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                  />
                  <EmojiPicker onSelect={(em) => setField("description", form.description + em)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Màu</Label>
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
                  Sau khi tạo, dùng{" "}
                  <code className="bg-muted px-1 py-0.5 rounded font-mono text-[11px]">
                    /panel send
                  </code>{" "}
                  để gửi panel vào channel Discord
                </p>
              </div>

              {/* Discord Live Preview */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">
                  Xem trước trên Discord
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
                    Chưa có button nào
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Thêm button để người dùng chọn loại ticket
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
                          {btn.label || "Nút"}
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
                  Thêm button
                </Button>
              )}

              {/* Inline button editor */}
              {editingBtnIdx !== null && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {editingBtnIdx < form.buttons.length
                        ? "Edit button"
                        : "Thêm button"}
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
                    <Label>Nhãn</Label>
                    <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Input
                        placeholder="Ví dụ: Hỗ trợ chung"
                        value={btnForm.label}
                        onChange={(e) => setBtnField("label", e.target.value)}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <EmojiPicker onSelect={(em) => setBtnField("label", btnForm.label + em)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Emoji</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        placeholder="Nhập emoji..."
                        value={btnForm.emoji}
                        onChange={(e) => setBtnField("emoji", e.target.value)}
                        className="w-24"
                        maxLength={4}
                      />
                      <EmojiPicker onSelect={(emoji) => setBtnField("emoji", emoji)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Kiểu nút</Label>
                    <ButtonStylePicker
                      value={btnForm.style}
                      onChange={(v) => setBtnField("style", v)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Category ID</Label>
                    <ChannelSelect
                      filter="category"
                      value={btnForm.category_id}
                      onChange={(v) =>
                        setBtnField("category_id", v === "__clear__" ? "" : v)
                      }
                      placeholder="Chọn category cho ticket..."
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Mỗi nút có thể tạo ticket vào category khác nhau
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Form ID (tùy chọn)</Label>
                    <Input
                      placeholder="Form ID..."
                      value={btnForm.form_id}
                      onChange={(e) => setBtnField("form_id", e.target.value)}
                    />
                  </div>

                  {/* Inline preview */}
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">
                      Xem trước
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
                            {btnForm.label || "Nút"}
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
                      Hủy
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={!btnForm.label.trim()}
                      onClick={confirmButton}
                    >
                      {editingBtnIdx < form.buttons.length
                        ? "Cập nhật"
                        : "Add"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Discord preview at bottom of buttons tab */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">
                  Xem trước trên Discord
                </Label>
                <DiscordPreview form={form} buttons={form.buttons} />
              </div>
            </TabsContent>

            {/* ── Config Tab ── */}
            <TabsContent value="config" className="space-y-4 pt-2">
              <div className="rounded-lg border bg-muted/40 p-3 flex gap-2.5">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Để trống các trường = sử dụng cấu hình chung từ Ticket Config
                </p>
              </div>

              {/* Naming format */}
              <div className="space-y-1.5">
                <Label>Định dạng tên ticket</Label>
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
                  Để trống = dùng cấu hình chung. Biến: {"{number}"}, {"{username}"}, {"{displayname}"}
                </p>
              </div>

              <Separator />

              {/* Open message - Collapsible */}
              <CollapsibleSection
                title="Tin nhắn mở ticket"
                hasContent={!!(form.open_message_title || form.open_message_body)}
              >
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Input
                        placeholder="Mặc định từ cài đặt chung"
                        value={form.open_message_title}
                        onChange={(e) => setField("open_message_title", e.target.value)}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <EmojiPicker onSelect={(em) => setField("open_message_title", form.open_message_title + em)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Content</Label>
                    <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Textarea
                        placeholder="Mặc định từ cài đặt chung"
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
                title="Tin nhắn đóng ticket"
                hasContent={!!(form.close_message_title || form.close_message_body)}
              >
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Input
                        placeholder="Mặc định từ cài đặt chung"
                        value={form.close_message_title}
                        onChange={(e) => setField("close_message_title", e.target.value)}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <EmojiPicker onSelect={(em) => setField("close_message_title", form.close_message_title + em)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Content</Label>
                    <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Textarea
                        placeholder="Mặc định từ cài đặt chung"
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
                title="Tin nhắn claim ticket"
                hasContent={!!(form.claim_message_title || form.claim_message_body)}
              >
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Input
                        placeholder="Mặc định từ cài đặt chung"
                        value={form.claim_message_title}
                        onChange={(e) => setField("claim_message_title", e.target.value)}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <EmojiPicker onSelect={(em) => setField("claim_message_title", form.claim_message_title + em)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Content</Label>
                    <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Textarea
                        placeholder="Mặc định từ cài đặt chung"
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
              Hủy
            </Button>
            <Button
              className="flex-1"
              disabled={!form.name.trim() || isSaving}
              onClick={onSave}
            >
              {isSaving
                ? "Saving..."
                : editingPanel
                  ? "Cập nhật"
                  : "Tạo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
