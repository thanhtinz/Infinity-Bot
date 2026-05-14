import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { FileQuestion, Plus, Pencil, Trash2, GripVertical, X } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormQuestion {
  label: string;
  placeholder: string;
  required: boolean;
  style: "short" | "paragraph";
}

interface TicketFormType {
  id: number;
  guild_id?: string;
  panel_id?: number | null;
  name: string;
  questions: FormQuestion[];
  created_at?: string;
}

interface TicketPanel {
  id: number;
  name: string;
  title?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EMPTY_QUESTION: FormQuestion = {
  label: "",
  placeholder: "",
  required: false,
  style: "short",
};

const MAX_QUESTIONS = 5;

// ─── Component ───────────────────────────────────────────────────────────────

export function TicketForms() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<TicketFormType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TicketFormType | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPanelId, setFormPanelId] = useState<string>("none");
  const [questions, setQuestions] = useState<FormQuestion[]>([]);

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: forms, isLoading } = useQuery({
    queryKey: ["ticket-forms"],
    queryFn: () => fetch("/api/ticket-forms").then((r) => r.json()),
    staleTime: 30_000,
  });

  const { data: panels } = useQuery({
    queryKey: ["ticket-panels"],
    queryFn: () => fetch("/api/ticket-panels").then((r) => r.json()),
    staleTime: 30_000,
  });

  // ─── Mutations ───────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/ticket-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-forms"] });
      toast({ title: "Đã tạo form thành công" });
      closeSheet();
    },
    onError: () => toast({ title: "Lỗi khi tạo form", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/ticket-forms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-forms"] });
      toast({ title: "Đã cập nhật form" });
      closeSheet();
    },
    onError: () => toast({ title: "Lỗi khi cập nhật", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/ticket-forms/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-forms"] });
      toast({ title: "Đã xóa form" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Lỗi khi xóa", variant: "destructive" }),
  });

  // ─── Handlers ────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingForm(null);
    setFormName("Form mặc định");
    setFormPanelId("none");
    setQuestions([]);
    setSheetOpen(true);
  }

  function openEdit(f: TicketFormType) {
    setEditingForm(f);
    setFormName(f.name);
    setFormPanelId(f.panel_id != null ? String(f.panel_id) : "none");
    setQuestions(f.questions?.length ? [...f.questions] : []);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditingForm(null);
  }

  function handleSave() {
    const payload = {
      name: formName,
      panel_id: formPanelId === "none" ? null : Number(formPanelId),
      questions,
    };
    if (editingForm) {
      updateMutation.mutate({ id: editingForm.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function addQuestion() {
    if (questions.length >= MAX_QUESTIONS) return;
    setQuestions([...questions, { ...EMPTY_QUESTION }]);
  }

  function updateQuestion(idx: number, field: keyof FormQuestion, value: string | boolean) {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], [field]: value };
    setQuestions(updated);
  }

  function removeQuestion(idx: number) {
    setQuestions(questions.filter((_, i) => i !== idx));
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function getPanelName(panelId: number | null | undefined): string {
    if (!panelId || !panels) return "—";
    const p = (panels as TicketPanel[]).find((pp) => pp.id === panelId);
    return p ? p.name : "—";
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const formList = (forms as TicketFormType[] | undefined) ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ticket Forms</h1>
          <p className="text-muted-foreground text-sm">
            Tạo form câu hỏi người dùng phải điền trước khi mở ticket
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Tạo form mới
        </Button>
      </div>

      {/* Grid */}
      {formList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileQuestion className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Chưa có form nào</p>
          <p className="text-sm">Tạo form để yêu cầu người dùng điền thông tin trước khi mở ticket</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {formList.map((f) => (
            <Card
              key={f.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => openEdit(f)}
            >
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{f.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Panel: {getPanelName(f.panel_id)}
                    </p>
                  </div>
                  <Badge variant="secondary">{f.questions?.length ?? 0} câu hỏi</Badge>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(f);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(f);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Dialog Editor ── */}
      <Dialog open={sheetOpen} onOpenChange={(open) => { if (!open) closeSheet(); }}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingForm ? "Chỉnh sửa form" : "Tạo form mới"}</DialogTitle>
            <DialogDescription>
              {editingForm ? "Cập nhật thông tin và câu hỏi" : "Thiết lập form câu hỏi cho ticket"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="form" className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="form" className="flex-1">Form</TabsTrigger>
              <TabsTrigger value="questions" className="flex-1">Câu hỏi</TabsTrigger>
            </TabsList>

            {/* Tab 1: Form info */}
            <TabsContent value="form" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Tên form</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Form mặc định"
                />
              </div>
              <div className="space-y-2">
                <Label>Panel gắn với</Label>
                <Select value={formPanelId} onValueChange={setFormPanelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn panel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không gắn panel</SelectItem>
                    {((panels as TicketPanel[] | undefined) ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{questions.length} câu hỏi</Badge>
                <span className="text-xs text-muted-foreground">(tối đa {MAX_QUESTIONS})</span>
              </div>
            </TabsContent>

            {/* Tab 2: Questions */}
            <TabsContent value="questions" className="space-y-3 mt-4">
              {questions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Chưa có câu hỏi nào. Nhấn nút bên dưới để thêm.
                </div>
              ) : (
                questions.map((q, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border p-3 space-y-3 relative"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Câu {idx + 1}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeQuestion(idx)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Input
                        placeholder="Nhãn câu hỏi"
                        value={q.label}
                        onChange={(e) => updateQuestion(idx, "label", e.target.value)}
                      />
                      <Input
                        placeholder="Placeholder"
                        value={q.placeholder}
                        onChange={(e) => updateQuestion(idx, "placeholder", e.target.value)}
                      />
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Bắt buộc</Label>
                        <Switch
                          checked={q.required}
                          onCheckedChange={(v) => updateQuestion(idx, "required", v)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Kiểu nhập</Label>
                        <Select
                          value={q.style}
                          onValueChange={(v) => updateQuestion(idx, "style", v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="short">Ngắn (1 dòng)</SelectItem>
                            <SelectItem value="paragraph">Đoạn văn (nhiều dòng)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {questions.length < MAX_QUESTIONS && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={addQuestion}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm câu hỏi
                </Button>
              )}
            </TabsContent>
          </Tabs>

          <Separator className="my-4" />

          {/* Footer */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={closeSheet}>
              Hủy
            </Button>
            {editingForm && (
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  setDeleteTarget(editingForm);
                }}
              >
                Xóa
              </Button>
            )}
            <Button
              className="flex-1"
              disabled={!formName.trim() || isSaving}
              onClick={handleSave}
            >
              {isSaving ? "Đang lưu..." : editingForm ? "Cập nhật" : "Tạo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xóa form?</DialogTitle>
            <DialogDescription>
              Form <strong className="text-foreground">{deleteTarget?.name}</strong> sẽ bị xóa vĩnh viễn.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Hủy
            </Button>
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
