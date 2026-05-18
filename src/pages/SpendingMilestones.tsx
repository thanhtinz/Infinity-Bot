import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";
import { RoleSelect } from "@/components/RoleSelect";
import { Trophy, Plus, Pencil, Trash2, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface Milestone {
  id: number;
  name: string;
  threshold: number;
  role_id: string;
  emoji: string | null;
  active: boolean;
}

const emptyForm = { name: "", threshold: "", role_id: "", emoji: "", active: true };

export default function SpendingMilestones() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: milestones = [], isLoading } = useQuery<Milestone[]>({
    queryKey: ["milestones"],
    queryFn: () => apiFetch("/api/shop/milestones").then((r) => r.json()),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        threshold: parseFloat(form.threshold),
        role_id: form.role_id,
        emoji: form.emoji || null,
        active: form.active,
      };
      if (editId) {
        await apiFetch(`/api/shop/milestones/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/api/shop/milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milestones"] });
      setDialogOpen(false);
      toast({ title: editId ? "Milestone updated" : "Milestone created" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/shop/milestones/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milestones"] });
      setDeleteId(null);
      toast({ title: "Milestone deleted" });
    },
  });

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(m: Milestone) {
    setEditId(m.id);
    setForm({
      name: m.name,
      threshold: String(m.threshold),
      role_id: m.role_id,
      emoji: m.emoji || "",
      active: m.active,
    });
    setDialogOpen(true);
  }

  function formatVND(n: number) {
    return new Intl.NumberFormat("en-US").format(n) + " VND";
  }

  const sorted = [...milestones].sort((a, b) => a.threshold - b.threshold);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Spending Milestones
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Automatically grant roles when customers reach spending milestones
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add Milestone
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No spending milestones yet</p>
            <p className="text-sm mt-1">
              Create milestones to automatically grant roles when customers reach a spending threshold
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sorted.map((m, i) => (
            <Card
              key={m.id}
              className={cn(
                "transition-opacity",
                !m.active && "opacity-50"
              )}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-yellow-500/10 text-yellow-500 font-bold text-lg shrink-0">
                  {m.emoji || (i + 1)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    {m.name}
                    {!m.active && (
                      <span className="text-xs text-muted-foreground">(off)</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Milestone {formatVND(m.threshold)} → Role: {m.role_id}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(m)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(m.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editId ? "Edit Spending Milestone" : "Add Spending Milestone"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Milestone Name</Label>
              <Input
                placeholder="e.g. VIP, Diamond, Gold..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Spending Threshold (VND)</Label>
              <Input
                type="number"
                placeholder="500000"
                value={form.threshold}
                onChange={(e) =>
                  setForm({ ...form, threshold: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Role to Grant</Label>
              <RoleSelect
                value={form.role_id}
                onChange={(v) => setForm({ ...form, role_id: v })}
                guildId={selectedGuildId || undefined}
              />
            </div>

            <div className="space-y-2">
              <Label>Emoji (optional)</Label>
              <Input
                placeholder="🏆 or leave empty"
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label>Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={
                !form.name || !form.threshold || !form.role_id || save.isPending
              }
            >
              {save.isPending ? "Saving..." : editId ? "Update" : "Create Milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Spending Milestone?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            This action cannot be undone. Customers who already received the role
            will not lose it.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && remove.mutate(deleteId)}
              disabled={remove.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
