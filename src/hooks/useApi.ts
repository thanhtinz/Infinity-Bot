export function getGuildHeaders(): Record<string, string> {
  const guildId = localStorage.getItem("selected_guild_id");
  if (guildId) {
    return { "X-Guild-ID": guildId };
  }
  return {};
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const guildId = localStorage.getItem("selected_guild_id");
  const headers = new Headers(options.headers);
  if (guildId) {
    headers.set("X-Guild-ID", guildId);
  }
  return fetch(url, { ...options, headers, credentials: "include" });
}
