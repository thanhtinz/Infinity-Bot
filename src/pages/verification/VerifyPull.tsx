import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowDownToLine,
  Users,
  CheckCircle2,
  Loader2,
  Play,
  Square,
  XCircle,
} from "lucide-react";
import {
  fetchStats,
  startPull,
  stopPull,
  fetchPullStatus,
  fetchPullHistory,
  formatDate,
} from "./shared";
import { PremiumBadge, PremiumGate } from "@/components/ui/premium-gate";
import { useEntitlements } from "@/hooks/useEntitlements";

export function VerifyPull() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { hasFeature, isLoading: entLoading } = useEntitlements();

  const [pullRestoreRoles, setPullRestoreRoles] = useState(true);
  const [pullDelay, setPullDelay] = useState(5);
  const logEndRef = useRef<HTMLDivElement>(null);

  const statsQuery = useQuery({
    queryKey: ["verification-stats"],
    queryFn: fetchStats,
  });

  const pullStatusQuery = useQuery({
    queryKey: ["member-pull-status"],
    queryFn: fetchPullStatus,
    refetchInterval: 3000,
  });

  const pullHistoryQuery = useQuery({
    queryKey: ["member-pull-history"],
    queryFn: fetchPullHistory,
  });

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pullStatusQuery.data?.log?.length]);

  const startPullMutation = useMutation({
    mutationFn: startPull,
    onSuccess: () => {
      toast({ title: "Member pull started" });
      qc.invalidateQueries({ queryKey: ["member-pull-status"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const stopPullMutation = useMutation({
    mutationFn: stopPull,
    onSuccess: () => {
      toast({ title: "Member pull stopped" });
      qc.invalidateQueries({ queryKey: ["member-pull-status"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ArrowDownToLine className="h-6 w-6" />
          Member Pull
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Pull verified members back into the Discord server.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pullable Members</p>
              <p className="text-2xl font-bold">{statsQuery.data?.pullable ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Pull Status</p>
              <p className="text-2xl font-bold capitalize">
                {pullStatusQuery.data?.status?.replace("_", " ") ?? "None"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Start pull controls */}
      {!pullStatusQuery.data?.active && (
        <PremiumGate feature="pull_members" featureLabel="Pull Members" hasAccess={hasFeature("pull_members")} isLoading={entLoading}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">Start Member Pull {!hasFeature("pull_members") && !entLoading && <PremiumBadge size="xs" />}</CardTitle>
            <CardDescription>
              Pull all verified members back into the Discord server with a join delay to avoid rate limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Restore Roles</Label>
                <p className="text-xs text-muted-foreground">Re-assign roles to pulled members</p>
              </div>
              <Switch
                checked={pullRestoreRoles}
                onCheckedChange={setPullRestoreRoles}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Join Delay</Label>
                <span className="text-sm text-muted-foreground">{pullDelay} seconds</span>
              </div>
              <Slider
                value={[pullDelay]}
                onValueChange={([v]) => setPullDelay(v)}
                min={1}
                max={30}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Delay between each member join to avoid Discord rate limits
              </p>
            </div>

            <Button
              onClick={() => startPullMutation.mutate({ restore_roles: pullRestoreRoles, join_delay_seconds: pullDelay })}
              disabled={startPullMutation.isPending}
              className="gap-1.5"
            >
              {startPullMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Start Pull
            </Button>
          </CardContent>
        </Card>
        </PremiumGate>
      )}

      {/* Active pull progress */}
      {pullStatusQuery.data?.active && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Pull in Progress
              </CardTitle>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => stopPullMutation.mutate()}
                disabled={stopPullMutation.isPending}
                className="gap-1.5"
              >
                <Square className="h-3.5 w-3.5" />
                Stop
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {pullStatusQuery.data.pulled_members} / {pullStatusQuery.data.total_members} members
                </span>
                <span className="text-muted-foreground">
                  {pullStatusQuery.data.total_members > 0
                    ? Math.round(
                        (pullStatusQuery.data.pulled_members / pullStatusQuery.data.total_members) * 100
                      )
                    : 0}
                  %
                </span>
              </div>
              <Progress
                value={
                  pullStatusQuery.data.total_members > 0
                    ? (pullStatusQuery.data.pulled_members / pullStatusQuery.data.total_members) * 100
                    : 0
                }
              />
              {pullStatusQuery.data.failed_members > 0 && (
                <p className="text-xs text-destructive">
                  {pullStatusQuery.data.failed_members} failed
                </p>
              )}
            </div>

            {/* Live log */}
            {pullStatusQuery.data.log.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Live Log</Label>
                <ScrollArea className="h-48 rounded-lg border bg-muted/30 p-2">
                  {pullStatusQuery.data.log.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs py-0.5 font-mono"
                    >
                      <span className="text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="font-medium">{entry.username}</span>
                      {entry.status === "success" ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      {entry.error && (
                        <span className="text-destructive">— {entry.error}</span>
                      )}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pull history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pull History</CardTitle>
        </CardHeader>
        <CardContent>
          {pullHistoryQuery.isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !pullHistoryQuery.data?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No pull history yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pulled</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pullHistoryQuery.data.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm">
                      {formatDate(h.started_at)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          h.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                            : h.status === "failed"
                            ? "bg-red-500/15 text-red-600 border-red-500/30"
                            : "bg-primary/15 text-primary border-primary/30"
                        }
                      >
                        {h.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{h.pulled_members}</TableCell>
                    <TableCell>{h.failed_members}</TableCell>
                    <TableCell>{h.total_members}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
