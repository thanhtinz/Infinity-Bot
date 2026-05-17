import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Inbox, Shield, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import type { TicketRow, BlacklistEntry } from "./ticketHelpers";
import { PRIORITY_CONFIG, STATUS_CONFIG, formatDate, TableSkeleton } from "./ticketHelpers";

// ─── Ticket Table ────────────────────────────────────────────────────────────

export interface TicketTableProps {
  tickets: TicketRow[];
  isLoading: boolean;
  panelMap: Map<number, string>;
  onViewDetail: (id: number) => void;
}

export function TicketTable({ tickets, isLoading, panelMap, onViewDetail }: TicketTableProps) {
  const { t } = useT();
  if (isLoading) return <TableSkeleton />;

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Inbox className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm font-medium">{t("ticket_noTicketsYet")}</p>
        <p className="text-xs mt-1">{t("ticket_tryChangingFilters")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>{t("tickets_subject")}</TableHead>
            <TableHead>{t("tickets_creator")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("tickets_priority")}</TableHead>
            <TableHead>{t("ticket_claimed")}</TableHead>
            <TableHead>{t("ticketPanels_panels")}</TableHead>
            <TableHead>{t("tickets_createdAt")}</TableHead>
            <TableHead className="w-24 text-right">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow key={ticket.id}>
              <TableCell className="font-mono text-sm">#{ticket.id}</TableCell>
              <TableCell className="max-w-[200px] truncate">
                {ticket.subject || (
                  <span className="text-muted-foreground italic">
                    {t("ticket_noSubject")}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {ticket.creator_id}
                </code>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn("text-[11px]", STATUS_CONFIG[ticket.status]?.cls)}
                >
                  {t(STATUS_CONFIG[ticket.status]?.label ?? ticket.status)}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn("text-[11px]", PRIORITY_CONFIG[ticket.priority]?.cls)}
                >
                  {t(PRIORITY_CONFIG[ticket.priority]?.label ?? ticket.priority)}
                </Badge>
              </TableCell>
              <TableCell>
                {ticket.claimed_by ? (
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {ticket.claimed_by}
                  </code>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {ticket.panel_id != null
                  ? panelMap.get(ticket.panel_id) ?? (
                      <span className="text-muted-foreground">#{ticket.panel_id}</span>
                    )
                  : "—"}
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap">
                {formatDate(ticket.created_at)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onViewDetail(ticket.id)}
                >
                  {t("tickets_viewDetail")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Blacklist Table ─────────────────────────────────────────────────────────

export interface BlacklistTableProps {
  blacklist: BlacklistEntry[];
  isLoading: boolean;
  isRemoving: boolean;
  onRemove: (id: number) => void;
}

export function BlacklistTable({ blacklist, isLoading, isRemoving, onRemove }: BlacklistTableProps) {
  const { t } = useT();
  if (isLoading) return <TableSkeleton />;

  if (blacklist.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Shield className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm font-medium">{t("ticket_noBlacklistYet")}</p>
        <p className="text-xs mt-1">
          {t("ticket_blacklistHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("ticket_discordId")}</TableHead>
            <TableHead>{t("reason")}</TableHead>
            <TableHead>{t("ticket_addedBy")}</TableHead>
            <TableHead>{t("ticket_dateAdded")}</TableHead>
            <TableHead className="w-24 text-right">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {blacklist.map((b) => (
            <TableRow key={b.id}>
              <TableCell>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {b.discord_id}
                </code>
              </TableCell>
              <TableCell className="max-w-[300px] truncate text-sm">
                {b.reason || (
                  <span className="text-muted-foreground italic">
                    {t("ticket_noReason")}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {b.added_by}
                </code>
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap">
                {formatDate(b.created_at)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  disabled={isRemoving}
                  onClick={() => onRemove(b.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  {t("delete")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
