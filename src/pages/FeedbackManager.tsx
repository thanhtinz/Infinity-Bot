import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Trash2, Search, Star, StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/hooks/useApi";

interface FeedbackRow {
  id: number;
  user_discord_id: string | null;
  username: string;
  product_id: number | null;
  product_name: string | null;
  stars: number;
  content: string;
  discord_message_id: string | null;
  created_at: string | null;
}

function StarDisplay({ stars }: { stars: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < stars
              ? "fill-yellow-400 text-yellow-400"
              : "fill-none text-muted-foreground/30"
          )}
        />
      ))}
    </span>
  );
}

function AvatarInitial({ username }: { username: string }) {
  const initial = username.charAt(0).toUpperCase() || "?";
  const colors = [
    "bg-red-500/15 text-red-600",
    "bg-blue-500/15 text-blue-600",
    "bg-green-500/15 text-green-600",
    "bg-purple-500/15 text-purple-600",
    "bg-orange-500/15 text-orange-600",
    "bg-pink-500/15 text-pink-600",
  ];
  const idx = username.charCodeAt(0) % colors.length;
  return (
    <div
      className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
        colors[idx]
      )}
    >
      {initial}
    </div>
  );
}

export function FeedbackManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FeedbackRow | null>(null);

  const { data: feedbacks = [], isLoading } = useQuery<FeedbackRow[]>({
    queryKey: ["feedback"],
    queryFn: () => apiFetch("/api/feedback").then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/feedback/${id}`, { method: "DELETE", credentials: "include" }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feedback"] });
      setDeleteTarget(null);
      toast({ title: "Deleted feedback." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return feedbacks;
    const q = search.toLowerCase();
    return feedbacks.filter(
      (f) =>
        f.username.toLowerCase().includes(q) ||
        f.content?.toLowerCase().includes(q) ||
        f.product_name?.toLowerCase().includes(q)
    );
  }, [feedbacks, search]);

  const stats = useMemo(() => {
    const total = feedbacks.length;
    const avg = total > 0 ? feedbacks.reduce((s, f) => s + f.stars, 0) / total : 0;
    const fiveStars = feedbacks.filter((f) => f.stars === 5).length;
    const lowStars = feedbacks.filter((f) => f.stars <= 2).length;
    return { total, avg, fiveStars, lowStars };
  }, [feedbacks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Feedback</h2>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total feedback</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold flex items-center justify-center gap-1">
              <StarIcon className="h-5 w-5 text-yellow-400 fill-yellow-400" /> {stats.avg.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">Medium sao</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.fiveStars}</p>
            <p className="text-xs text-muted-foreground">5 sao</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.lowStars}</p>
            <p className="text-xs text-muted-foreground">1-2 sao</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by username, content..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ── Feedback List ── */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {feedbacks.length === 0
              ? "No feedback yet"
              : "No matching feedback found"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((fb) => (
            <Card key={fb.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <AvatarInitial username={fb.username} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{fb.username}</span>
                      {fb.user_discord_id && (
                        <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {fb.user_discord_id}
                        </span>
                      )}
                      {fb.product_name && (
                        <Badge variant="secondary" className="text-[10px]">
                          {fb.product_name}
                        </Badge>
                      )}
                    </div>
                    {fb.content && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {fb.content}
                      </p>
                    )}
                    {fb.created_at && (
                      <p className="text-[11px] text-muted-foreground/60 mt-2">
                        {new Date(fb.created_at).toLocaleString("vi-VN")}
                      </p>
                    )}
                  </div>

                  {/* Stars + Delete */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <StarDisplay stars={fb.stars} />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(fb)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Delete Confirm ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete feedback?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the message from the Discord channel. <strong>This cannot be undone.</strong>
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
