import { useGuild } from "@/contexts/GuildContext";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Server, Loader2 } from "lucide-react";

export function SelectGuildPage() {
  const { guilds, setSelectedGuildId, isLoading } = useGuild();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: config } = useQuery<{ discord_client_id?: string }>({
    queryKey: ["system_config"],
    queryFn: () => fetch("/api/config", { credentials: "include" }).then(r => r.json()),
    staleTime: 60_000,
  });

  const inviteUrl = config?.discord_client_id
    ? `https://discord.com/oauth2/authorize?client_id=${config.discord_client_id}&permissions=8&scope=bot%20applications.commands`
    : null;

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
    <div className="min-h-screen bg-background p-4 pt-10">
      <div className="w-full max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <Server className="w-10 h-10 mx-auto mb-3 text-primary" />
          <h1 className="text-xl font-bold">Chọn server</h1>
          <p className="text-muted-foreground text-sm mt-1">Chọn server Discord để tiếp tục quản lý</p>
        </div>

        {guilds.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">
              Bot chưa ở trong server nào. Vui lòng thêm bot vào server trước.
            </p>
            {inviteUrl && (
              <a
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Mời bot vào server
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {guilds.map(guild => (
              <button
                key={guild.id}
                onClick={() => handleSelect(guild.id)}
                className="group flex flex-col items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent hover:border-primary/30 transition-all text-center"
              >
                {guild.icon ? (
                  <img
                    src={guild.icon}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center group-hover:scale-105 transition-transform">
                    <span className="text-2xl font-bold text-muted-foreground">
                      {guild.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <p className="text-sm font-medium leading-snug line-clamp-2 w-full">{guild.name}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
