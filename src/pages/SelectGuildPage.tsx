import { useGuild } from "@/contexts/GuildContext";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Server, Loader2 } from "lucide-react";

export function SelectGuildPage() {
  const { guilds, setSelectedGuildId, isLoading } = useGuild();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleSelect = (guildId: string) => {
    setSelectedGuildId(guildId);
    queryClient.clear();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Server className="w-12 h-12 mx-auto mb-4 text-primary" />
          <h1 className="text-2xl font-bold">Chọn server</h1>
          <p className="text-muted-foreground mt-2">Chọn server Discord để tiếp tục quản lý</p>
        </div>
        <div className="space-y-2">
          {guilds.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Bot chưa ở trong server nào. Vui lòng thêm bot vào server trước.
            </p>
          ) : (
            guilds.map(guild => (
              <button
                key={guild.id}
                onClick={() => handleSelect(guild.id)}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
              >
                {guild.icon ? (
                  <img
                    src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                    alt=""
                    className="w-10 h-10 rounded-full shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Server className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium truncate">{guild.name}</p>
                  {guild.member_count != null && (
                    <p className="text-xs text-muted-foreground">{guild.member_count} thành viên</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
