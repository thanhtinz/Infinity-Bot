import { useGuild } from "@/contexts/GuildContext";
import { Server, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function GuildSelector() {
  const { selectedGuildId, guilds, isLoading } = useGuild();
  const navigate = useNavigate();
  const selectedGuild = guilds.find(g => g.id === selectedGuildId);

  if (isLoading) {
    return (
      <div className="px-3 py-3 border-b">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Server className="w-3.5 h-3.5 animate-pulse" />
          Đang tải server...
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 border-b">
      <button
        onClick={() => navigate("/select-guild")}
        className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg transition-colors text-left hover:bg-accent"
      >
        {selectedGuild ? (
          <>
            {selectedGuild.icon ? (
              <img
                src={selectedGuild.icon}
                alt=""
                className="w-7 h-7 rounded-md shrink-0 object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-muted-foreground">
                  {selectedGuild.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="flex-1 text-sm font-medium truncate">{selectedGuild.name}</span>
          </>
        ) : (
          <>
            <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Server className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <span className="flex-1 text-sm text-muted-foreground truncate">Chọn server</span>
          </>
        )}
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
      </button>
    </div>
  );
}
