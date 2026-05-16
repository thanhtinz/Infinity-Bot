import { useGuild } from "@/contexts/GuildContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ExternalLink, Server } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  const selectedGuild = guilds.find(g => g.id === selectedGuildId);

  const handleSelect = (guildId: string) => {
    setSelectedGuildId(guildId);
    queryClient.clear();
  };

  if (isLoading) {
    return (
      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Server className="w-4 h-4 animate-pulse" />
          Đang tải server...
        </div>
      </div>
    );
  }

  if (guilds.length === 0) {
    return (
      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Server className="w-4 h-4" />
          Không có server
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-b">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex items-center justify-between w-full px-3 py-2 rounded-md text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              !selectedGuild && "text-muted-foreground"
            )}
          >
            <span className="flex items-center gap-2 min-w-0">
              {selectedGuild?.icon ? (
                <img
                  src={`https://cdn.discordapp.com/icons/${selectedGuild.id}/${selectedGuild.icon}.png`}
                  alt=""
                  className="w-5 h-5 rounded-full shrink-0"
                />
              ) : (
                <Server className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate">
                {selectedGuild ? selectedGuild.name : "Chọn server..."}
              </span>
            </span>
            <ChevronDown className="w-4 h-4 shrink-0 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {guilds.map(guild => (
            <DropdownMenuItem
              key={guild.id}
              onClick={() => handleSelect(guild.id)}
              className="flex items-center gap-2 cursor-pointer"
            >
              {guild.icon ? (
                <img
                  src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                  alt=""
                  className="w-5 h-5 rounded-full shrink-0"
                />
              ) : (
                <Server className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate flex-1">{guild.name}</span>
              {guild.id === selectedGuildId && (
                <Check className="w-4 h-4 shrink-0 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          {inviteUrl && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer text-indigo-500 focus:text-indigo-500"
                onClick={() => window.open(inviteUrl, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>Mời bot vào server</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
