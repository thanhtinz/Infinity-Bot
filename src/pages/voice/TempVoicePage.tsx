import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useVoiceStats } from "@/hooks/useVoiceConfig";
import { useT } from "@/i18n";
import { Mic, List, BarChart3, Settings, Shield, Filter, Wrench } from "lucide-react";

export function TempVoicePage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useVoiceStats();

  const statCards = [
    { label: t("voice_activeRooms"), value: stats?.active_rooms ?? 0, icon: Mic },
    { label: t("voice_totalRooms"), value: stats?.total_events ?? 0, icon: BarChart3 },
  ];

  const links = [
    { label: t("voice_setup"), path: "/voice/setup", icon: Settings },
    { label: t("voice_defaults"), path: "/voice/defaults", icon: Wrench },
    { label: t("voice_permissions"), path: "/voice/permissions", icon: Shield },
    { label: t("voice_cleanup"), path: "/voice/cleanup", icon: Filter },
    { label: t("voice_rooms"), path: "/voice/rooms", icon: List },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("voice_title")}</h1>

      {/* Stats */}
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

      {/* Quick nav */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {links.map((l) => (
          <Card
            key={l.path}
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => navigate(l.path)}
          >
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <l.icon className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">{l.label}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Recent Logs / Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("voice_analytics")}</CardTitle>
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
