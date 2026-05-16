import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Shield, ShieldAlert, ShieldCheck, Trash2, Search, Users, UserCheck } from "lucide-react";

interface WarningRow {
  id: number;
  discord_id: string;
  guild_id: string;
  reason: string;
  moderator_id: string;
  created_at: string;
}

export function WarningsManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WarningRow | null>(null);

  const { data: warnings = [], isLoading } = useQuery<WarningRow[]>({
    queryKey: ["warnings"],
    queryFn: () => fetch("/api/warnings", { credentials: "include" }).then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/warnings/${id}`, { method: "DELETE", credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Xóa thất bại");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warnings"] });
      setDeleteTarget(null);
      toast({ title: "Đã xóa cảnh cáo" });
    },
    onError: () => toast({ title: "Lỗi khi xóa", variant: "destructive" }),
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-orange-500" />
          Quản lý cảnh cáo
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cảnh cáo được tạo bởi Admin qua lệnh bot <code className="bg-muted px-1 rounded text-xs">/warn</code>. Xóa tại đây không DM người dùng.
        </p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-orange-500/10 p-2.5">
              <Shield className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalWarnings}</p>
              <p className="text-xs text-muted-foreground">Tổng cảnh cáo</p>
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
              <p className="text-xs text-muted-foreground">Người bị cảnh cáo</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-500/10 p-2.5">
              <UserCheck className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{uniqueMods}</p>
              <p className="text-xs text-muted-foreground">Mod đã tạo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm theo Discord ID hoặc lý do..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      )}

      {/* ── Empty ── */}
      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ShieldCheck className="h-12 w-12 mb-3 text-green-500/60" />
          <p className="text-lg font-medium">No warnings</p>
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
                    <p className="text-sm text-muted-foreground/40 italic">Không có lý do</p>
                  )}
                </div>

                {/* Right: mod + delete */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="text-[11px] text-muted-foreground">Mod: {w.moderator_id}</p>
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
            <DialogTitle>Xóa cảnh cáo này?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Hành động này không thể hoàn tác.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
