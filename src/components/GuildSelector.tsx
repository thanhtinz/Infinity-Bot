import { useGuild } from "@/contexts/GuildContext";
import { useQueryClient } from "@tanstack/react-query";
import { Server, ChevronDown, Check, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "@/i18n";

export function GuildSelector() {
  const { selectedGuildId, setSelectedGuildId, guilds, isLoading } = useGuild();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedGuild = guilds.find(g => g.id === selectedGuildId);

  const handleSelect = (guildId: string) => {
    if (guildId === selectedGuildId) { setOpen(false); return; }
    setSelectedGuildId(guildId);
    queryClient.clear();
    setOpen(false);
    navigate("/bot-settings");
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (isLoading) {
    return (
      <div className="px-3 py-3">
        <div className="flex items-center gap-2 text-xs text-[#9FA8C1]/60">
          <Server className="w-3.5 h-3.5 animate-pulse" />
          {t("loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg transition-colors text-left",
          open ? "bg-white/[0.08]" : "hover:bg-white/[0.06]"
        )}
      >
        {selectedGuild?.icon ? (
          <img src={selectedGuild.icon} alt="" className="w-7 h-7 rounded-md shrink-0 object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center shrink-0">
            {selectedGuild
              ? <span className="text-xs font-bold text-[#9FA8C1]">{selectedGuild.name.charAt(0).toUpperCase()}</span>
              : <Server className="w-3.5 h-3.5 text-[#9FA8C1]" />
            }
          </div>
        )}
        <span className="flex-1 text-sm font-medium truncate text-white/90">
          {selectedGuild?.name ?? t("selectGuild_title")}
        </span>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 shrink-0 text-[#9FA8C1] transition-transform duration-200",
          open && "rotate-180"
        )} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-white/10 bg-[#262932] shadow-lg overflow-hidden">
          {guilds.length === 0 ? (
            <p className="text-xs text-[#9FA8C1] text-center py-3">{t("selectGuild_noGuilds")}</p>
          ) : (
            <>
            <div className="max-h-64 overflow-y-auto py-1">
              {guilds.map(guild => {
                const isSelected = guild.id === selectedGuildId;
                return (
                  <button
                    key={guild.id}
                    onClick={() => handleSelect(guild.id)}
                    className={cn(
                      "flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors text-left",
                      isSelected
                        ? "bg-[#009DB5]/15 text-[#009DB5]"
                        : "hover:bg-white/[0.06] text-white/80"
                    )}
                  >
                    {guild.icon ? (
                      <img src={guild.icon} alt="" className="w-7 h-7 rounded-md shrink-0 object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-[#9FA8C1]">{guild.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <span className="flex-1 truncate font-medium">{guild.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[#009DB5]" />}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-white/10">
              <button
                onClick={() => { setOpen(false); navigate("/select-guild"); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#9FA8C1] hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                {t("selectGuild_manage")}
              </button>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
