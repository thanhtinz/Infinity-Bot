import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Terminal,
  Plus,
} from "lucide-react";
import type { CustomCommand } from "./custom-commands/ccTypes";
import { CommandCard } from "./custom-commands/CommandCard";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";

// ─── Main Component ──────────────────────────────────────────────────────────

export function CustomCommands() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t } = useT();

  // ── State ──
  const [deleteTarget, setDeleteTarget] = useState<CustomCommand | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: commands = [], isLoading } = useQuery<CustomCommand[]>({
    queryKey: ["custom-commands"],
    queryFn: () =>
      apiFetch("/api/custom-commands").then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: (id: number) =>
      apiFetch(`/api/custom-commands/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-commands"] });
      setDeleteTarget(null);
      toast({ title: t("toast_commandDeleted") });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: t("cc_errorDeleting"),
        description: e.message,
      }),
  });

  const toggleMutation = useMutation<any, Error, number>({
    mutationFn: (id: number) =>
      apiFetch(`/api/custom-commands/${id}/toggle`, {
        method: "PUT",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-commands"] });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: t("cc_toggleError"),
        description: e.message,
      }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    navigate("/custom-commands/new");
  };

  const openEdit = (cmd: CustomCommand) => {
    navigate("/custom-commands/" + cmd.id + "/edit");
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Terminal className="w-6 h-6" />
            {t("cc_title")}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t("cc_desc")}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          {t("cc_addCommand")}
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}

      {/* Empty state */}
      {!isLoading && commands.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Terminal className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium">{t("cc_empty")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("cc_emptyDesc")}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              {t("cc_addCommand")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grid of commands */}
      {!isLoading && commands.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {commands.map((cmd) => (
            <CommandCard
              key={cmd.id}
              command={cmd}
              onEdit={() => openEdit(cmd)}
              onDelete={() => setDeleteTarget(cmd)}
              onToggle={() => toggleMutation.mutate(cmd.id)}
              togglePending={toggleMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("cc_deleteConfirm")}</DialogTitle>
            <DialogDescription>
              {t("cc_deleteDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              {deleteMutation.isPending ? t("deleting") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
