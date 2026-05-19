import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link2, UserPlus, UserMinus, AlertTriangle, Info } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";
import type { InviteRecord } from "./shared";

export function InviteLeaderboard() {
  const { t } = useT();

  const { data: invites = [], isLoading } = useQuery<InviteRecord[]>({
    queryKey: ["invites"],
    queryFn: () => apiFetch("/api/invites").then((r) => r.json()),
  });

  const sortedInvites = [...invites].sort((a, b) => b.total - a.total);

  const totalInvites = invites.reduce((sum, i) => sum + i.total, 0);
  const totalActive = invites.reduce((sum, i) => sum + i.active, 0);
  const totalLeft = invites.reduce((sum, i) => sum + i.left, 0);
  const totalFake = invites.reduce((sum, i) => sum + i.fake, 0);

  if (isLoading && invites.length === 0) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">{t("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Note ── */}
      <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary dark:text-primary/80">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>{t("invite_notePermission")}</p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("invite_totalInvites")}</p>
              <p className="text-xl font-bold">{totalInvites.toLocaleString("vi-VN")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-green-500/10 text-green-600">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("active")}</p>
              <p className="text-xl font-bold">{totalActive.toLocaleString("vi-VN")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-red-500/10 text-red-600">
              <UserMinus className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("invite_left")}</p>
              <p className="text-xl font-bold">{totalLeft.toLocaleString("vi-VN")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-yellow-500/10 text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("invite_fake")}</p>
              <p className="text-xl font-bold">{totalFake.toLocaleString("vi-VN")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Leaderboard Table ── */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{t("invite_inviter")} ID</TableHead>
                <TableHead className="text-center">{t("invite_total")}</TableHead>
                <TableHead className="text-center">{t("active")}</TableHead>
                <TableHead className="text-center">{t("invite_left")}</TableHead>
                <TableHead className="text-center">{t("invite_fake")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedInvites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t("invite_noData")}
                  </TableCell>
                </TableRow>
              ) : (
                sortedInvites.map((inv, i) => (
                  <TableRow key={inv.inviter_id}>
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{inv.inviter_id}</code>
                    </TableCell>
                    <TableCell className="text-center font-bold">{inv.total}</TableCell>
                    <TableCell className="text-center text-green-600">{inv.active}</TableCell>
                    <TableCell className="text-center text-red-600">{inv.left}</TableCell>
                    <TableCell className="text-center text-yellow-600">{inv.fake}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
