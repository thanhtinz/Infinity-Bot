import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Gift, Trophy, Clock, Users, Trash2, Info } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";
import { useGuild } from "@/contexts/GuildContext";


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
  const { t } = useT();
  const { toast } = useToast();
  const { selectedGuildId } = useGuild();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "active" | "ended">("all");
  const [deleteTarget, setDeleteTarget] = useState<Giveaway | null>(null);

  const { data: giveaways = [], isLoading } = useQuery<Giveaway[]>({
    queryKey: ["giveaways", selectedGuildId],
    queryFn: () => apiFetch("/api/giveaways").then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/giveaways/${id}`, { method: "DELETE", credentials: "include" })
        .then(async (r) => { if (!r.ok) throw new Error(await r.text()); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["giveaways", selectedGuildId] });
      setDeleteTarget(null);
      toast({ title: t("toast_giveawayDeleted") });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: t("error"), description: e.message }),
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
    return <div className="flex items-center justify-center h-64 text-muted-foreground">{t("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">{t("giveaway_title")}</h2>
        </div>
      </div>

      {/* ── Note ── */}
      <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary dark:text-primary/80">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>{t("giveaway_note")} (<code className="font-mono bg-primary/10 px-1 rounded">/giveaway</code>)</p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <Gift className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("giveaway_totalGiveawaysStat")}</p>
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
              <p className="text-xs text-muted-foreground">{t("active")}</p>
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
              <p className="text-xs text-muted-foreground">{t("giveaway_ended")}</p>
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
              <p className="text-xs text-muted-foreground">{t("giveaway_totalParticipantsStat")}</p>
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
            {f === "all" ? t("all") : f === "active" ? t("active") : t("giveaway_ended")}
          </Button>
        ))}
      </div>

      {/* ── Table ── */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("title")}</TableHead>
                <TableHead>{t("prize")}</TableHead>
                <TableHead className="text-center">{t("winners")}</TableHead>
                <TableHead className="text-center">{t("giveaway_entries")}</TableHead>
                <TableHead>{t("giveaway_channelId")}</TableHead>
                <TableHead>{t("giveaway_ends")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {t("giveaway_noGiveaways")}
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
                        <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">{t("giveaway_ended")}</Badge>
                      ) : (
                        <Badge className="bg-green-500/15 text-green-600 border-green-500/30">{t("active")}</Badge>
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

      {/* ── Confirm delete ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{t("giveaway_deleteConfirm")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("giveaway_title")} <strong>{deleteTarget?.title}</strong> {t("giveaway_willBeDeleted")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
