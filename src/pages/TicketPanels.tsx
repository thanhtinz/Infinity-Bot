import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { LayoutGrid, Plus, Pencil, Trash2, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface TicketPanel {
  id: number;
  guild_id?: string;
  channel_id?: string;
  name: string;
  title?: string;
  description?: string;
  color?: string;
  button_label?: string;
  button_emoji?: string;
  button_style?: string;
  category_id?: string;
  message_id?: string;
  created_at?: string;
}

const STYLE_LABELS: Record<string, string> = {
  primary: "Primary (Blurple)",
  secondary: "Secondary (Gray)",
  success: "Success (Green)",
  danger: "Danger (Red)",
};

const STYLE_COLORS: Record<string, string> = {
  primary: "bg-indigo-500 text-white",
  secondary: "bg-gray-500 text-white",
  success: "bg-green-500 text-white",
  danger: "bg-red-500 text-white",
};

const STYLE_BADGE: Record<string, string> = {
  primary: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30",
  secondary: "bg-gray-500/15 text-gray-500 border-gray-500/30",
  success: "bg-green-500/15 text-green-600 border-green-500/30",
  danger: "bg-red-500/15 text-red-600 border-red-500/30",
};

interface PanelForm {
  name: string;
  title: string;
  description: string;
  color: string;
  button_label: string;
  button_emoji: string;
  button_style: string;
  channel_id: string;
  category_id: string;
}

const emptyForm = (): PanelForm => ({
  name: "",
  title: "Tạo Ticket",
  description: "Nhấn nút bên dưới để tạo ticket hỗ trợ.",
  color: "#5865F2",
  button_label: "Tạo Ticket",
  button_emoji: "🎫",
  button_style: "primary",
  channel_id: "",
  category_id: "",
});

export function TicketPanels() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<TicketPanel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TicketPanel | null>(null);
  const [form, setForm] = useState<PanelForm>(emptyForm());

  const { data: panels = [], isLoading } = useQuery<TicketPanel[]>({
    queryKey: ["ticket-panels"],
    queryFn: () => fetch("/api/ticket-panels", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/ticket-panels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-panels"] });
      setSheetOpen(false);
      toast({ title: "Đã tạo panel" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/ticket-panels/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-panels"] });
      setSheetOpen(false);
      setEditingPanel(null);
      toast({ title: "Đã cập nhật panel" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/ticket-panels/${id}`, { method: "DELETE", credentials: "include" }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-panels"] });
      setDeleteTarget(null);
      toast({ title: "Đã xóa panel" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Lỗi", description: e.message }),
  });

  const openCreate = () => {
    setEditingPanel(null);
    setForm(emptyForm());
    setSheetOpen(true);
  };

  const openEdit = (p: TicketPanel) => {
    setEditingPanel(p);
    setForm({
      name: p.name,
      title: p.title ?? "",
      description: p.description ?? "",
      color: p.color ?? "#5865F2",
      button_label: p.button_label ?? "",
      button_emoji: p.button_emoji ?? "",
      button_style: p.button_style ?? "primary",
      channel_id: p.channel_id ?? "",
      category_id: p.category_id ?? "",
    });
    setSheetOpen(true);
  };

  const handleSave = () => {
    const payload: Record<string, unknown> = { ...form };
    if (editingPanel) {
      updateMutation.mutate({ id: editingPanel.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const setField = <K extends keyof PanelForm>(field: K, value: PanelForm[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-primary" />
            Ticket Panels
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý panel tạo ticket</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo Panel
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Đang tải...</div>
      ) : panels.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <LayoutGrid className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="mt-3 text-muted-foreground">Chưa có panel nào.</p>
            <p className="text-sm text-muted-foreground">Nhấn "Tạo Panel" để bắt đầu.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {panels.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold truncate">{p.name}</span>
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">#{p.id}</Badge>
                  </div>
                  <Badge className={cn("border shrink-0", STYLE_BADGE[p.button_style ?? "primary"] ?? STYLE_BADGE.primary)}>
                    {STYLE_LABELS[p.button_style ?? "primary"]?.split(" ")[0] ?? "Primary"}
                  </Badge>
                </div>

                {/* Embed preview */}
                <div className="mx-4 mb-3 rounded-lg border bg-muted/30 overflow-hidden">
                  <div className="flex">
                    <div className="w-1.5 shrink-0" style={{ backgroundColor: p.color ?? "#5865F2" }} />
                    <div className="p-3 flex-1 min-w-0">
                      <p className="font-semibold text-sm">{p.title || "Tiêu đề"}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description || "Mô tả..."}</p>
                    </div>
                  </div>
                  <div className="px-3 pb-3">
                    <div className={cn("inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium", STYLE_COLORS[p.button_style ?? "primary"] ?? STYLE_COLORS.primary)}>
                      <span>{p.button_emoji}</span>
                      {p.button_label || "Nút"}
                    </div>
                  </div>
                </div>

                {/* Channel / Category info */}
                {(p.channel_id || p.category_id) && (
                  <div className="mx-4 mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {p.channel_id && (
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        Channel: <code className="bg-muted px-1 py-0.5 rounded">{p.channel_id}</code>
                      </span>
                    )}
                    {p.category_id && (
                      <span className="flex items-center gap-1">
                        Category: <code className="bg-muted px-1 py-0.5 rounded">{p.category_id}</code>
                      </span>
                    )}
                  </div>
                )}

                <Separator />

                {/* Actions */}
                <div className="flex items-center justify-between px-4 py-2.5">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Sửa
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(p)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Xóa
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create/Edit Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { if (!o) { setSheetOpen(false); setEditingPanel(null); } }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingPanel ? "Chỉnh sửa Panel" : "Tạo Panel"}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Tên Panel <span className="text-destructive">*</span></Label>
              <Input placeholder="Ví dụ: Hỗ trợ chung" value={form.name} onChange={(e) => setField("name", e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Tiêu đề</Label>
              <Input placeholder="Ví dụ: Tạo Ticket" value={form.title} onChange={(e) => setField("title", e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Mô tả</Label>
              <Textarea placeholder="Mô tả hiển thị trong embed..." value={form.description} onChange={(e) => setField("description", e.target.value)} rows={3} />
            </div>

            <div className="space-y-1.5">
              <Label>Màu sắc</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setField("color", e.target.value)}
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setField("color", e.target.value)}
                  className="w-28 font-mono"
                  placeholder="#5865F2"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Nhãn nút</Label>
              <Input placeholder="Ví dụ: Tạo Ticket" value={form.button_label} onChange={(e) => setField("button_label", e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Emoji nút</Label>
              <Input placeholder="🎫" value={form.button_emoji} onChange={(e) => setField("button_emoji", e.target.value)} className="w-20" maxLength={4} />
            </div>

            <div className="space-y-1.5">
              <Label>Kiểu nút</Label>
              <Select value={form.button_style} onValueChange={(v) => setField("button_style", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STYLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Channel ID để gửi panel</Label>
              <Input placeholder="Nhập channel ID..." value={form.channel_id} onChange={(e) => setField("channel_id", e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Category ID cho channel ticket</Label>
              <Input placeholder="Nhập category ID..." value={form.category_id} onChange={(e) => setField("category_id", e.target.value)} />
            </div>

            <Separator />

            {/* Discord preview */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Xem trước trên Discord</Label>
              <div className="rounded-lg border bg-muted/30 overflow-hidden">
                <div className="flex">
                  <div className="w-1.5 shrink-0" style={{ backgroundColor: form.color }} />
                  <div className="p-3 flex-1 min-w-0">
                    <p className="font-semibold text-sm">{form.title || "Tiêu đề"}</p>
                    <p className="text-xs text-muted-foreground mt-1">{form.description || "Mô tả..."}</p>
                  </div>
                </div>
                <div className="px-3 pb-3">
                  <div className={cn("inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium", STYLE_COLORS[form.button_style] || STYLE_COLORS.primary)}>
                    <span>{form.button_emoji}</span>
                    {form.button_label || "Nút"}
                  </div>
                </div>
              </div>
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setSheetOpen(false); setEditingPanel(null); }}>Hủy</Button>
              <Button className="flex-1" disabled={!form.name.trim() || isSaving} onClick={handleSave}>
                {isSaving ? "Đang lưu..." : editingPanel ? "Cập nhật" : "Tạo"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirm ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xóa panel?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Panel <strong>{deleteTarget?.name}</strong> sẽ bị xóa vĩnh viễn.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Hủy</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
