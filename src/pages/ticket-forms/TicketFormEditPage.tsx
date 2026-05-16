import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { EmojiPicker } from "@/components/EmojiPicker";
import { ArrowLeft, Plus, GripVertical, X } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";

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

export function TicketFormEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !id;

  const [formName, setFormName] = useState("Form mặc định");
  const [formPanelId, setFormPanelId] = useState<string>("none");
  const [questions, setQuestions] = useState<FormQuestion[]>([]);

  const { data: forms, isLoading } = useQuery({
    queryKey: ["ticket-forms"],
    queryFn: () => apiFetch("/api/ticket-forms").then((r) => r.json()),
    enabled: !isNew,
    staleTime: 60_000,
  });

  const { data: panels } = useQuery({
    queryKey: ["ticket-panels"],
    queryFn: () => apiFetch("/api/ticket-panels").then((r) => r.json()),
    staleTime: 30_000,
  });

  const item = id ? (forms as TicketFormType[] | undefined)?.find((f) => String(f.id) === id) : undefined;

  useEffect(() => {
    if (item) {
      setFormName(item.name);
      setFormPanelId(item.panel_id != null ? String(item.panel_id) : "none");
      setQuestions(item.questions?.length ? [...item.questions] : []);
    }
  }, [item?.id]);

  // ── Mutations ───────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/api/ticket-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-forms"] });
      navigate(-1);
      toast({ title: "Đã tạo form thành công" });
    },
    onError: () => toast({ title: "Lỗi khi tạo form", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id: formId, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/ticket-forms/${formId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-forms"] });
      navigate(-1);
      toast({ title: "Đã cập nhật form" });
    },
    onError: () => toast({ title: "Lỗi khi cập nhật", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSave() {
    const payload = {
      name: formName,
      panel_id: formPanelId === "none" ? null : Number(formPanelId),
      questions,
    };
    if (!isNew && id) {
      updateMutation.mutate({ id: Number(id), ...payload });
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

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-card px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold text-lg">{isNew ? "Tạo mới" : "Edit"}</h1>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={!formName.trim() || isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <Tabs defaultValue="form">
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
                    <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                      <Input
                        placeholder="Nhãn câu hỏi"
                        value={q.label}
                        onChange={(e) => updateQuestion(idx, "label", e.target.value)}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <EmojiPicker onSelect={(em) => updateQuestion(idx, "label", q.label + em)} />
                    </div>
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
      </div>
    </div>
  );
}
