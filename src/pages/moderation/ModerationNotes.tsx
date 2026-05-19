import { useState } from "react";
import { useT } from "@/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmojiTextarea } from "@/components/EmojiInput";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import { FileText, Trash2, Search, Pencil, Plus } from "lucide-react";
import type { ModNote } from "./shared";
import { formatDate } from "./shared";

export function ModerationNotes() {
  const { t } = useT();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [noteSearch, setNoteSearch] = useState("");
  const [newNoteTarget, setNewNoteTarget] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editNoteTarget, setEditNoteTarget] = useState<ModNote | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [deleteNoteTarget, setDeleteNoteTarget] = useState<ModNote | null>(null);

  // ── Queries ──

  const { data: notes = [], isLoading: notesLoading } = useQuery<ModNote[]>({
    queryKey: ["moderation-notes", noteSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      if (noteSearch.trim()) params.set("target_id", noteSearch.trim());
      return apiFetch(`/api/moderation/notes?${params}`).then((r) => r.json());
    },
  });

  // ── Mutations ──

  const addNoteMutation = useMutation({
    mutationFn: (body: { target_id: string; content: string }) =>
      apiFetch("/api/moderation/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Add note failed");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-notes"] });
      qc.invalidateQueries({ queryKey: ["moderation-stats"] });
      setNewNoteTarget("");
      setNewNoteContent("");
      toast({ title: t("toast_noteAdded") });
    },
    onError: () =>
      toast({ title: t("toast_noteAddFailed"), variant: "destructive" }),
  });

  const editNoteMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      apiFetch(`/api/moderation/notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }).then((r) => {
        if (!r.ok) throw new Error("Edit note failed");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-notes"] });
      setEditNoteTarget(null);
      setEditNoteContent("");
      toast({ title: t("toast_noteUpdated") });
    },
    onError: () =>
      toast({ title: t("toast_noteUpdateFailed"), variant: "destructive" }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/moderation/notes/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Delete note failed");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-notes"] });
      qc.invalidateQueries({ queryKey: ["moderation-stats"] });
      setDeleteNoteTarget(null);
      toast({ title: t("toast_noteDeleted") });
    },
    onError: () =>
      toast({ title: t("toast_noteDeleteFailed"), variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-green-500" />
          {t("mod_notes")}
        </h2>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("mod_searchNotes")}
          value={noteSearch}
          onChange={(e) => setNoteSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ── Add note form ── */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Plus className="h-4 w-4" />
            {t("mod_addNote")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3">
            <Input
              placeholder={t("target")}
              value={newNoteTarget}
              onChange={(e) => setNewNoteTarget(e.target.value)}
            />
            <EmojiTextarea
              placeholder={t("mod_noteContent")}
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={
                addNoteMutation.isPending ||
                !newNoteTarget.trim() ||
                !newNoteContent.trim()
              }
              onClick={() =>
                addNoteMutation.mutate({
                  target_id: newNoteTarget.trim(),
                  content: newNoteContent.trim(),
                })
              }
            >
              {addNoteMutation.isPending ? t("saving") : t("mod_addNote")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Notes list ── */}
      {notesLoading && notes.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          {t("loading")}
        </div>
      ) : notes.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          {t("mod_noNotes")}
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <Card key={n.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{n.target_id}</span>
                      <span>•</span>
                      <span>{t("mod_addedBy")} {n.author_id}</span>
                      <span>•</span>
                      <span>{formatDate(n.created_at)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditNoteTarget(n);
                        setEditNoteContent(n.content);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteNoteTarget(n)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Edit Note Dialog ── */}
      <Dialog
        open={!!editNoteTarget}
        onOpenChange={(o) => {
          if (!o) {
            setEditNoteTarget(null);
            setEditNoteContent("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("mod_editNote")}</DialogTitle>
          </DialogHeader>
          <EmojiTextarea
            value={editNoteContent}
            onChange={(e) => setEditNoteContent(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditNoteTarget(null);
                setEditNoteContent("");
              }}
            >
              {t("cancel")}
            </Button>
            <Button
              disabled={editNoteMutation.isPending || !editNoteContent.trim()}
              onClick={() =>
                editNoteTarget &&
                editNoteMutation.mutate({
                  id: editNoteTarget.id,
                  content: editNoteContent.trim(),
                })
              }
            >
              {editNoteMutation.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Note Dialog ── */}
      <Dialog open={!!deleteNoteTarget} onOpenChange={(o) => !o && setDeleteNoteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("mod_deleteCase")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("mod_deleteCaseConfirm")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteNoteTarget(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteNoteMutation.isPending}
              onClick={() => deleteNoteTarget && deleteNoteMutation.mutate(deleteNoteTarget.id)}
            >
              {deleteNoteMutation.isPending ? t("saving") : t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
