import { useT } from "@/i18n";
import { useGuild } from "@/contexts/GuildContext";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Server, Loader2 } from "lucide-react";

export function SelectGuildPage() {
  const { t } = useT();
  const { guilds, setSelectedGuildId, isLoading } = useGuild();
  const navigate = useNavigate();
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
    navigate("/bot-settings");
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-[#1E1E2D] via-[#262932] to-[#1E1E2D]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1E1E2D] via-[#262932] to-[#1E1E2D] p-4 pt-10">
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 border border-primary/20 mb-4">
            <Server className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t("selectGuild_selectServer")}</h1>
          <p className="text-white/40 text-sm mt-1">{t("selectGuild_selectDiscord")}</p>
        </div>

        {guilds.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-white/40">
              {t("selectGuild_noGuildsDesc")}
            </p>
            {inviteUrl && (
              <a
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {t("selectGuild_inviteBot")}
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {guilds.map(guild => (
              <button
                key={guild.id}
                onClick={() => handleSelect(guild.id)}
                className="group flex flex-col items-center gap-2 text-center"
              >
                {/* Square avatar card */}
                <div className="w-full aspect-square rounded-2xl overflow-hidden border border-white/5 bg-card group-hover:border-primary/50 group-hover:shadow-[0px_8px_17px_rgba(0,157,181,0.07)] transition-all duration-300">
                  {guild.icon ? (
                    <img
                      src={guild.icon}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-card">
                      <span className="text-4xl font-bold text-white/30">
                        {guild.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                {/* Name below */}
                <p className="text-sm font-medium leading-snug line-clamp-2 w-full px-1 text-white/80 group-hover:text-white transition-colors">{guild.name}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
