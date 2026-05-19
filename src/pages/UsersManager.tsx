import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrency } from "@/hooks/useCurrency";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmojiTextarea } from "@/components/EmojiInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Users, UserCheck, Ban, DollarSign, Search, FileText, ShieldBan } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";
import { useGuild } from "@/contexts/GuildContext";


interface UserRecord {
  id: number;
  discord_id: string;
  username: string;
  total_spent: number;
  order_count: number;
  is_banned: boolean;
  created_at: string;
}

interface UserOrder {
  id: number;
  product_name: string;
  package_name: string;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
}

export function UsersManager() {
  const { t } = useT();
  const { toast } = useToast();
  const { selectedGuildId } = useGuild();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [orderSheetUser, setOrderSheetUser] = useState<UserRecord | null>(null);
  const [banTarget, setBanTarget] = useState<UserRecord | null>(null);
  const [banReason, setBanReason] = useState("");

  const STATUS_CLS: Record<string, string> = {
    PAID: "bg-green-500/15 text-green-600 border-green-500/30",
    PENDING: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    DELIVERING: "bg-primary/15 text-primary border-primary/30",
    DELIVERED: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    CANCELLED: "bg-red-500/15 text-red-600 border-red-500/30",
    ERROR: "bg-gray-500/15 text-gray-600 border-gray-500/30",
  };

  const STATUS_LABEL: Record<string, string> = {
    PAID: t("orders_paid"),
    PENDING: t("orders_pending"),
    DELIVERING: t("orders_delivered"),
    DELIVERED: t("orders_delivered"),
    CANCELLED: t("orders_cancelled"),
    ERROR: t("error"),
  };

  const { formatPrice } = useCurrency();

  function formatDate(s: string) {
    return new Date(s).toLocaleDateString("vi-VN");
  }

  const { data: users = [], isLoading } = useQuery<UserRecord[]>({
    queryKey: ["users", selectedGuildId],
    queryFn: () => apiFetch("/api/users").then((r) => r.json()),
  });

  const { data: userOrders = [] } = useQuery<UserOrder[]>({
    queryKey: ["user_orders", orderSheetUser?.id],
    queryFn: () => apiFetch(`/api/users/${orderSheetUser!.id}/orders`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!orderSheetUser,
  });

  const banMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiFetch(`/api/users/${id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", selectedGuildId] });
      setBanTarget(null);
      setBanReason("");
      toast({ title: t("toast_userBanned") });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: t("error"), description: e.message }),
  });

  const unbanMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/users/${id}/unban`, {
        method: "POST",
        credentials: "include",
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", selectedGuildId] });
      toast({ title: t("toast_userUnbanned") });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: t("error"), description: e.message }),
  });

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.discord_id.includes(search)
  );

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => !u.is_banned).length;
  const bannedUsers = users.filter((u) => u.is_banned).length;
  const totalRevenue = users.reduce((sum, u) => sum + u.total_spent, 0);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">{t("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">{t("users_title")}</h2>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("users_totalUsers")}</p>
              <p className="text-xl font-bold">{totalUsers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-green-500/10 text-green-600">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("all")}</p>
              <p className="text-xl font-bold">{activeUsers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-red-500/10 text-red-600">
              <Ban className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("users_banned")}</p>
              <p className="text-xl font-bold">{bannedUsers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("users_totalRevenue")}</p>
              <p className="text-xl font-bold">{formatPrice(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("users_searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ── Table ── */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("user")}</TableHead>
                <TableHead>{t("users_discordId")}</TableHead>
                <TableHead className="text-right">{t("users_spent")}</TableHead>
                <TableHead className="text-center">{t("users_orders")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {t("users_empty")}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{user.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{user.discord_id}</code>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatPrice(user.total_spent)}</TableCell>
                    <TableCell className="text-center">{user.order_count}</TableCell>
                    <TableCell className="text-sm">{formatDate(user.created_at)}</TableCell>
                    <TableCell>
                      {user.is_banned ? (
                        <Badge className="bg-red-500/15 text-red-600 border-red-500/30">{t("users_banned")}</Badge>
                      ) : (
                        <Badge className="bg-green-500/15 text-green-600 border-green-500/30">{t("all")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOrderSheetUser(user)}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" /> {t("users_orders")}
                        </Button>
                        {user.is_banned ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unbanMutation.mutate(user.id)}
                            disabled={unbanMutation.isPending}
                          >
                            {t("users_unban")}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => { setBanTarget(user); setBanReason(""); }}
                          >
                            <ShieldBan className="h-3.5 w-3.5 mr-1" /> {t("users_ban")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Order History Dialog ── */}
      <Dialog open={!!orderSheetUser} onOpenChange={(o) => { if (!o) setOrderSheetUser(null); }}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("users_orders")} — {orderSheetUser?.username}</DialogTitle>
          </DialogHeader>
          <Separator className="my-4" />
          {userOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("orders_empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("orders_items")}</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead className="text-center">SL</TableHead>
                  <TableHead className="text-right">{t("total")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.product_name}</TableCell>
                    <TableCell>{order.package_name || "—"}</TableCell>
                    <TableCell className="text-center">{order.quantity}</TableCell>
                    <TableCell className="text-right">{formatPrice(order.total_price)}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px]", STATUS_CLS[order.status] || "bg-gray-500/15 text-gray-600")}>
                        {STATUS_LABEL[order.status] || order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(order.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Ban Dialog ── */}
      <Dialog open={!!banTarget} onOpenChange={(o) => { if (!o) { setBanTarget(null); setBanReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("users_ban")} {banTarget?.username}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("users_ban")}</Label>
              <EmojiTextarea
                placeholder={t("users_ban")}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBanTarget(null); setBanReason(""); }}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              disabled={banMutation.isPending || !banReason.trim()}
              onClick={() => banTarget && banMutation.mutate({ id: banTarget.id, reason: banReason })}
            >
              {banMutation.isPending ? t("saving") : t("users_ban")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
