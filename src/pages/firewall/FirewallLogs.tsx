import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  ScrollText,
  ShieldCheck,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Shield,
  XCircle,
  User,
  Globe,
  KeyRound,
  Captions,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface FirewallLog {
  id: number;
  discord_id: string | null;
  username: string | null;
  avatar_url: string | null;
  ip_address: string | null;
  country: string | null;
  blocked_by: string;
  rule_id: number | null;
  details: Record<string, unknown> | null;
  created_at: string | null;
}

interface FirewallStats {
  total_rules: number;
  blocks_24h: number;
  blocks_week: number;
  breakdown: Record<string, number>;
}

const BLOCKED_BY_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  vpn: { label: "VPN", icon: Globe, color: "bg-blue-500/10 text-blue-500" },
  alt: { label: "Alt Account", icon: User, color: "bg-purple-500/10 text-purple-500" },
  firewall: { label: "Firewall Rule", icon: Shield, color: "bg-red-500/10 text-red-500" },
  age: { label: "Account Age", icon: KeyRound, color: "bg-orange-500/10 text-orange-500" },
  captcha: { label: "Captcha", icon: Captions, color: "bg-yellow-500/10 text-yellow-500" },
};

const PAGE_SIZE = 25;

// ── Component ──────────────────────────────────────────────────────────────

export function FirewallLogs() {
  const [filterBy, setFilterBy] = useState<string>("all");
  const [page, setPage] = useState(0);

  // ── Queries ──

  const { data: stats } = useQuery<FirewallStats>({
    queryKey: ["firewall-stats"],
    queryFn: async () => {
      const r = await apiFetch("/api/firewall/stats");
      if (!r.ok) return null;
      return r.json();
    },
  });

  const { data: logs = [], isLoading } = useQuery<FirewallLog[]>({
    queryKey: ["firewall-logs", filterBy, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterBy !== "all") params.set("blocked_by", filterBy);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      const r = await apiFetch(`/api/firewall/logs?${params}`);
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // ── Helpers ──

  function maskIp(ip: string | null): string {
    if (!ip) return "-";
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***`;
    }
    // IPv6 or other — mask last two segments
    const segments = ip.split(":");
    if (segments.length > 2) {
      return segments.slice(0, -2).join(":") + ":****:****";
    }
    return ip;
  }

  // ── Render ──

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Firewall Logs</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.blocks_24h ?? "-"}</p>
              <p className="text-xs text-muted-foreground">Blocked (24h)</p>
            </div>
          </CardContent>
        </Card>
        {Object.entries(BLOCKED_BY_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const count = stats?.breakdown?.[key] ?? 0;
          return (
            <Card key={key}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", cfg.color.split(" ")[0])}>
                  <Icon className={cn("h-4 w-4", cfg.color.split(" ")[1])} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={filterBy} onValueChange={(v) => { setFilterBy(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(BLOCKED_BY_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                {cfg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Logs Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldCheck className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No blocked attempts.</p>
            <p className="text-xs text-muted-foreground/70">Your server is safe!</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden md:table-cell">IP Address</TableHead>
                  <TableHead className="hidden sm:table-cell">Country</TableHead>
                  <TableHead>Block Reason</TableHead>
                  <TableHead className="hidden lg:table-cell">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const cfg = BLOCKED_BY_CONFIG[log.blocked_by];
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            {log.avatar_url && <AvatarImage src={log.avatar_url} />}
                            <AvatarFallback className="text-xs">
                              {log.username?.charAt(0)?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate max-w-[140px]">
                            {log.username || log.discord_id || "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {maskIp(log.ip_address)}
                        </code>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm">{log.country || "-"}</span>
                      </TableCell>
                      <TableCell>
                        {cfg ? (
                          <Badge variant="outline" className={cn("text-xs", cfg.color)}>
                            {cfg.label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {log.blocked_by}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {log.created_at
                            ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true })
                            : "-"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page + 1}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={logs.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
