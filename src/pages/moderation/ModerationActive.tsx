import { useT } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/hooks/useApi";
import { Clock } from "lucide-react";
import type { ModCase } from "./shared";
import { actionBadge, truncate, Countdown } from "./shared";

export function ModerationActive() {
  const { t } = useT();

  const { data: activeCases = [], isLoading: activeLoading } = useQuery<ModCase[]>({
    queryKey: ["moderation-active"],
    queryFn: () => apiFetch("/api/moderation/active").then((r) => r.json()),
  });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" />
          {t("mod_allActions")}
        </h2>
      </div>

      {/* ── Active list ── */}
      {activeLoading && activeCases.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          {t("loading")}
        </div>
      ) : activeCases.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          {t("noData")}
        </div>
      ) : (
        <div className="space-y-2">
          {activeCases.map((c) => {
            const badge = actionBadge(c.action);
            return (
              <Card key={c.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <Badge className={cn("gap-1 text-[10px] capitalize shrink-0", badge.cls)}>
                    {badge.icon}
                    {c.action}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium truncate">
                        {c.target_name || c.target_id}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        #{c.case_number}
                      </span>
                    </div>
                    {c.reason && (
                      <p className="text-xs text-muted-foreground truncate">
                        {truncate(c.reason, 60)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end shrink-0 gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      {t("mod_expiresIn")}
                    </span>
                    {c.expires_at ? (
                      <Countdown expiresAt={c.expires_at} />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
