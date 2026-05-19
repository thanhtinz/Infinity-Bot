import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";
import {
  BarChart3, CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/yuri";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PollOption {
  label: string;
  votes: number;
}

interface Poll {
  id: number;
  guild_id: string;
  question: string;
  options: PollOption[];
  end_time?: string;
  ended: boolean;
  created_at?: string;
}

interface PollStats {
  total: number;
  active: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PollsPage() {
  const { selectedGuildId } = useGuild();

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: polls = [], isLoading } = useQuery<Poll[]>({
    queryKey: ["polls", selectedGuildId],
    queryFn: () => apiFetch("/api/polls").then((r) => r.json()),
    enabled: !!selectedGuildId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<PollStats>({
    queryKey: ["polls-stats", selectedGuildId],
    queryFn: () => apiFetch("/api/polls/stats").then((r) => r.json()),
    enabled: !!selectedGuildId,
  });

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoading || statsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  return (
    <PageContainer size="md">
      <PageHeader title="Polls" description="View poll results. Polls are created via bot commands." icon={BarChart3} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground"><BarChart3 className="h-4 w-4" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Polls</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="p-2 rounded-md bg-green-500/10 text-green-600"><CheckCircle className="h-4 w-4" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.active ?? 0}</p>
              <p className="text-xs text-muted-foreground">Active Polls</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Polls List */}
      <div className="space-y-4">
        {polls.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No polls found. Create one using a bot command.
            </CardContent>
          </Card>
        ) : (
          polls.map((poll) => {
            const maxVotes = Math.max(...poll.options.map((o) => o.votes), 1);
            const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);

            return (
              <Card key={poll.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{poll.question}</CardTitle>
                    {poll.ended ? (
                      <Badge variant="outline" className="text-xs bg-gray-500/15 text-gray-500">Ended</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-green-500/15 text-green-600 dark:text-green-400">Active</Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    {poll.end_time ? `Ends: ${formatDate(poll.end_time)}` : "No end time"} &middot; {totalVotes} total vote{totalVotes !== 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {poll.options.map((opt, i) => {
                    const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                    const barWidth = totalVotes > 0 ? (opt.votes / maxVotes) * 100 : 0;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate">{opt.label}</span>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">{opt.votes} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              poll.ended ? "bg-muted-foreground/40" : "bg-primary"
                            )}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </PageContainer>
  );
}
