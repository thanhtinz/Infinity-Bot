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
  MessageCircleReply,
  Plus,
} from "lucide-react";

import type { AutoResponderRule } from "./auto-responder/arTypes";
import { RuleCard } from "./auto-responder/RuleCard";

// ─── Main Component ──────────────────────────────────────────────────────────

export function AutoResponder() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // ── State ──
  const [deleteTarget, setDeleteTarget] = useState<AutoResponderRule | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: rules = [], isLoading } = useQuery<AutoResponderRule[]>({
    queryKey: ["auto-responders"],
    queryFn: () =>
      fetch("/api/auto-responders", { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      }),
    staleTime: 60_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: (id: number) =>
      fetch(`/api/auto-responders/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auto-responders"] });
      setDeleteTarget(null);
      toast({ title: "Đã xóa rule" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi xóa rule",
        description: e.message,
      }),
  });

  const toggleMutation = useMutation<any, Error, number>({
    mutationFn: (id: number) =>
      fetch(`/api/auto-responders/${id}/toggle`, {
        method: "PUT",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auto-responders"] });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi toggle",
        description: e.message,
      }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    navigate("/autoresponder/new");
  };

  const openEdit = (rule: AutoResponderRule) => {
    navigate("/autoresponder/" + rule.id + "/edit");
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageCircleReply className="w-6 h-6" />
            Auto Responder
          </h2>
          <p className="text-muted-foreground mt-1">
            Tự động phản hồi khi tin nhắn khớp với điều kiện
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo rule
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      )}

      {/* Empty state */}
      {!isLoading && rules.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircleReply className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium">Chưa có auto responder nào</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tạo rule để bot tự động phản hồi khi tin nhắn khớp điều kiện.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo rule
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grid of rules */}
      {!isLoading && rules.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => openEdit(rule)}
              onDelete={() => setDeleteTarget(rule)}
              onToggle={() => toggleMutation.mutate(rule.id)}
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
            <DialogTitle>Xóa rule?</DialogTitle>
            <DialogDescription>
              Rule <strong>{deleteTarget?.name}</strong> sẽ bị xóa vĩnh viễn.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
