import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useT } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Shield, ShieldCheck, Trash2, Search, Users, UserCheck, AlertTriangle } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/yuri";
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";


interface WarningRow {
  id: number;
  discord_id: string;
  guild_id: string;
  reason: string;
  moderator_id: string;
  created_at: string;
}

export function WarningsManager() {
  const { t } = useT();
  const { toast } = useToast();
  const { selectedGuildId } = useGuild();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WarningRow | null>(null);

  const { data: warnings = [], isLoading } = useQuery<WarningRow[]>({
    queryKey: ["warnings", selectedGuildId],
    queryFn: () => apiFetch("/api/warnings").then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/warnings/${id}`, { method: "DELETE", credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Delete failed");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warnings", selectedGuildId] });
      setDeleteTarget(null);
      toast({ title: t("toast_warningDeleted") });
    },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return warnings;
    return warnings.filter(
      (w) =>
        w.discord_id.toLowerCase().includes(q) ||
        w.reason?.toLowerCase().includes(q)
    );
  }, [warnings, search]);

  const totalWarnings = warnings.length;
  const uniqueUsers = new Set(warnings.map((w) => w.discord_id)).size;
  const uniqueMods = new Set(warnings.map((w) => w.moderator_id)).size;

  return (
    <PageContainer size="lg">
      <PageHeader title={t("warnings_title")} description={`${t("warnings_title")} /warn. Deleting here does not DM the user.`} icon={AlertTriangle} />

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-orange-500/10 p-2.5">
              <Shield className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalWarnings}</p>
              <p className="text-xs text-muted-foreground">{t("warnings_total")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-red-500/10 p-2.5">
              <Users className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{uniqueUsers}</p>
              <p className="text-xs text-muted-foreground">{t("warnings_warned")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <UserCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{uniqueMods}</p>
              <p className="text-xs text-muted-foreground">{t("warnings_mods")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">{t("loading")}</div>
      )}

      {/* ── Empty ── */}
      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ShieldCheck className="h-12 w-12 mb-3 text-green-500/60" />
          <p className="text-lg font-medium">{t("warnings_empty")}</p>
        </div>
      )}

      {/* ── Card List ── */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((w) => (
            <Card key={w.id}>
              <CardContent className="flex items-center gap-4 p-4">
                {/* Left: icon + id + date */}
                <div className="flex items-center gap-3 min-w-0 shrink-0">
                  <div className="rounded-lg bg-red-500/10 p-2">
                    <Shield className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold font-mono text-sm truncate">{w.discord_id}</p>
                    <p className="text-[11px] text-muted-foreground/60">
                      {new Date(w.created_at).toLocaleString("vi-VN")}
                    </p>
                  </div>
                </div>

                {/* Center: reason */}
                <div className="flex-1 min-w-0 px-2">
                  {w.reason ? (
                    <p className="text-sm text-muted-foreground italic truncate">{w.reason}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground/40 italic">{t("warnings_noReason")}</p>
                  )}
                </div>

                {/* Right: mod + delete */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="text-[11px] text-muted-foreground">{t("warnings_by")} {w.moderator_id}</p>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(w)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
            <DialogTitle>{t("warnings_delete")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("thisCannotBeUndone")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? t("deleting") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
