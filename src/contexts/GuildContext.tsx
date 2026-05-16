import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  member_count?: number;
}

interface GuildContextType {
  selectedGuildId: string | null;
  setSelectedGuildId: (id: string) => void;
  guilds: Guild[];
  setGuilds: (guilds: Guild[]) => void;
  isLoading: boolean;
}

const GuildContext = createContext<GuildContextType | null>(null);

export function GuildProvider({ children }: { children: ReactNode }) {
  const [selectedGuildId, setSelectedGuildIdState] = useState<string | null>(() => {
    return localStorage.getItem("selected_guild_id");
  });
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const setSelectedGuildId = (id: string) => {
    localStorage.setItem("selected_guild_id", id);
    setSelectedGuildIdState(id);
  };

  useEffect(() => {
    fetch("/api/guilds", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: Guild[]) => {
        setGuilds(data);
        if (data.length === 1 && !selectedGuildId) {
          setSelectedGuildId(data[0].id);
        }
      })
      .catch(() => setGuilds([]))
      .finally(() => setIsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GuildContext.Provider value={{ selectedGuildId, setSelectedGuildId, guilds, setGuilds, isLoading }}>
      {children}
    </GuildContext.Provider>
  );
}

export function useGuild() {
  const ctx = useContext(GuildContext);
  if (!ctx) throw new Error("useGuild must be used within GuildProvider");
  return ctx;
}

export type { Guild, GuildContextType };
