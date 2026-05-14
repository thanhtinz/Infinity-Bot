import { useQuery } from "@tanstack/react-query";

export interface DiscordChannel {
  id: string;
  name: string;
  type: number; // 0=text, 2=voice, 4=category, 5=announcement, 13=stage, 15=forum
  parent_id: string | null;
  position: number;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
}

export function useDiscordChannels(guildId?: string) {
  return useQuery<DiscordChannel[]>({
    queryKey: ["discord_channels_all", guildId],
    queryFn: async () => {
      const params = guildId ? `?guild_id=${guildId}` : "";
      const res = await fetch(`/api/discord/channels/all${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useDiscordRoles(guildId?: string) {
  return useQuery<DiscordRole[]>({
    queryKey: ["discord_roles", guildId],
    queryFn: async () => {
      const params = guildId ? `?guild_id=${guildId}` : "";
      const res = await fetch(`/api/discord/roles${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });
}
