import { useGuild } from "@/contexts/GuildContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Server } from "lucide-react";
import { cn } from "@/lib/utils";

export function GuildSelector() {
  const { selectedGuildId, setSelectedGuildId, guilds, isLoading } = useGuild();
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
  };

  if (isLoading) {
    return (
      <div className="px-3 py-3 border-b">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Server className="w-3.5 h-3.5 animate-pulse" />
          Đang tải server...
        </div>
      </div>
    );
  }

  if (guilds.length === 0) {
    return (
      <div className="px-3 py-3 border-b space-y-2">
        <p className="text-xs text-muted-foreground">Chưa có server nào</p>
        {inviteUrl && (
          <a
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-400 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Mời bot vào server
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="px-3 py-3 border-b">
      {/* Grid: 2 cột cố định */}
      <div className="grid grid-cols-2 gap-1.5">
        {guilds.map(guild => {
          const isSelected = guild.id === selectedGuildId;
          const iconUrl = guild.icon
            ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
            : null;

          return (
            <button
              key={guild.id}
              onClick={() => handleSelect(guild.id)}
              title={guild.name}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors text-center group",
                isSelected
                  ? "bg-primary/10 ring-1 ring-primary/40"
                  : "hover:bg-accent"
              )}
            >
              {/* Avatar vuông */}
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt={guild.name}
                  className="w-10 h-10 rounded-lg shrink-0 object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-muted-foreground">
                    {guild.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {/* Tên server */}
              <span className={cn(
                "text-[10px] leading-tight w-full truncate font-medium",
                isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )}>
                {guild.name}
              </span>
            </button>
          );
        })}

        {/* Nút mời bot */}
        {inviteUrl && (
          <a
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Mời bot vào server"
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-accent transition-colors text-center group"
          >
            <div className="w-10 h-10 rounded-lg border-2 border-dashed border-indigo-400/50 flex items-center justify-center shrink-0 group-hover:border-indigo-400">
              <ExternalLink className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="text-[10px] leading-tight w-full truncate font-medium text-indigo-400">
              Thêm server
            </span>
          </a>
        )}
      </div>
    </div>
  );
}
