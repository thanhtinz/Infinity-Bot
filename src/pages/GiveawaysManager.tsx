import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Gift, Trophy, Clock, Users, Trash2, Info } from "lucide-react";

interface Giveaway {
  id: number;
  title: string;
  prize: string;
  winners_count: number;
  ends_at: string;
  ended: boolean;
  host_id: string;
  entry_count: number;
  channel_id: string;
  created_at: string;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GiveawaysManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "active" | "ended">("all");
  const [deleteTarget, setDeleteTarget] = useState<Giveaway | null>(null);

  const { data: giveaways = [], isLoading } = useQuery<Giveaway[]>({
    queryKey: ["giveaways"],
    queryFn: () => fetch("/api/giveaways", { credentials: "include" }).then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/giveaways/${id}`, { method: "DELETE", credentials: "include" })
        .then(async (r) => { if (!r.ok) throw new Error(await r.text()); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["giveaways"] });
      setDeleteTarget(null);
      toast({ title: "Đã xóa giveaway." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const filtered = giveaways.filter((g) => {
    if (filter === "active") return !g.ended;
    if (filter === "ended") return g.ended;
    return true;
  });

  const totalGiveaways = giveaways.length;
  const activeGiveaways = giveaways.filter((g) => !g.ended).length;
  const endedGiveaways = giveaways.filter((g) => g.ended).length;
  const totalEntries = giveaways.reduce((sum, g) => sum + g.entry_count, 0);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Giveaway</h2>
      </div>

      {/* ── Note ── */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-sm text-blue-700 dark:text-blue-400">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>Giveaway được tạo và quản lý trực tiếp qua lệnh bot Discord (<code className="font-mono bg-blue-500/10 px-1 rounded">/giveaway</code>)</p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <Gift className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tổng giveaway</p>
              <p className="text-xl font-bold">{totalGiveaways}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-green-500/10 text-green-600">
              <Trophy className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-xl font-bold">{activeGiveaways}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-yellow-500/10 text-yellow-600">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ended</p>
              <p className="text-xl font-bold">{endedGiveaways}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tổng người tham gia</p>
              <p className="text-xl font-bold">{totalEntries.toLocaleString("vi-VN")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter ── */}
      <div className="flex items-center gap-2">
        {(["all", "active", "ended"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Tất cả" : f === "active" ? "Đang diễn ra" : "Đã kết thúc"}
          </Button>
        ))}
      </div>

      {/* ── Table ── */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Prize</TableHead>
                <TableHead className="text-center">Winners</TableHead>
                <TableHead className="text-center">Entries</TableHead>
                <TableHead>Channel ID</TableHead>
                <TableHead>Kết thúc</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Không có giveaway nào.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.title}</TableCell>
                    <TableCell>{g.prize}</TableCell>
                    <TableCell className="text-center">{g.winners_count}</TableCell>
                    <TableCell className="text-center">{g.entry_count}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{g.channel_id}</code>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(g.ends_at)}</TableCell>
                    <TableCell>
                      {g.ended ? (
                        <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">Ended</Badge>
                      ) : (
                        <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteTarget(g)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Confirm xóa ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Xóa giveaway?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Giveaway <strong>{deleteTarget?.title}</strong> sẽ bị xóa vĩnh viễn.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
