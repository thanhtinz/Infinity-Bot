import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, UserPlus, UserMinus, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface InviteRecord {
  inviter_id: string;
  total: number;
  active: number;
  left: number;
  fake: number;
}

interface InviteLogEntry {
  id: number;
  inviter_id: string;
  invitee_id: string;
  invite_code: string;
  joined_at: string;
  left: boolean;
  is_fake: boolean;
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

export function InviteTracking() {
  const [tab, setTab] = useState("leaderboard");

  const { data: invites = [], isLoading: invitesLoading } = useQuery<InviteRecord[]>({
    queryKey: ["invites"],
    queryFn: () => fetch("/api/invites", { credentials: "include" }).then((r) => r.json()),
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<InviteLogEntry[]>({
    queryKey: ["invites_log"],
    queryFn: () => fetch("/api/invites/log", { credentials: "include" }).then((r) => r.json()),
  });

  const sortedInvites = [...invites].sort((a, b) => b.total - a.total);

  const totalInvites = invites.reduce((sum, i) => sum + i.total, 0);
  const totalActive = invites.reduce((sum, i) => sum + i.active, 0);
  const totalLeft = invites.reduce((sum, i) => sum + i.left, 0);
  const totalFake = invites.reduce((sum, i) => sum + i.fake, 0);

  const isLoading = tab === "leaderboard" ? invitesLoading : logsLoading;

  if (isLoading && invites.length === 0 && logs.length === 0) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Đang tải...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link2 className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Invite Tracking</h2>
      </div>

      {/* ── Note ── */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-sm text-blue-700 dark:text-blue-400">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>Invite tracking hoạt động khi bot online và có quyền Manage Guild</p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tổng invite</p>
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
              <p className="text-xs text-muted-foreground">Active</p>
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
              <p className="text-xs text-muted-foreground">Left</p>
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
              <p className="text-xs text-muted-foreground">Fake</p>
              <p className="text-xl font-bold">{totalFake.toLocaleString("vi-VN")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="leaderboard">Bảng xếp hạng</TabsTrigger>
          <TabsTrigger value="log">Nhật ký Invite</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Leaderboard ── */}
        <TabsContent value="leaderboard">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Inviter ID</TableHead>
                    <TableHead className="text-center">Tổng invite</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-center">Left</TableHead>
                    <TableHead className="text-center">Fake</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedInvites.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Chưa có dữ liệu invite.
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
        </TabsContent>

        {/* ── Tab 2: Log ── */}
        <TabsContent value="log">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inviter</TableHead>
                    <TableHead>Invitee</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Ngày join</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Fake</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Chưa có nhật ký invite.
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
                            <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Left</Badge>
                          ) : (
                            <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.is_fake && (
                            <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">Fake</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
