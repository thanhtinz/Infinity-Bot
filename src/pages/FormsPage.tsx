import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import { useDiscordChannels, useDiscordRoles } from "@/hooks/useDiscordData";
import type { DiscordChannel } from "@/hooks/useDiscordData";
import { useGuild } from "@/contexts/GuildContext";
import {
  ClipboardList, Plus, Trash2, Loader2, CheckCircle, XCircle,
  Clock, Eye, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/infinity";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormQuestion {
  label: string;
  placeholder: string;
  required: boolean;
}

interface FormTemplate {
  id: number;
  guild_id: string;
  title: string;
  description?: string;
  questions: FormQuestion[];
  response_channel_id?: string;
  review_role_id?: string;
  is_active: boolean;
  created_at?: string;
}

interface FormSubmission {
  id: number;
  template_id: number;
  user_id: string;
  answers: Record<string, string>;
  status: "pending" | "approved" | "rejected";
  review_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at?: string;
}

interface FormStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  approved: "bg-green-500/15 text-green-600 dark:text-green-400",
  rejected: "bg-red-500/15 text-red-600 dark:text-red-400",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function FormsPage() {
  const { toast } = useToast();
  const { selectedGuildId } = useGuild();
  const qc = useQueryClient();
  const { data: allChannels = [] } = useDiscordChannels();
  const { data: allRoles = [] } = useDiscordRoles();
  const textChannels = allChannels.filter((c: DiscordChannel) => c.type === 0 || c.type === 5);

  // ── Template form state ──────────────────────────────────────────────────

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formQuestions, setFormQuestions] = useState<FormQuestion[]>([{ label: "", placeholder: "", required: false }]);
  const [formChannelId, setFormChannelId] = useState("");
  const [formReviewRoleId, setFormReviewRoleId] = useState("");

  // ── Submission filter state ──────────────────────────────────────────────

  const [filterTemplateId, setFilterTemplateId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // ── Review dialog state ──────────────────────────────────────────────────

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewSubmission, setReviewSubmission] = useState<FormSubmission | null>(null);
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");
  const [reviewNote, setReviewNote] = useState("");

  // ── Delete confirm ───────────────────────────────────────────────────────

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: templates = [], isLoading: templatesLoading } = useQuery<FormTemplate[]>({
    queryKey: ["forms-templates", selectedGuildId],
    queryFn: () => apiFetch("/api/forms/templates").then((r) => r.json()),
    enabled: !!selectedGuildId,
  });

  const { data: submissions = [] } = useQuery<FormSubmission[]>({
    queryKey: ["forms-submissions", selectedGuildId, filterTemplateId, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterTemplateId !== "all") params.set("template_id", filterTemplateId);
      if (filterStatus !== "all") params.set("status", filterStatus);
      const qs = params.toString();
      return apiFetch(`/api/forms/submissions${qs ? `?${qs}` : ""}`).then((r) => r.json());
    },
    enabled: !!selectedGuildId,
  });

  const { data: stats } = useQuery<FormStats>({
    queryKey: ["forms-stats", selectedGuildId],
    queryFn: () => apiFetch("/api/forms/submissions/stats").then((r) => r.json()),
    enabled: !!selectedGuildId,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const createTemplateMutation = useMutation({
    mutationFn: (data: Partial<FormTemplate>) =>
      apiFetch("/api/forms/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forms-templates", selectedGuildId] });
      closeTemplateDialog();
      toast({ title: "Template created." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to create template." }),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<FormTemplate>) =>
      apiFetch(`/api/forms/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forms-templates", selectedGuildId] });
      closeTemplateDialog();
      toast({ title: "Template updated." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to update template." }),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/forms/templates/${id}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forms-templates", selectedGuildId] });
      setConfirmDeleteId(null);
      toast({ title: "Template deleted." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to delete template." }),
  });

  const toggleTemplateMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      apiFetch(`/api/forms/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onMutate: async ({ id, is_active }) => {
      await qc.cancelQueries({ queryKey: ["forms-templates", selectedGuildId] });
      const prev = qc.getQueryData<FormTemplate[]>(["forms-templates", selectedGuildId]);
      qc.setQueryData<FormTemplate[]>(["forms-templates", selectedGuildId], (old) =>
        old?.map((t) => (t.id === id ? { ...t, is_active } : t))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["forms-templates", selectedGuildId], ctx.prev);
      toast({ variant: "destructive", title: "Failed to toggle template." });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["forms-templates", selectedGuildId] }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, review_note }: { id: number; status: string; review_note?: string }) =>
      apiFetch(`/api/forms/submissions/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, review_note }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forms-submissions", selectedGuildId] });
      qc.invalidateQueries({ queryKey: ["forms-stats", selectedGuildId] });
      setReviewDialogOpen(false);
      setReviewSubmission(null);
      setReviewNote("");
      toast({ title: "Submission reviewed." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to review submission." }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  function closeTemplateDialog() {
    setTemplateDialogOpen(false);
    setEditTemplateId(null);
    setFormTitle("");
    setFormDescription("");
    setFormQuestions([{ label: "", placeholder: "", required: false }]);
    setFormChannelId("");
    setFormReviewRoleId("");
  }

  function openEditTemplate(t: FormTemplate) {
    setEditTemplateId(t.id);
    setFormTitle(t.title);
    setFormDescription(t.description ?? "");
    setFormQuestions(t.questions.length > 0 ? t.questions : [{ label: "", placeholder: "", required: false }]);
    setFormChannelId(t.response_channel_id ?? "");
    setFormReviewRoleId(t.review_role_id ?? "");
    setTemplateDialogOpen(true);
  }

  function updateQuestion(index: number, field: keyof FormQuestion, value: string | boolean) {
    setFormQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)));
  }

  function addQuestion() {
    setFormQuestions((prev) => [...prev, { label: "", placeholder: "", required: false }]);
  }

  function removeQuestion(index: number) {
    setFormQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  const channelName = (id?: string) => {
    if (!id) return "—";
    const ch = textChannels.find((c) => c.id === id);
    return ch ? `#${ch.name}` : id;
  };

  const roleName = (id?: string) => {
    if (!id) return "—";
    const r = allRoles.find((role) => role.id === id);
    return r ? r.name : id;
  };

  const templateTitle = (id: number) => templates.find((t) => t.id === id)?.title ?? `#${id}`;

  // ── Render ───────────────────────────────────────────────────────────────

  if (templatesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <PageContainer size="md">
      <PageHeader title="Forms" description="Create form templates and review submissions from your members." icon={ClipboardList} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground"><FileText className="h-4 w-4" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-yellow-500/10 text-yellow-600"><Clock className="h-4 w-4" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.pending ?? 0}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-green-500/10 text-green-600"><CheckCircle className="h-4 w-4" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.approved ?? 0}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-red-500/10 text-red-600"><XCircle className="h-4 w-4" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.rejected ?? 0}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Templates / Submissions */}
      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
        </TabsList>

        {/* ── Templates Tab ──────────────────────────────────────────────── */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5" onClick={() => setTemplateDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Create Template
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No form templates yet. Create one to start collecting submissions.
                </div>
              ) : (
                <div className="divide-y">
                  {templates.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{t.title}</span>
                          <Badge variant="outline" className="text-xs">{t.questions.length} question{t.questions.length !== 1 ? "s" : ""}</Badge>
                        </div>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Responses: {channelName(t.response_channel_id)}</span>
                          <span>Review: {roleName(t.review_role_id)}</span>
                        </div>
                      </div>
                      <Switch checked={t.is_active} onCheckedChange={(checked) => toggleTemplateMutation.mutate({ id: t.id, is_active: checked })} />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditTemplate(t)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {confirmDeleteId === t.id ? (
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteTemplateMutation.mutate(t.id)}>Confirm</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDeleteId(t.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Submissions Tab ────────────────────────────────────────────── */}
        <TabsContent value="submissions" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={filterTemplateId} onValueChange={setFilterTemplateId}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Templates" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Templates</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {submissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No submissions found.</div>
              ) : (
                <div className="divide-y">
                  {submissions.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{templateTitle(s.template_id)}</span>
                          <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[s.status])}>{s.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">User: {s.user_id}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {Object.values(s.answers).slice(0, 2).join(" / ")}
                          {Object.keys(s.answers).length > 2 ? " ..." : ""}
                        </p>
                      </div>
                      {s.status === "pending" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                          setReviewSubmission(s);
                          setReviewAction("approved");
                          setReviewNote("");
                          setReviewDialogOpen(true);
                        }}>
                          Review
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Create/Edit Template Dialog ──────────────────────────────────── */}
      <Dialog open={templateDialogOpen} onOpenChange={(open) => { if (!open) closeTemplateDialog(); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTemplateId ? "Edit Template" : "Create Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Form title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Optional description" rows={2} />
            </div>

            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Questions</Label>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addQuestion}>
                <Plus className="h-3 w-3" /> Add Question
              </Button>
            </div>

            {formQuestions.map((q, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Question {i + 1}</span>
                  {formQuestions.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeQuestion(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Input value={q.label} onChange={(e) => updateQuestion(i, "label", e.target.value)} placeholder="Question label" />
                <Input value={q.placeholder} onChange={(e) => updateQuestion(i, "placeholder", e.target.value)} placeholder="Placeholder (optional)" />
                <div className="flex items-center gap-2">
                  <Switch checked={q.required} onCheckedChange={(v) => updateQuestion(i, "required", v)} />
                  <Label className="text-xs">Required</Label>
                </div>
              </div>
            ))}

            <Separator />
            <div className="space-y-2">
              <Label>Response Channel</Label>
              <Select value={formChannelId} onValueChange={setFormChannelId}>
                <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                <SelectContent>
                  {textChannels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Review Role</Label>
              <Select value={formReviewRoleId} onValueChange={setFormReviewRoleId}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {allRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeTemplateDialog}>Cancel</Button>
            <Button
              disabled={!formTitle || formQuestions.every((q) => !q.label) || createTemplateMutation.isPending || updateTemplateMutation.isPending}
              onClick={() => {
                const payload = {
                  title: formTitle,
                  description: formDescription || undefined,
                  questions: formQuestions.filter((q) => q.label),
                  response_channel_id: formChannelId || undefined,
                  review_role_id: formReviewRoleId || undefined,
                };
                if (editTemplateId) {
                  updateTemplateMutation.mutate({ id: editTemplateId, ...payload });
                } else {
                  createTemplateMutation.mutate(payload);
                }
              }}
            >
              {(createTemplateMutation.isPending || updateTemplateMutation.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editTemplateId ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Review Submission Dialog ─────────────────────────────────────── */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Submission</DialogTitle>
          </DialogHeader>
          {reviewSubmission && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Answers</Label>
                <div className="space-y-1 rounded-lg border p-3 max-h-48 overflow-y-auto">
                  {Object.entries(reviewSubmission.answers).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <span className="font-medium">{key}:</span> <span className="text-muted-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Decision</Label>
                <Select value={reviewAction} onValueChange={(v) => setReviewAction(v as "approved" | "rejected")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approve</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Add a review note" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={reviewMutation.isPending}
              onClick={() => {
                if (reviewSubmission) {
                  reviewMutation.mutate({ id: reviewSubmission.id, status: reviewAction, review_note: reviewNote || undefined });
                }
              }}
            >
              {reviewMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
