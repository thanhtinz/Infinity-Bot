import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";
import {
  Bell, Trash2, Clock, RefreshCw, CheckCircle, ListTodo,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Reminder {
  id: number;
  guild_id: string;
  user_id: string;
  message: string;
  remind_at: string;
  is_recurring: boolean;
  recurring_interval?: number;
  is_todo?: boolean;
  created_at?: string;
}

interface ReminderStats {
  active: number;
  completed: number;
  active_todos: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RemindersPage() {
  const { toast } = useToast();
  const { selectedGuildId } = useGuild();
  const qc = useQueryClient();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Auto-reset confirm delete after 3s
  useEffect(() => {
    if (confirmDeleteId === null) return;
    const t = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmDeleteId]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: reminders = [], isLoading } = useQuery<Reminder[]>({
    queryKey: ["reminders", selectedGuildId],
    queryFn: () => apiFetch("/api/reminders").then((r) => r.json()),
    enabled: !!selectedGuildId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ReminderStats>({
    queryKey: ["reminders-stats", selectedGuildId],
    queryFn: () => apiFetch("/api/reminders/stats").then((r) => r.json()),
    enabled: !!selectedGuildId,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/reminders/${id}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders", selectedGuildId] });
      qc.invalidateQueries({ queryKey: ["reminders-stats", selectedGuildId] });
      setConfirmDeleteId(null);
      toast({ title: "Reminder deleted." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to delete reminder." }),
  });

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoading || statsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Reminders</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-4">
        View and manage reminders created via bot commands. Reminders are created using slash commands.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-primary/10 text-primary"><Clock className="h-4 w-4" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.active ?? 0}</p>
              <p className="text-xs text-muted-foreground">Active Reminders</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-green-500/10 text-green-600"><CheckCircle className="h-4 w-4" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.completed ?? 0}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-secondary/10 text-secondary"><ListTodo className="h-4 w-4" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.active_todos ?? 0}</p>
              <p className="text-xs text-muted-foreground">Active Todos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reminders List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Reminders</CardTitle>
          <CardDescription>Reminders created by server members via bot commands.</CardDescription>
        </CardHeader>
        <CardContent>
          {reminders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No active reminders.
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{r.message}</span>
                      {r.is_recurring && (
                        <Badge variant="outline" className="text-xs bg-secondary/15 text-secondary dark:text-secondary/80 shrink-0">
                          <RefreshCw className="h-3 w-3 mr-1" /> Recurring
                        </Badge>
                      )}
                      {r.is_todo && (
                        <Badge variant="outline" className="text-xs bg-primary/15 text-primary dark:text-primary/80 shrink-0">
                          <ListTodo className="h-3 w-3 mr-1" /> Todo
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>User: {r.user_id}</span>
                      <span>Remind: {formatDate(r.remind_at)}</span>
                    </div>
                  </div>

                  {confirmDeleteId === r.id ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteMutation.mutate(r.id)}>Confirm</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDeleteId(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
