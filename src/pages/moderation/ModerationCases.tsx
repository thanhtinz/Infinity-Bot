import { useState, useMemo } from "react";
import { useT } from "@/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/hooks/useApi";
import { ShieldAlert, Shield, Clock, FileText, Gavel, Trash2, Search } from "lucide-react";
import type { ModCase, ModStats } from "./shared";
import { actionBadge, formatDate, truncate } from "./shared";

export function ModerationCases() {
  const { t } = useT();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [caseSearch, setCaseSearch] = useState("");
  const [caseAction, setCaseAction] = useState("all");
  const [deleteCaseTarget, setDeleteCaseTarget] = useState<ModCase | null>(null);

  // ── Queries ──

  const { data: stats } = useQuery<ModStats>({
    queryKey: ["moderation-stats"],
    queryFn: () => apiFetch("/api/moderation/stats").then((r) => r.json()),
  });

  const { data: cases = [], isLoading: casesLoading } = useQuery<ModCase[]>({
    queryKey: ["moderation-cases", caseSearch, caseAction],
    queryFn: () => {
      const params = new URLSearchParams();
      if (caseSearch.trim()) params.set("target_id", caseSearch.trim());
      if (caseAction !== "all") params.set("action", caseAction);
      params.set("limit", "50");
      return apiFetch(`/api/moderation/cases?${params}`).then((r) => r.json());
    },
  });

  // ── Mutations ──

  const deleteCaseMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/moderation/cases/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Delete failed");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-cases"] });
      qc.invalidateQueries({ queryKey: ["moderation-stats"] });
      qc.invalidateQueries({ queryKey: ["moderation-active"] });
      setDeleteCaseTarget(null);
      toast({ title: t("toast_caseDeleted") });
    },
    onError: () =>
      toast({ title: t("toast_caseDeletFailed"), variant: "destructive" }),
  });

  // ── Derived ──

  const topAction = useMemo(() => {
    if (!stats?.by_action) return null;
    const entries = Object.entries(stats.by_action);
    if (entries.length === 0) return null;
    return entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-orange-500" />
          {t("mod_title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("mod_totalCases")}, {t("mod_notes")}, {t("mod_allActions")}
        </p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("mod_totalCases")}</p>
              <p className="text-xl font-bold">{stats?.total_cases ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-blue-500/10 text-blue-600">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("mod_allActions")}</p>
              <p className="text-xl font-bold">{stats?.active_moderations ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-green-500/10 text-green-600">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("mod_notes")}</p>
              <p className="text-xl font-bold">{stats?.total_notes ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-orange-500/10 text-orange-600">
              <Gavel className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("mod_topAction")}</p>
              <p className="text-xl font-bold">
                {topAction ? `${topAction[0]} (${topAction[1]})` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Cases ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("mod_searchCases")}
              value={caseSearch}
              onChange={(e) => setCaseSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={caseAction} onValueChange={setCaseAction}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t("mod_actionType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              <SelectItem value="warn">{t("warn")}</SelectItem>
              <SelectItem value="ban">{t("ban")}</SelectItem>
              <SelectItem value="softban">{t("softban")}</SelectItem>
              <SelectItem value="kick">{t("kick")}</SelectItem>
              <SelectItem value="mute">{t("mod_mute")}</SelectItem>
              <SelectItem value="timeout">{t("timeout")}</SelectItem>
              <SelectItem value="unban">{t("unban")}</SelectItem>
              <SelectItem value="unmute">{t("unmute")}</SelectItem>
              <SelectItem value="deafen">{t("mod_deafen")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {casesLoading && cases.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            {t("loading")}
          </div>
        ) : cases.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            {t("noData")}
          </div>
        ) : (
          <div className="space-y-2">
            {cases.map((c) => {
              const badge = actionBadge(c.action);
              return (
                <Card key={c.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={cn("gap-1 text-[10px] capitalize", badge.cls)}>
                        {badge.icon}
                        {c.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        #{c.case_number}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium truncate">
                          {c.target_name || c.target_id}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {t("mod_moderator")} {c.moderator_name || c.moderator_id}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {truncate(c.reason, 80)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-0.5">
                      {c.duration && (
                        <span className="text-xs text-muted-foreground">{c.duration}</span>
                      )}
                      <span className="text-[11px] text-muted-foreground/60">
                        {formatDate(c.created_at)}
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      onClick={() => setDeleteCaseTarget(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Delete Case Dialog ── */}
      <Dialog open={!!deleteCaseTarget} onOpenChange={(o) => !o && setDeleteCaseTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("mod_deleteCase")} #{deleteCaseTarget?.case_number}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("mod_deleteCaseConfirm")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCaseTarget(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteCaseMutation.isPending}
              onClick={() => deleteCaseTarget && deleteCaseMutation.mutate(deleteCaseTarget.id)}
            >
              {deleteCaseMutation.isPending ? t("saving") : t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
