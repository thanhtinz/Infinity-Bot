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
import { cn } from "@/lib/utils";
import { ChannelSelect } from "@/components/ChannelSelect";
import type { TicketPanel, TicketPanelGroup, PanelGroupForm } from "./tpTypes";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface GroupEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGroup: TicketPanelGroup | null;
  groupForm: PanelGroupForm;
  setGroupForm: React.Dispatch<React.SetStateAction<PanelGroupForm>>;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  panels: TicketPanel[];
  groups: TicketPanelGroup[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GroupEditDialog({
  open,
  onOpenChange,
  editingGroup,
  groupForm,
  setGroupForm,
  isSaving,
  onSave,
  onCancel,
  panels,
  groups,
}: GroupEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingGroup ? "Chỉnh sửa Nhóm" : "Tạo Nhóm"}</DialogTitle>
          <DialogDescription>Gộp nhiều panel vào 1 embed message</DialogDescription>
        </DialogHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Tên nhóm <span className="text-destructive">*</span></Label>
            <Input value={groupForm.name} onChange={e => setGroupForm(f => ({...f, name: e.target.value}))} placeholder="Ví dụ: Hỗ trợ chung" />
          </div>
          <div className="space-y-1.5">
            <Label>Kênh gửi</Label>
            <ChannelSelect value={groupForm.channel_id} onChange={v => setGroupForm(f => ({...f, channel_id: v === "__clear__" ? "" : v}))} placeholder="Chọn kênh..." filter="text" />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Tiêu đề embed</Label>
            <Input value={groupForm.title} onChange={e => setGroupForm(f => ({...f, title: e.target.value}))} placeholder="Hỗ trợ" />
          </div>
          <div className="space-y-1.5">
            <Label>Mô tả</Label>
            <Textarea value={groupForm.description} onChange={e => setGroupForm(f => ({...f, description: e.target.value}))} placeholder="Mô tả embed..." rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Màu</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={groupForm.color} onChange={e => setGroupForm(f => ({...f, color: e.target.value}))} className="h-9 w-12 rounded border cursor-pointer shrink-0" />
              <Input value={groupForm.color} onChange={e => setGroupForm(f => ({...f, color: e.target.value}))} className="w-28 font-mono" />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Chọn panels trong nhóm</Label>
            <p className="text-xs text-muted-foreground">Các panel được chọn sẽ gộp buttons vào 1 message</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {panels.map(p => {
                const isInGroup = groupForm.panel_ids.includes(p.id);
                const isInOtherGroup = !isInGroup && groups.some(g => g.id !== editingGroup?.id && g.panel_ids.includes(p.id));
                return (
                  <label
                    key={p.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      isInGroup ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                      isInOtherGroup && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isInGroup}
                      disabled={isInOtherGroup}
                      onChange={() => {
                        setGroupForm(f => ({
                          ...f,
                          panel_ids: f.panel_ids.includes(p.id)
                            ? f.panel_ids.filter(id => id !== p.id)
                            : [...f.panel_ids, p.id],
                        }));
                      }}
                      className="rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.title}</p>
                    </div>
                    {p.buttons.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">{p.buttons.length} btn</Badge>
                    )}
                    {isInOtherGroup && <span className="text-xs text-muted-foreground shrink-0">Đã trong nhóm khác</span>}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={onCancel}>Hủy</Button>
            <Button className="flex-1" disabled={!groupForm.name.trim() || isSaving} onClick={onSave}>
              {isSaving ? "Đang lưu..." : editingGroup ? "Cập nhật" : "Tạo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
