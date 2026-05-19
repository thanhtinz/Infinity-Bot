export function getGuildHeaders(): Record<string, string> {
  const guildId = localStorage.getItem("selected_guild_id");
  const headers: Record<string, string> = {};
  if (guildId) {
    headers["X-Guild-ID"] = guildId;
  }
  const memberRoles = localStorage.getItem("member_roles");
  if (memberRoles) {
    headers["X-Member-Roles"] = memberRoles;
  }
  return headers;
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const guildId = localStorage.getItem("selected_guild_id");
  const memberRoles = localStorage.getItem("member_roles");
  const headers = new Headers(options.headers);
  if (guildId) {
    headers.set("X-Guild-ID", guildId);
  }
  if (memberRoles) {
    headers.set("X-Member-Roles", memberRoles);
  }
  return fetch(url, { ...options, headers, credentials: "include" });
}
