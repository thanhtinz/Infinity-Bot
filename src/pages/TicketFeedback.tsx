import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MessageCircleHeart, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FeedbackItem {
  id: number;
  ticket_id: number;
  guild_id?: string;
  user_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

interface FeedbackData {
  items: FeedbackItem[];
  total: number;
  avg_rating: number;
  by_rating: Record<string, number>;
}

type SortKey = "created_at" | "rating" | "ticket_id";
type SortDir = "asc" | "desc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderStars(rating: number) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </span>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TicketFeedback() {
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");

  // ─── Query ───────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ["ticket-feedback"],
    queryFn: () => fetch("/api/ticket-feedback").then((r) => r.json()),
    staleTime: 30_000,
  });

  const fb = data as FeedbackData | undefined;

  // ─── Sorting & Filtering ─────────────────────────────────────────────────

  const sortedItems = useMemo(() => {
    const items = fb?.items ?? [];
    let filtered = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = items.filter(
        (it) =>
          String(it.ticket_id).includes(q) ||
          it.user_id.toLowerCase().includes(q) ||
          it.comment?.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "created_at") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortKey === "rating") {
        cmp = a.rating - b.rating;
      } else {
        cmp = a.ticket_id - b.ticket_id;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [fb, sortKey, sortDir, search]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // ─── Stats ───────────────────────────────────────────────────────────────

  const total = fb?.total ?? 0;
  const avgRating = fb?.avg_rating ?? 0;
  const byRating = fb?.by_rating ?? {};
  const fiveStar = byRating["5"] ?? 0;
  const lowStar = (byRating["1"] ?? 0) + (byRating["2"] ?? 0);
  const maxCount = Math.max(
    ...Object.values(byRating).map(Number),
    1
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!fb || total === 0) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ticket Feedback</h1>
          <p className="text-muted-foreground text-sm">
            Đánh giá từ người dùng sau khi đóng ticket
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <MessageCircleHeart className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Chưa có đánh giá nào</p>
          <p className="text-sm">Đánh giá sẽ xuất hiện khi người dùng gửi feedback sau khi đóng ticket</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ticket Feedback</h1>
          <p className="text-muted-foreground text-sm">
            Đánh giá từ người dùng sau khi đóng ticket
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {renderStars(Math.round(avgRating))}
          </div>
          <Badge variant="secondary" className="text-sm">
            {avgRating} / 5
          </Badge>
          <Badge variant="outline">{total} đánh giá</Badge>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Tổng đánh giá</p>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Điểm trung bình</p>
            <p className="text-2xl font-bold">{avgRating}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">5 sao</p>
            <p className="text-2xl font-bold text-yellow-500">{fiveStar}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">1-2 sao</p>
            <p className="text-2xl font-bold text-red-500">{lowStar}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rating distribution */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-2">
          <p className="text-sm font-medium mb-3">Phân bố đánh giá</p>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = byRating[String(star)] ?? 0;
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-3">
                <span className="text-sm w-8 flex items-center gap-0.5">
                  {star} <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                </span>
                <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Tìm theo Ticket ID, User ID, hoặc comment..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("ticket_id")}
                >
                  <span className="inline-flex items-center gap-1">
                    Ticket ID <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead>User ID</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("rating")}
                >
                  <span className="inline-flex items-center gap-1">
                    Rating <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead>Comment</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("created_at")}
                >
                  <span className="inline-flex items-center gap-1">
                    Ngày <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">#{item.ticket_id}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {item.user_id}
                  </TableCell>
                  <TableCell>{renderStars(item.rating)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {item.comment || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(item.created_at)}
                  </TableCell>
                </TableRow>
              ))}
              {sortedItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Không tìm thấy kết quả
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
