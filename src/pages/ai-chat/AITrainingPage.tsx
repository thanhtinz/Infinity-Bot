import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/useApi";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Plus, Trash2, Upload, FileText, Eye, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrainingDoc } from "./shared";

export function AITrainingPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [docDialog, setDocDialog] = useState(false);
  const [viewDoc, setViewDoc] = useState<TrainingDoc | null>(null);
  const [docForm, setDocForm] = useState({ title: "", content: "" });

  const { data: docs = [], isLoading: docsLoading } = useQuery<TrainingDoc[]>({
    queryKey: ["ai-training-docs"],
    queryFn: () => apiFetch("/api/ai-chat/training").then(r => r.json()),
  });

  const addDocMutation = useMutation({
    mutationFn: (d: typeof docForm) =>
      apiFetch("/api/ai-chat/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-training-docs"] });
      setDocDialog(false); setDocForm({ title: "", content: "" });
      toast({ title: "Document added" });
    },
  });

  const toggleDocMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      apiFetch(`/api/ai-chat/training/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-training-docs"] }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/ai-chat/training/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-training-docs"] });
      toast({ title: "Document deleted" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiFetch("/api/ai-chat/training/upload", { method: "POST", body: fd });
    if (res.ok) {
      qc.invalidateQueries({ queryKey: ["ai-training-docs"] });
      toast({ title: "File uploaded" });
    } else {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    e.target.value = "";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 py-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Training</h1>
          <p className="text-sm text-muted-foreground">Knowledge base for your AI assistant</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold">Knowledge Base</p>
          <p className="text-sm text-muted-foreground">
            {docs.length} document{docs.length !== 1 ? "s" : ""} · injected as system context
          </p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".txt,.md,.pdf" className="hidden" onChange={handleFileUpload} />
            <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium hover:bg-accent cursor-pointer transition-colors">
              <Upload className="h-3.5 w-3.5" />Upload File
            </div>
          </label>
          <Button size="sm" className="gap-1.5" onClick={() => setDocDialog(true)}>
            <Plus className="h-3.5 w-3.5" />Add Text
          </Button>
        </div>
      </div>

      {docsLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-14 border-2 border-dashed rounded-xl text-muted-foreground">
          <BookOpen className="h-10 w-10 opacity-25" />
          <p className="font-medium">No training documents yet</p>
          <p className="text-sm">Add text or upload files to teach the AI about your server</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <Card key={doc.id} className={cn("transition-opacity", !doc.enabled && "opacity-50")}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="shrink-0 text-muted-foreground">
                  {doc.doc_type === "file" ? <Upload className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{doc.title}</p>
                    <Badge variant="outline" className="text-xs">{doc.doc_type}</Badge>
                    <span className="text-xs text-muted-foreground">{doc.char_count.toLocaleString()} chars</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.content_preview}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewDoc(doc)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Switch
                    checked={doc.enabled}
                    onCheckedChange={v => toggleDocMutation.mutate({ id: doc.id, enabled: v })}
                  />
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteDocMutation.mutate(doc.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add doc dialog */}
      <Dialog open={docDialog} onOpenChange={setDocDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Training Document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Server Rules, Product FAQ…"
                value={docForm.title}
                onChange={e => setDocForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <Textarea
                placeholder="Enter the knowledge content here…"
                className="min-h-[200px] resize-none"
                value={docForm.content}
                onChange={e => setDocForm(f => ({ ...f, content: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{docForm.content.length.toLocaleString()} chars</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialog(false)}>Cancel</Button>
            <Button
              onClick={() => addDocMutation.mutate(docForm)}
              disabled={addDocMutation.isPending || !docForm.title || !docForm.content}
            >
              {addDocMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View doc dialog */}
      <Dialog open={!!viewDoc} onOpenChange={() => setViewDoc(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{viewDoc?.title}</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <pre className="text-xs whitespace-pre-wrap font-mono p-1">{viewDoc?.content_preview}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
