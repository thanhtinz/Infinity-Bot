import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trophy, Users, DollarSign, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";

interface LeaderboardRow {
  rank: number;
  user_id: number;
  discord_id: string;
  username: string;
  don_count: number;
  total_spent: number;
}

interface LeaderboardResponse {
  reset_at: string | null;
  items: LeaderboardRow[];
}

const RANK_STYLE: Record<number, string> = {
  1: "bg-amber-500 text-white",
  2: "bg-gray-400 text-white",
  3: "bg-amber-700 text-white",
};

function formatVND(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export function Leaderboard() {
  const { t } = useT();
  const [loai, setLoai] = useState<"chi_tieu" | "don_hang">("chi_tieu");
  const [time, setTime] = useState<"all" | "30days" | "7days" | "daily">("all");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<LeaderboardResponse>({
    queryKey: ["leaderboard", loai, time],
    queryFn: () =>
      apiFetch(`/api/leaderboard?loai=${loai}&time=${time}`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 30_000,
  });

  const rows = data?.items ?? [];
  const resetAt = data?.reset_at ?? null;

  const totalBuyers = rows.length;
  const totalRevenue = rows.reduce((sum, r) => sum + r.total_spent, 0);

  const resetMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/leaderboard/reset", { method: "POST", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      toast({ title: t("toast_reset"), description: t("toast_shopReset") });
    },
    onError: () => toast({ variant: "destructive", title: t("error"), description: t("toast_resetFailed") }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6" /> {t("lb_title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("lb_discordCommand")}{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/bxh</code>
          </p>
          {resetAt && (
            <p className="text-xs text-muted-foreground mt-1">
              {t("lb_lastReset")}: {formatDate(resetAt)}
            </p>
          )}
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="shrink-0">
              <RotateCcw className="h-4 w-4 mr-2" /> {t("lb_resetBxh")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("lb_resetLeaderboard")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("lb_resetDesc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => resetMutation.mutate()}
              >
                {t("lb_confirmReset")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/15 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalBuyers}</p>
              <p className="text-xs text-muted-foreground">{t("lb_buyer")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/15 text-green-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatVND(totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">{t("lb_totalSpent")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          value={loai}
          onValueChange={(v) => v && setLoai(v as typeof loai)}
          className="border rounded-lg p-1"
        >
          <ToggleGroupItem value="chi_tieu" className="text-sm">{t("lb_spending")}</ToggleGroupItem>
          <ToggleGroupItem value="don_hang" className="text-sm">{t("lb_orders")}</ToggleGroupItem>
        </ToggleGroup>

        <Select value={time} onValueChange={(v) => setTime(v as typeof time)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all")}</SelectItem>
            <SelectItem value="30days">{t("lb_30days")}</SelectItem>
            <SelectItem value="7days">{t("lb_7days")}</SelectItem>
            <SelectItem value="daily">{t("today")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{t("lb_noData")}</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">{t("rank")}</TableHead>
                <TableHead>{t("username")}</TableHead>
                <TableHead>Discord ID</TableHead>
                <TableHead className="text-right">{t("lb_totalSpent")}</TableHead>
                <TableHead className="text-right">{t("lb_orders")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.user_id}
                  className={cn(row.rank === 1 && "bg-amber-500/10 border-amber-500/20")}
                >
                  <TableCell>
                    <Badge className={cn("font-semibold", RANK_STYLE[row.rank] ?? "bg-muted text-muted-foreground")}>
                      #{row.rank}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.username}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">{row.discord_id}</span>
                  </TableCell>
                  <TableCell className="text-right">{formatVND(row.total_spent)}</TableCell>
                  <TableCell className="text-right">{row.don_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
