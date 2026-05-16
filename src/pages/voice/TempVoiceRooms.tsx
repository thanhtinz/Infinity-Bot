import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useVoiceRooms } from "@/hooks/useVoiceConfig";
import { useT } from "@/i18n";
import { Trash2 } from "lucide-react";

function truncate(id: string | null, len = 12) {
  if (!id) return "—";
  return id.length > len ? id.slice(0, len) + "…" : id;
}

function relativeTime(date: string | null) {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function TempVoiceRooms() {
  const { t } = useT();
  const { rooms, isLoading, deleteRoom, cleanupAll, isCleaning } = useVoiceRooms();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("voice_rooms")}</h1>
        <Button variant="outline" size="sm" onClick={() => cleanupAll()} disabled={isCleaning}>
          {t("voice_cleanupAll")}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : rooms.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("voice_noRooms")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {rooms.map((room) => (
                <div key={room.id} className="flex items-center justify-between px-4 py-3">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 flex-1 text-sm">
                    <span className="font-mono text-xs" title={room.channel_id}>{truncate(room.channel_id)}</span>
                    <span className="font-mono text-xs" title={room.owner_id ?? ""}>{truncate(room.owner_id)}</span>
                    <span className="truncate">{room.room_name ?? "—"}</span>
                    <Badge variant="secondary">{room.peak_members}</Badge>
                    <span className="text-muted-foreground text-xs">{relativeTime(room.created_at)}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteRoom(room.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
