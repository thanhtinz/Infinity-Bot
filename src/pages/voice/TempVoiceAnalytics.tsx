import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useVoiceStats } from "@/hooks/useVoiceConfig";
import { useT } from "@/i18n";
import { Mic, BarChart3 } from "lucide-react";

export function TempVoiceAnalytics() {
  const { t } = useT();
  const { data: stats, isLoading } = useVoiceStats();

  const statCards = [
    { label: t("voice_activeRooms"), value: stats?.active_rooms ?? 0, icon: Mic },
    { label: t("voice_totalRooms"), value: stats?.total_events ?? 0, icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("voice_analytics")}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {statCards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : <span className="text-2xl font-bold">{c.value}</span>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !stats?.recent_logs?.length ? (
            <p className="text-sm text-muted-foreground">No recent logs.</p>
          ) : (
            <div className="divide-y">
              {stats.recent_logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{log.actor_name}</span>
                  <span className="text-muted-foreground truncate mx-4 flex-1">{log.description}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
