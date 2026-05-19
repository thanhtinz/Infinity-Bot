/**
 * useStaffAccess — resolves what sections the current user can access.
 *
 * Flow:
 * 1. If user.is_owner → full access, skip API calls.
 * 2. Fetch Discord member roles via GET /api/discord/member-roles.
 * 3. Fetch permission matrix via GET /api/staff-permissions/check?role_ids=...
 * 4. Return { perms, memberRoles, isOwner, isLoading }.
 *
 * `perms` is an object like { can_shop: true, can_moderation: false, ... }
 * All fields are true when user is owner.
 */

import { useQuery } from "@tanstack/react-query";
import { useGuild } from "@/contexts/GuildContext";

export const PERM_FIELDS = [
  "can_shop",
  "can_moderation",
  "can_community",
  "can_embeds",
  "can_roles",
  "can_utilities",
  "can_backup",
  "can_config",
  "can_ai",
  "can_forms",
  "can_reminders",
] as const;

export type PermField = (typeof PERM_FIELDS)[number];
export type StaffPerms = Record<PermField, boolean>;

const ALL_TRUE: StaffPerms = Object.fromEntries(
  PERM_FIELDS.map((f) => [f, true])
) as StaffPerms;

const ALL_FALSE: StaffPerms = Object.fromEntries(
  PERM_FIELDS.map((f) => [f, false])
) as StaffPerms;

export function useStaffAccess() {
  const { selectedGuildId } = useGuild();

  // Get current user
  const { data: user } = useQuery<{ id: string; is_owner: boolean }>({
    queryKey: ["auth_me"],
    queryFn: () =>
      fetch("/api/auth/me", { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Not logged in");
        return r.json();
      }),
    retry: false,
    staleTime: 60_000,
  });

  const isOwner = !!user?.is_owner;

  // Fetch member roles (skip for owner)
  const { data: memberRolesData, isLoading: rolesLoading } = useQuery<{
    roles: string[];
  }>({
    queryKey: ["member-roles", selectedGuildId],
    queryFn: () =>
      fetch("/api/discord/member-roles", {
        credentials: "include",
        headers: { "X-Guild-ID": selectedGuildId ?? "" },
      }).then((r) => (r.ok ? r.json() : { roles: [] })),
    enabled: !!selectedGuildId && !!user && !isOwner,
    staleTime: 60_000,
  });

  const memberRoles = memberRolesData?.roles ?? [];

  // Fetch permission check (skip for owner or if no roles)
  const { data: permsData, isLoading: permsLoading } = useQuery<StaffPerms>({
    queryKey: ["staff-perms-check", selectedGuildId, memberRoles.join(",")],
    queryFn: () =>
      fetch(
        `/api/staff-permissions/check?role_ids=${encodeURIComponent(memberRoles.join(","))}`,
        {
          credentials: "include",
          headers: { "X-Guild-ID": selectedGuildId ?? "" },
        }
      ).then((r) => (r.ok ? r.json() : ALL_FALSE)),
    enabled: !!selectedGuildId && !isOwner && memberRoles.length > 0,
    staleTime: 60_000,
  });

  // If there are no staff permission rows at all for this guild, grant access
  // (system is opt-in — if nobody configured restrictions, everyone gets in)
  const { data: staffRows } = useQuery<unknown[]>({
    queryKey: ["staff-permissions-list", selectedGuildId],
    queryFn: () =>
      fetch("/api/staff-permissions", {
        credentials: "include",
        headers: { "X-Guild-ID": selectedGuildId ?? "" },
      }).then((r) => (r.ok ? r.json() : [])),
    enabled: !!selectedGuildId && !isOwner,
    staleTime: 60_000,
  });

  const noRulesConfigured = !isOwner && Array.isArray(staffRows) && staffRows.length === 0;

  let perms: StaffPerms;
  if (isOwner || noRulesConfigured) {
    perms = ALL_TRUE;
  } else if (!memberRoles.length) {
    // Not in guild or roles not loaded yet → grant while loading to avoid flicker
    perms = ALL_TRUE;
  } else {
    perms = permsData ?? ALL_FALSE;
  }

  const isLoading = !user || (!isOwner && rolesLoading) || (!isOwner && permsLoading);

  return {
    perms,
    memberRoles,
    isOwner,
    isLoading,
  };
}
