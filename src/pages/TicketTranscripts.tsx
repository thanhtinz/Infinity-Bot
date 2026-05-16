import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Search, Eye, Download } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TranscriptItem {
  id: number;
  ticket_id: number;
  guild_id?: string;
  channel_name?: string;
  message_count: number;
  participants: string[];
  content_html?: string;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TicketTranscripts() {
  const [search, setSearch] = useState("");
  const [viewTranscript, setViewTranscript] = useState<TranscriptItem | null>(null);

  // ─── Query ───────────────────────────────────────────────────────────────

  const { data: transcripts, isLoading } = useQuery({
    queryKey: ["ticket-transcripts"],
    queryFn: () => fetch("/api/ticket-transcripts").then((r) => r.json()),
    staleTime: 30_000,
  });

  // ─── Filtering ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const items = (transcripts as TranscriptItem[] | undefined) ?? [];
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(
      (t) =>
        String(t.ticket_id).includes(q) ||
        t.channel_name?.toLowerCase().includes(q) ||
        t.participants?.some((p) => p.toLowerCase().includes(q))
    );
  }, [transcripts, search]);

  // ─── Download HTML ───────────────────────────────────────────────────────

  function downloadHtml(t: TranscriptItem) {
    if (!t.content_html) return;
    const blob = new Blob([t.content_html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${t.ticket_id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const items = (transcripts as TranscriptItem[] | undefined) ?? [];

  if (items.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transcripts</h1>
          <p className="text-muted-foreground text-sm">
            Lịch sử chat của các ticket đã đóng
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileText className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Chưa có transcript nào</p>
          <p className="text-sm">Transcript sẽ được lưu tự động khi ticket đóng</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transcripts</h1>
          <p className="text-muted-foreground text-sm">
            Lịch sử chat của các ticket đã đóng
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo Ticket ID, kênh, hoặc người tham gia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket ID</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Tin nhắn</TableHead>
                <TableHead>Người tham gia</TableHead>
                <TableHead>Ngày đóng</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono">#{t.ticket_id}</TableCell>
                  <TableCell>{t.channel_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{t.message_count}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(t.participants ?? []).slice(0, 3).map((p) => (
                        <Badge key={p} variant="outline" className="text-xs">
                          {p}
                        </Badge>
                      ))}
                      {(t.participants?.length ?? 0) > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{t.participants.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(t.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewTranscript(t)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Xem
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Không tìm thấy transcript
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── View Transcript Dialog ── */}
      <Dialog
        open={!!viewTranscript}
        onOpenChange={(open) => !open && setViewTranscript(null)}
      >
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Transcript — Ticket #{viewTranscript?.ticket_id}
            </DialogTitle>
            <DialogDescription>
              {viewTranscript?.channel_name && `Kênh: ${viewTranscript.channel_name}`}
              {viewTranscript?.message_count != null && ` • ${viewTranscript.message_count} tin nhắn`}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-2">
            {viewTranscript?.content_html ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: viewTranscript.content_html }}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Không có nội dung transcript</p>
              </div>
            )}
          </ScrollArea>
          <div className="flex justify-end gap-2 mt-4">
            {viewTranscript?.content_html && (
              <Button variant="outline" onClick={() => downloadHtml(viewTranscript)}>
                <Download className="h-4 w-4 mr-2" />
                Download HTML
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewTranscript(null)}>
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
