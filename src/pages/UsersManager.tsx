import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Users, UserCheck, Ban, DollarSign, Search, FileText, ShieldBan } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/hooks/useApi";

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

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PAID: { label: "Paid", cls: "bg-green-500/15 text-green-600 border-green-500/30" },
  PENDING: { label: "Pending payment", cls: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
  DELIVERING: { label: "Đang giao", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  DELIVERED: { label: "Delivered", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
  ERROR: { label: "Error", cls: "bg-gray-500/15 text-gray-600 border-gray-500/30" },
};

function formatVND(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("vi-VN");
}

export function UsersManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [orderSheetUser, setOrderSheetUser] = useState<UserRecord | null>(null);
  const [banTarget, setBanTarget] = useState<UserRecord | null>(null);
  const [banReason, setBanReason] = useState("");

  const { data: users = [], isLoading } = useQuery<UserRecord[]>({
    queryKey: ["users"],
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
      qc.invalidateQueries({ queryKey: ["users"] });
      setBanTarget(null);
      setBanReason("");
      toast({ title: "User banned." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const unbanMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/users/${id}/unban`, {
        method: "POST",
        credentials: "include",
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "User unbanned." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
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
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Users</h2>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total users</p>
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
              <p className="text-xs text-muted-foreground">Active</p>
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
              <p className="text-xs text-muted-foreground">Banned</p>
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
              <p className="text-xs text-muted-foreground">Total revenue</p>
              <p className="text-xl font-bold">{formatVND(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search username or Discord ID..."
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
                <TableHead>User</TableHead>
                <TableHead>Discord ID</TableHead>
                <TableHead className="text-right">Total spent</TableHead>
                <TableHead className="text-center">Orders</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No users found.
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
                    <TableCell className="text-right font-medium">{formatVND(user.total_spent)}</TableCell>
                    <TableCell className="text-center">{user.order_count}</TableCell>
                    <TableCell className="text-sm">{formatDate(user.created_at)}</TableCell>
                    <TableCell>
                      {user.is_banned ? (
                        <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Banned</Badge>
                      ) : (
                        <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOrderSheetUser(user)}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" /> Orders
                        </Button>
                        {user.is_banned ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unbanMutation.mutate(user.id)}
                            disabled={unbanMutation.isPending}
                          >
                            Unban
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => { setBanTarget(user); setBanReason(""); }}
                          >
                            <ShieldBan className="h-3.5 w-3.5 mr-1" /> Ban
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
            <DialogTitle>Orders of {orderSheetUser?.username}</DialogTitle>
          </DialogHeader>
          <Separator className="my-4" />
          {userOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No orders yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Products</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead className="text-center">SL</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.product_name}</TableCell>
                    <TableCell>{order.package_name || "—"}</TableCell>
                    <TableCell className="text-center">{order.quantity}</TableCell>
                    <TableCell className="text-right">{formatVND(order.total_price)}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px]", STATUS_CONFIG[order.status]?.cls || "bg-gray-500/15 text-gray-600")}>
                        {STATUS_CONFIG[order.status]?.label || order.status}
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
            <DialogTitle>Ban user {banTarget?.username}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Reason ban</Label>
              <Textarea
                placeholder="Enter ban reason..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBanTarget(null); setBanReason(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={banMutation.isPending || !banReason.trim()}
              onClick={() => banTarget && banMutation.mutate({ id: banTarget.id, reason: banReason })}
            >
              {banMutation.isPending ? "Đang ban..." : "Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
