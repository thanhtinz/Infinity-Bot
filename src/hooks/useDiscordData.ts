import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";

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
  const { selectedGuildId } = useGuild();
  const effectiveGuildId = guildId || selectedGuildId || "";

  return useQuery<DiscordChannel[]>({
    queryKey: ["discord_channels_all", effectiveGuildId],
    queryFn: async () => {
      const params = effectiveGuildId ? `?guild_id=${effectiveGuildId}` : "";
      const res = await apiFetch(`/api/discord/channels/all${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!effectiveGuildId,
    staleTime: 60_000,
  });
}

export function useDiscordRoles(guildId?: string) {
  const { selectedGuildId } = useGuild();
  const effectiveGuildId = guildId || selectedGuildId || "";

  return useQuery<DiscordRole[]>({
    queryKey: ["discord_roles", effectiveGuildId],
    queryFn: async () => {
      const params = effectiveGuildId ? `?guild_id=${effectiveGuildId}` : "";
      const res = await apiFetch(`/api/discord/roles${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!effectiveGuildId,
    staleTime: 60_000,
  });
}
