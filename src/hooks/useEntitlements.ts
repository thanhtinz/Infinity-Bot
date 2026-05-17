/**
 * useEntitlements — fetches guild premium entitlements.
 * Owner always gets has_access=true (server-side bypass).
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";

export interface Entitlements {
  plan: { id: number; name: string; code: string; color: string } | null;
  status: string;             // "active" | "trial" | "free" | "owner_bypass" | …
  features: Record<string, boolean | number | string>;
  expires_at?: string;
  is_owner: boolean;
  has_access: boolean;        // true = guild has active premium OR is_owner
}

async function fetchEntitlements(guildId: string): Promise<Entitlements> {
  const res = await apiFetch("/api/premium/entitlements", {
    headers: { "X-Guild-ID": guildId },
  });
  if (!res.ok) return { plan: null, status: "free", features: {}, is_owner: false, has_access: false };
  return res.json();
}

export function useEntitlements() {
  const { selectedGuildId } = useGuild();

  const query = useQuery<Entitlements>({
    queryKey: ["premium-entitlements", selectedGuildId],
    queryFn: () =>
      selectedGuildId
        ? fetchEntitlements(selectedGuildId)
        : Promise.resolve({ plan: null, status: "free", features: {}, is_owner: false, has_access: false }),
    enabled: !!selectedGuildId,
    staleTime: 60_000,
  });

  const ent = query.data;

  /**
   * Check if the guild has access to a specific feature key.
   * Owner always returns true.
   * Free guilds return false for any feature.
   */
  function hasFeature(key: string): boolean {
    if (!ent) return false;
    if (ent.is_owner) return true;
    if (!ent.has_access) return false;
    const val = ent.features[key];
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val > 0;
    return !!val;
  }

  return {
    entitlements: ent,
    isLoading: query.isLoading,
    hasPremium: ent?.has_access ?? false,
    isOwner: ent?.is_owner ?? false,
    hasFeature,
    planName: ent?.plan?.name ?? null,
    planColor: ent?.plan?.color ?? "#6366f1",
  };
}
