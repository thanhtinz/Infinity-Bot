import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";
import type { InviteLogEntry } from "./shared";
import { formatDate } from "./shared";

export function InviteLog() {
  const { t } = useT();

  const { data: logs = [], isLoading } = useQuery<InviteLogEntry[]>({
    queryKey: ["invites_log"],
    queryFn: () => apiFetch("/api/invites/log").then((r) => r.json()),
  });

  if (isLoading && logs.length === 0) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">{t("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Log Table ── */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invite_inviter")}</TableHead>
                <TableHead>{t("invite_invited")}</TableHead>
                <TableHead>{t("invite_code")}</TableHead>
                <TableHead>{t("invite_dateJoin")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("invite_fake")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t("invite_noLogs")}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{log.inviter_id}</code>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{log.invitee_id}</code>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs font-mono">{log.invite_code}</code>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(log.joined_at)}</TableCell>
                    <TableCell>
                      {log.left ? (
                        <Badge className="bg-red-500/15 text-red-600 border-red-500/30">{t("invite_left")}</Badge>
                      ) : (
                        <Badge className="bg-green-500/15 text-green-600 border-green-500/30">{t("active")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.is_fake && (
                        <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">{t("invite_fake")}</Badge>
                      )}
                    </TableCell>
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
