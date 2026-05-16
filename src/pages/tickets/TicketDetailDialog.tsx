import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Ticket,
  CheckCircle,
  StickyNote,
  UserPlus,
  ArrowLeftRight,
  XCircle,
  Users,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UseMutationResult } from "@tanstack/react-query";
import type { TicketRow } from "./ticketHelpers";
import {
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  formatDate,
  CopyableId,
} from "./ticketHelpers";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface TicketDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: TicketRow | undefined;
  detailLoading: boolean;
  detailTab: string;
  setDetailTab: (tab: string) => void;
  updateMutation: UseMutationResult<unknown, Error, { id: number } & Record<string, unknown>>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TicketDetailDialog({
  open,
  onOpenChange,
  detail,
  detailLoading,
  detailTab,
  setDetailTab,
  updateMutation,
}: TicketDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {detailLoading || !detail ? (
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="space-y-3 mt-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Dialog header */}
            <div className="px-6 pt-6 pb-4 border-b shrink-0">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono">#{detail.id}</span>
                  <span className="text-muted-foreground font-normal">
                    —
                  </span>
                  <span className="truncate">
                    {detail.subject || "Không có chủ đề"}
                  </span>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px]",
                      STATUS_CONFIG[detail.status]?.cls
                    )}
                  >
                    {STATUS_CONFIG[detail.status]?.label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px]",
                      PRIORITY_CONFIG[detail.priority]?.cls
                    )}
                  >
                    {PRIORITY_CONFIG[detail.priority]?.label}
                  </Badge>
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Dialog tabs */}
            <div className="px-6 pt-3 shrink-0">
              <Tabs
                value={detailTab}
                onValueChange={(v) =>
                  setDetailTab(v as "info" | "notes" | "members")
                }
              >
                <TabsList className="w-full">
                  <TabsTrigger value="info" className="flex-1 gap-1.5">
                    <Ticket className="h-3.5 w-3.5" />
                    Thông tin
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="flex-1 gap-1.5">
                    <StickyNote className="h-3.5 w-3.5" />
                    Notes
                  </TabsTrigger>
                  <TabsTrigger value="members" className="flex-1 gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Members
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Sheet body — scrollable */}
            <ScrollArea className="flex-1 px-6 py-4">
              {/* ── Tab: Thông tin ── */}
              {detailTab === "info" && (
                <div className="space-y-4">
                  {/* Channel ID */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Channel ID
                    </p>
                    {detail.channel_id ? (
                      <CopyableId value={detail.channel_id} />
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </div>

                  {/* Creator ID */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Creator ID
                    </p>
                    <CopyableId value={detail.creator_id} />
                  </div>

                  {/* Claimed by */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Claimed by
                    </p>
                    {detail.claimed_by ? (
                      <CopyableId value={detail.claimed_by} />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Chưa ai nhận
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Status selector */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      Trạng thái
                    </p>
                    <Select
                      value={detail.status}
                      onValueChange={(v) =>
                        updateMutation.mutate({
                          id: detail.id,
                          status: v,
                        })
                      }
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Đang mở</SelectItem>
                        <SelectItem value="closed">Đã đóng</SelectItem>
                        <SelectItem value="deleted">Đã xóa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority selector */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      Mức ưu tiên
                    </p>
                    <Select
                      value={detail.priority}
                      onValueChange={(v) =>
                        updateMutation.mutate({
                          id: detail.id,
                          priority: v,
                        })
                      }
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Thấp</SelectItem>
                        <SelectItem value="normal">
                          Bình thường
                        </SelectItem>
                        <SelectItem value="high">Cao</SelectItem>
                        <SelectItem value="urgent">Khẩn cấp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Close reason */}
                  {detail.status === "closed" && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Lý do đóng
                      </p>
                      <p className="text-sm">
                        {detail.close_reason || (
                          <span className="text-muted-foreground italic">
                            Không có lý do
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Ngày tạo
                      </p>
                      <p className="text-sm">
                        {formatDate(detail.created_at)}
                      </p>
                    </div>
                    {detail.closed_at && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Ngày đóng
                        </p>
                        <p className="text-sm">
                          {formatDate(detail.closed_at)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {detail.tags.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Tags
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {detail.tags.map((tag, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="text-[11px] gap-1"
                          >
                            <Tag className="h-3 w-3" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Notes ── */}
              {detailTab === "notes" && (
                <div className="space-y-3">
                  {!detail.notes || detail.notes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <StickyNote className="h-10 w-10 mb-2 opacity-40" />
                      <p className="text-sm">Chưa có ghi chú nào</p>
                    </div>
                  ) : (
                    detail.notes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-lg border bg-muted/30 p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {note.author_id}
                          </code>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDate(note.created_at)}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">
                          {note.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── Tab: Members ── */}
              {detailTab === "members" && (
                <div className="space-y-2">
                  {detail.members.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <UserPlus className="h-10 w-10 mb-2 opacity-40" />
                      <p className="text-sm">Chưa có thành viên nào</p>
                    </div>
                  ) : (
                    detail.members.map((memberId, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2"
                      >
                        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {memberId}
                        </code>
                      </div>
                    ))
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Sheet footer — actions */}
            <div className="px-6 py-4 border-t shrink-0">
              <div className="flex items-center gap-2">
                {detail.status === "open" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({
                        id: detail.id,
                        status: "closed",
                      })
                    }
                  >
                    <CheckCircle className="h-4 w-4" />
                    Đóng Ticket
                  </Button>
                )}
                {detail.status === "closed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({
                        id: detail.id,
                        status: "open",
                      })
                    }
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Mở lại
                  </Button>
                )}
                {detail.status !== "deleted" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5 ml-auto"
                    disabled={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({
                        id: detail.id,
                        status: "deleted",
                      })
                    }
                  >
                    <XCircle className="h-4 w-4" />
                    Xóa
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
