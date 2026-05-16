import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TicketNote {
  id: number;
  author_id: string;
  content: string;
  created_at: string;
}

export interface TicketRow {
  id: number;
  channel_id?: string;
  creator_id: string;
  claimed_by?: string;
  status: "open" | "closed" | "deleted";
  priority: "low" | "normal" | "high" | "urgent";
  subject?: string;
  panel_id?: number;
  close_reason?: string;
  members: string[];
  tags: string[];
  created_at: string;
  closed_at?: string;
  notes?: TicketNote[];
}

export interface TicketStats {
  total: number;
  open: number;
  closed: number;
  avg_close_hours: number;
  by_priority: Record<string, number>;
  panels: number;
}

export interface TicketPanelRef {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface BlacklistEntry {
  id: number;
  discord_id: string;
  reason: string;
  added_by: string;
  created_at: string;
}

// ─── Config maps ─────────────────────────────────────────────────────────────

export const PRIORITY_CONFIG: Record<
  string,
  { label: string; cls: string; iconCls: string }
> = {
  low: {
    label: "Low",
    cls: "bg-green-500/15 text-green-600 border-green-500/30",
    iconCls: "text-green-500",
  },
  normal: {
    label: "Normal",
    cls: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    iconCls: "text-blue-500",
  },
  high: {
    label: "High",
    cls: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    iconCls: "text-amber-500",
  },
  urgent: {
    label: "Urgent",
    cls: "bg-red-500/15 text-red-600 border-red-500/30",
    iconCls: "text-red-500",
  },
};

export const STATUS_CONFIG: Record<
  string,
  { label: string; cls: string; iconCls: string }
> = {
  open: {
    label: "Open",
    cls: "bg-green-500/15 text-green-600 border-green-500/30",
    iconCls: "text-green-500",
  },
  closed: {
    label: "Closed",
    cls: "bg-gray-500/15 text-gray-500 border-gray-500/30",
    iconCls: "text-gray-500",
  },
  deleted: {
    label: "Deleted",
    cls: "bg-red-500/15 text-red-500 border-red-500/30",
    iconCls: "text-red-500",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatDate(s: string) {
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

// ─── Stat card ───────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("rounded-lg p-2.5", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Copyable ID chip ────────────────────────────────────────────────────────

export function CopyableId({ value }: { value: string }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs bg-muted hover:bg-muted/80 px-1.5 py-0.5 rounded font-mono transition-colors cursor-pointer"
            onClick={() => copyToClipboard(value)}
          >
            {value}
            <Copy className="h-3 w-3 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Copy</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

export function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}
