import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Users, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardRow {
  rank: number;
  user_id: number;
  discord_id: string;
  username: string;
  don_count: number;
  total_spent: number;
}

const RANK_STYLE: Record<number, string> = {
  1: "bg-amber-500 text-white",
  2: "bg-gray-400 text-white",
  3: "bg-amber-700 text-white",
};

function formatVND(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

export function Leaderboard() {
  const [loai, setLoai] = useState<"chi_tieu" | "don_hang">("chi_tieu");
  const [time, setTime] = useState<"all" | "30days" | "7days" | "daily">("all");

  const { data: rows = [], isLoading } = useQuery<LeaderboardRow[]>({
    queryKey: ["leaderboard", loai, time],
    queryFn: () =>
      fetch(`/api/leaderboard?loai=${loai}&time=${time}`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 30_000,
  });

  const totalBuyers = rows.length;
  const totalRevenue = rows.reduce((sum, r) => sum + r.total_spent, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6" /> Bảng xếp hạng
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bảng xếp hạng cũng xem được trên Discord qua lệnh <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/bxh</code>
        </p>
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
              <p className="text-xs text-muted-foreground">Tổng người mua</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatVND(totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">Tổng doanh thu</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          value={loai}
          onValueChange={(v) => { if (v) setLoai(v as "chi_tieu" | "don_hang"); }}
          variant="outline"
        >
          <ToggleGroupItem value="chi_tieu">Chi tiêu</ToggleGroupItem>
          <ToggleGroupItem value="don_hang">Số đơn</ToggleGroupItem>
        </ToggleGroup>

        <Select value={time} onValueChange={(v) => setTime(v as typeof time)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="30days">30 ngày</SelectItem>
            <SelectItem value="7days">7 ngày</SelectItem>
            <SelectItem value="daily">Hôm nay</SelectItem>
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
          <p>Chưa có dữ liệu</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Hạng</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Discord ID</TableHead>
                <TableHead className="text-right">Tổng chi tiêu</TableHead>
                <TableHead className="text-right">Số đơn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.user_id}
                  className={cn(
                    row.rank === 1 && "bg-amber-500/10 border-amber-500/20"
                  )}
                >
                  <TableCell>
                    <Badge
                      className={cn(
                        "font-semibold",
                        RANK_STYLE[row.rank] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      #{row.rank}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.username}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {row.discord_id}
                    </span>
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
