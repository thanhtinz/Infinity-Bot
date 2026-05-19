import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/useApi";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Trash2, RefreshCw, History, Bot, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "./shared";

export function AIHistoryPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [histFilter, setHistFilter] = useState("");

  const { data: histStats } = useQuery<{ total_messages: number; unique_users: number }>({
    queryKey: ["ai-history-stats"],
    queryFn: () => apiFetch("/api/ai-chat/history/stats").then(r => r.json()),
  });

  const { data: history = [], isLoading: histLoading, refetch: refetchHistory } = useQuery<HistoryEntry[]>({
    queryKey: ["ai-history", histFilter],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "100" });
      if (histFilter) p.set("user_id", histFilter);
      return apiFetch(`/api/ai-chat/history?${p}`).then(r => r.json());
    },
  });

  const clearHistMutation = useMutation({
    mutationFn: () => apiFetch("/api/ai-chat/history", { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-history"] });
      qc.invalidateQueries({ queryKey: ["ai-history-stats"] });
      toast({ title: "History cleared" });
    },
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <History className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">History</h1>
          <p className="text-sm text-muted-foreground">AI conversation logs and statistics</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{histStats?.total_messages ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total messages</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{histStats?.unique_users ?? 0}</p>
            <p className="text-xs text-muted-foreground">Unique users</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Filter by User ID…"
          value={histFilter}
          onChange={e => setHistFilter(e.target.value)}
          className="flex-1"
        />
        <Button variant="outline" size="icon" onClick={() => refetchHistory()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />Clear All
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all history?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all AI conversation history for this server.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => clearHistMutation.mutate()}>Clear</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {histLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <History className="h-8 w-8 opacity-25" />
          <p className="text-sm">No history yet</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {history.map(entry => (
            <div
              key={entry.id}
              className={cn(
                "flex gap-3 p-3 rounded-lg text-sm",
                entry.role === "assistant"
                  ? "bg-primary/5 border border-primary/10"
                  : "bg-muted/40"
              )}
            >
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                entry.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                {entry.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-medium text-xs">
                    {entry.role === "assistant" ? "AI Assistant" : (entry.username || entry.user_id)}
                  </span>
                  {entry.timestamp && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-sm break-words">{entry.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
