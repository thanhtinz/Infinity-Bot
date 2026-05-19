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
    <div className="min-h-screen bg-gradient-to-b from-[#1E1E2D] to-[#262932] text-white relative overflow-hidden animate-fade-in">
      {/* Animated gradient orb */}
      <div className="pointer-events-none absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(0,157,181,0.15)_0%,transparent_70%)] animate-pulse" />
      <div className="pointer-events-none absolute bottom-[-150px] right-[-100px] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(108,92,231,0.1)_0%,transparent_70%)] animate-pulse [animation-delay:2s]" />

      <LandingNavbar />
      <div className="pt-[120px] pb-20 px-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-14">
            <div className="w-14 h-14 rounded-2xl bg-[#009DB5]/10 border border-[#009DB5]/20 flex items-center justify-center mx-auto mb-5">
              <Server className="w-7 h-7 text-[#009DB5]" />
            </div>
            <h1 className="text-[36px] font-bold tracking-tight bg-gradient-to-r from-white via-[#009DB5] to-white bg-clip-text text-transparent">
              Chọn máy chủ của bạn
            </h1>
            <p className="mt-3 text-[15px] text-[#9FA8C1]/80">Chọn máy chủ để bắt đầu quản lý bot</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#009DB5]" />
            </div>
          ) : guilds.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-20 h-20 rounded-2xl bg-[#009DB5]/10 border border-[#009DB5]/20 flex items-center justify-center mx-auto mb-5">
                <Server className="w-10 h-10 text-[#009DB5]" />
              </div>
              <h2 className="text-2xl font-bold mb-2">No Servers Found</h2>
              <p className="text-[#9FA8C1] text-[15px] mb-8">Add the bot to a server to get started.</p>
              <a
                href="#"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-[#009DB5] to-[#00B4D0] text-white font-semibold text-[14px] hover:shadow-[0_0_24px_rgba(0,157,181,0.3)] transition-all duration-300"
              >
                <Plus className="w-4 h-4" /> Add to Server
              </a>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {guilds.map(guild => (
                  <button
                    key={guild.id}
                    onClick={() => handleSelect(guild.id)}
                    className="group p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:scale-[1.02] hover:border-[#009DB5]/50 hover:shadow-[0_0_20px_rgba(0,157,181,0.15)] text-left transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      {guild.icon ? (
                        <img
                          src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`}
                          alt=""
                          className="w-14 h-14 rounded-xl object-cover ring-2 ring-white/10 group-hover:ring-[#009DB5]/30 transition-all duration-300"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-[#009DB5]/10 flex items-center justify-center ring-2 ring-white/10 group-hover:ring-[#009DB5]/30 transition-all duration-300">
                          <span className="text-xl font-bold text-[#009DB5]">{guild.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white truncate group-hover:text-[#009DB5] transition-colors text-[15px]">
                          {guild.name}
                        </p>
                        {guild.member_count != null ? (
                          <p className="text-[13px] text-[#9FA8C1] mt-1 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" /> {guild.member_count.toLocaleString()} members
                          </p>
                        ) : (
                          <p className="text-[13px] text-[#9FA8C1] mt-1">Server</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Invite Bot CTA */}
              <div className="mt-10 text-center">
                <a
                  href="#"
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-full border-2 border-transparent bg-clip-padding relative font-semibold text-[14px] text-[#009DB5] hover:text-white transition-colors duration-300"
                  style={{
                    backgroundImage: "linear-gradient(to right, #1E1E2D, #1E1E2D), linear-gradient(135deg, #009DB5, #6C5CE7)",
                    backgroundOrigin: "border-box",
                    backgroundClip: "padding-box, border-box",
                  }}
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
