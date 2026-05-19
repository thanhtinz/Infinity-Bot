import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import { useDiscordRoles } from "@/hooks/useDiscordData";
import { useGuild } from "@/contexts/GuildContext";
import {
  UserPlus, Plus, Trash2, Loader2, Clock, Bot, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/yuri";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AutoRoleRule {
  id: number;
  guild_id: string;
  role_id: string;
  trigger_type: "join" | "delay" | "bot";
  delay_seconds?: number;
  is_enabled: boolean;
  created_at?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  join: "On Join",
  delay: "Delayed",
  bot: "Bot Join",
};

const TRIGGER_COLORS: Record<string, string> = {
  join: "bg-green-500/15 text-green-600 dark:text-green-400",
  delay: "bg-primary/15 text-primary dark:text-primary/80",
  bot: "bg-secondary/15 text-secondary dark:text-secondary/80",
};

function formatDelay(seconds?: number) {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AutoRolePage() {
  const { toast } = useToast();
  const { selectedGuildId } = useGuild();
  const qc = useQueryClient();
  const { data: roles = [] } = useDiscordRoles();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formRoleId, setFormRoleId] = useState("");
  const [formTrigger, setFormTrigger] = useState<"join" | "delay" | "bot">("join");
  const [formDelay, setFormDelay] = useState(60);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: rules = [], isLoading } = useQuery<AutoRoleRule[]>({
    queryKey: ["autorole", selectedGuildId],
    queryFn: () => apiFetch("/api/autorole").then((r) => r.json()),
    enabled: !!selectedGuildId,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: { role_id: string; trigger_type: string; delay_seconds?: number }) =>
      apiFetch("/api/autorole", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["autorole", selectedGuildId] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Auto role rule created." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to create rule." }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_enabled }: { id: number; is_enabled: boolean }) =>
      apiFetch(`/api/autorole/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onMutate: async ({ id, is_enabled }) => {
      await qc.cancelQueries({ queryKey: ["autorole", selectedGuildId] });
      const prev = qc.getQueryData<AutoRoleRule[]>(["autorole", selectedGuildId]);
      qc.setQueryData<AutoRoleRule[]>(["autorole", selectedGuildId], (old) =>
        old?.map((r) => (r.id === id ? { ...r, is_enabled } : r))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["autorole", selectedGuildId], ctx.prev);
      toast({ variant: "destructive", title: "Failed to toggle rule." });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["autorole", selectedGuildId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/autorole/${id}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["autorole", selectedGuildId] });
      setConfirmDeleteId(null);
      toast({ title: "Rule deleted." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to delete rule." }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  function resetForm() {
    setFormRoleId("");
    setFormTrigger("join");
    setFormDelay(60);
  }

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <PageContainer size="sm">
      <PageHeader title="Auto Role" description="Automatically assign roles when members join the server or after a delay." icon={UserPlus}>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Add Rule
        </Button>
      </PageHeader>

      {/* Rules List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auto Role Rules</CardTitle>
          <CardDescription>Manage automatic role assignment rules for your server.</CardDescription>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No auto role rules configured. Click "Add Rule" to create one.
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                    rule.is_enabled ? "bg-card" : "bg-muted/30 opacity-60"
                  )}
                >
                  <Badge variant="outline" className={cn("text-xs shrink-0", TRIGGER_COLORS[rule.trigger_type])}>
                    {rule.trigger_type === "bot" ? <Bot className="h-3 w-3 mr-1" /> : rule.trigger_type === "delay" ? <Clock className="h-3 w-3 mr-1" /> : <UserPlus className="h-3 w-3 mr-1" />}
                    {TRIGGER_LABELS[rule.trigger_type]}
                  </Badge>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium truncate">{roleName(rule.role_id)}</span>
                    </div>
                    {rule.trigger_type === "delay" && rule.delay_seconds && (
                      <span className="text-xs text-muted-foreground">Delay: {formatDelay(rule.delay_seconds)}</span>
                    )}
                  </div>

                  <Switch
                    checked={rule.is_enabled}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, is_enabled: checked })}
                  />

                  {confirmDeleteId === rule.id ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteMutation.mutate(rule.id)}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDeleteId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDeleteId(rule.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Rule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Auto Role Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formRoleId} onValueChange={setFormRoleId}>
                <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Trigger Type</Label>
              <Select value={formTrigger} onValueChange={(v) => setFormTrigger(v as "join" | "delay" | "bot")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="join">On Join</SelectItem>
                  <SelectItem value="delay">Delayed</SelectItem>
                  <SelectItem value="bot">Bot Join</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formTrigger === "delay" && (
              <div className="space-y-2">
                <Label>Delay (seconds)</Label>
                <Input type="number" min={1} value={formDelay} onChange={(e) => setFormDelay(Number(e.target.value))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!formRoleId || createMutation.isPending}
              onClick={() => createMutation.mutate({ role_id: formRoleId, trigger_type: formTrigger, ...(formTrigger === "delay" ? { delay_seconds: formDelay } : {}) })}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
