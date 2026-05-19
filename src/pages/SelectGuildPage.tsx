import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useGuild } from "@/contexts/GuildContext";
import { Server, Plus, Loader2, Users } from "lucide-react";
import { LandingNavbar } from "@/components/LandingNavbar";

export function SelectGuildPage() {
  const navigate = useNavigate();
  const { setSelectedGuildId, guilds, isLoading } = useGuild();
  const { data: _user } = useQuery({
    queryKey: ["auth_me"],
    queryFn: () => fetch("/api/auth/me", { credentials: "include" }).then(r => r.ok ? r.json() : null),
    retry: false,
  });

  const handleSelect = (id: string) => {
    setSelectedGuildId(id);
    navigate("/bot-settings");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1E1E2D] to-[#262932] text-white animate-fade-in">
      <LandingNavbar />
      <div className="pt-[120px] pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          {/* PageHeader */}
          <div className="text-center mb-10">
            <div className="w-12 h-12 rounded-[10px] bg-[#009DB5]/10 flex items-center justify-center mx-auto mb-4">
              <Server className="w-6 h-6 text-[#009DB5]" />
            </div>
            <h1 className="text-[28px] font-bold text-white tracking-tight">Select a Server</h1>
            <p className="mt-2 text-[14px] text-[#9FA8C1]">Choose a server to manage</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-[#009DB5]" />
            </div>
          ) : guilds.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-[10px] bg-[#009DB5]/10 flex items-center justify-center mx-auto mb-4">
                <Server className="w-8 h-8 text-[#009DB5]" />
              </div>
              <h2 className="text-xl font-bold mb-2">No Servers Found</h2>
              <p className="text-[#9FA8C1] text-[14px] mb-6">Add the bot to a server to get started.</p>
              <a
                href="#"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-[8px] bg-[#009DB5] text-white font-semibold text-[14px] hover:bg-[#00B4D0] transition-colors"
              >
                <Plus className="w-4 h-4" /> Add to Server
              </a>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {guilds.map(guild => (
                  <button
                    key={guild.id}
                    onClick={() => handleSelect(guild.id)}
                    className="group p-5 rounded-[10px] bg-[#262932] shadow-[0px_7.8px_17.3px_rgba(0,157,181,0.07)] hover:border-[#009DB5]/40 border-2 border-transparent text-left transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      {guild.icon ? (
                        <img
                          src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`}
                          alt=""
                          className="w-12 h-12 rounded-[10px] object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-[10px] bg-[#009DB5]/10 flex items-center justify-center">
                          <span className="text-lg font-bold text-[#009DB5]">{guild.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white truncate group-hover:text-[#009DB5] transition-colors text-[14px]">
                          {guild.name}
                        </p>
                        {guild.member_count != null ? (
                          <p className="text-[12px] text-[#9FA8C1] mt-0.5 flex items-center gap-1">
                            <Users className="w-3 h-3" /> {guild.member_count.toLocaleString()} members
                          </p>
                        ) : (
                          <p className="text-[12px] text-[#9FA8C1] mt-0.5">Server</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Invite Bot CTA */}
              <div className="mt-8 text-center">
                <a
                  href="#"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[8px] border-2 border-[#009DB5]/30 text-[#009DB5] font-semibold text-[14px] hover:bg-[#009DB5]/10 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Invite Bot to Another Server
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
