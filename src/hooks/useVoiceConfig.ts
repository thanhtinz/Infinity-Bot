import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGuild } from "@/contexts/GuildContext";
import { apiFetch } from "./useApi";
import { toast } from "@/hooks/use-toast";

export interface VoiceConfig {
  enabled: boolean;
  join_channel_id: string | null;
  category_id: string | null;
  interface_channel_id: string | null;
  voice_buttons: string[];
  default_user_limit: number;
  default_bitrate: number;
  naming_format: string;
  default_visibility: "public" | "private";
  auto_delete_seconds: number;
  inactive_cleanup_minutes: number;
  max_rooms_per_user: number;
  max_rooms_per_guild: number;
  rename_cooldown_seconds: number;
  allow_rename: boolean;
  allow_limit: boolean;
  allow_lock: boolean;
  allow_hide: boolean;
  allow_invite: boolean;
  allow_kick: boolean;
  allow_transfer: boolean;
  allow_claim: boolean;
  bypass_role_ids: string[];
  blacklist_role_ids: string[];
}

export const VOICE_CONFIG_DEFAULT: VoiceConfig = {
  enabled: false,
  join_channel_id: null,
  category_id: null,
  interface_channel_id: null,
  voice_buttons: [
    "name", "limit", "privacy", "trust", "untrust",
    "invite", "kick", "region", "block", "unblock",
    "claim", "transfer", "delete",
  ],
  default_user_limit: 0,
  default_bitrate: 64000,
  naming_format: "{user}'s Channel",
  default_visibility: "public",
  auto_delete_seconds: 0,
  inactive_cleanup_minutes: 0,
  max_rooms_per_user: 0,
  max_rooms_per_guild: 0,
  rename_cooldown_seconds: 0,
  allow_rename: true,
  allow_limit: true,
  allow_lock: true,
  allow_hide: true,
  allow_invite: true,
  allow_kick: true,
  allow_transfer: true,
  allow_claim: true,
  bypass_role_ids: [],
  blacklist_role_ids: [],
};

export interface VoiceRoom {
  id: number;
  channel_id: string;
  owner_id: string | null;
  room_name: string | null;
  peak_members: number;
  created_at: string | null;
}

export interface VoiceStats {
  active_rooms: number;
  total_events: number;
  recent_logs: Array<{
    id: number;
    event_type: string;
    actor_name: string;
    actor_avatar: string | null;
    target_name: string | null;
    description: string | null;
    created_at: string | null;
  }>;
}

export function useVoiceConfig() {
  const { selectedGuildId } = useGuild();
  const qc = useQueryClient();

  const query = useQuery<VoiceConfig>({
    queryKey: ["tempvoice-config", selectedGuildId],
    queryFn: async () => {
      const r = await apiFetch("/api/tempvoice/config");
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
    enabled: !!selectedGuildId,
    placeholderData: VOICE_CONFIG_DEFAULT,
  });

  const mutation = useMutation({
    mutationFn: async (data: Partial<VoiceConfig>) => {
      const r = await apiFetch("/api/tempvoice/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Save failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tempvoice-config", selectedGuildId] });
      toast({ title: "Saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save settings.", variant: "destructive" });
    },
  });

  return {
    config: query.data ?? VOICE_CONFIG_DEFAULT,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
  };
}

export function useVoiceRooms() {
  const { selectedGuildId } = useGuild();
  const qc = useQueryClient();

  const query = useQuery<VoiceRoom[]>({
    queryKey: ["tempvoice-rooms", selectedGuildId],
    queryFn: async () => {
      const r = await apiFetch("/api/tempvoice/rooms");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedGuildId,
    refetchInterval: 30_000,
  });

  const deleteRoom = useMutation({
    mutationFn: async (roomId: number) => {
      const r = await apiFetch(`/api/tempvoice/rooms/${roomId}/delete`, { method: "POST" });
      if (!r.ok) throw new Error("Delete failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tempvoice-rooms", selectedGuildId] }),
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const cleanupAll = useMutation({
    mutationFn: async () => {
      const r = await apiFetch("/api/tempvoice/rooms/cleanup", { method: "POST" });
      if (!r.ok) throw new Error("Cleanup failed");
      return r.json();
    },
    onSuccess: (d: { deleted: number }) => {
      qc.invalidateQueries({ queryKey: ["tempvoice-rooms", selectedGuildId] });
      toast({ title: `Deleted ${d.deleted} room(s)` });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  return {
    rooms: query.data ?? [],
    isLoading: query.isLoading,
    deleteRoom: deleteRoom.mutate,
    cleanupAll: cleanupAll.mutate,
    isCleaning: cleanupAll.isPending,
    refetch: query.refetch,
  };
}

export function useVoiceStats() {
  const { selectedGuildId } = useGuild();
  return useQuery<VoiceStats>({
    queryKey: ["tempvoice-stats", selectedGuildId],
    queryFn: async () => {
      const r = await apiFetch("/api/tempvoice/stats");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedGuildId,
  });
}
