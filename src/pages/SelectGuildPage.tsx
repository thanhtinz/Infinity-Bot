import { useNavigate } from "react-router-dom";
import { useGuild } from "@/contexts/GuildContext";
import { Server, Plus, Loader2, Users } from "lucide-react";
import { PageContainer, PageHeader, EmptyState } from "@/components/infinity";
import { Button } from "@/components/ui/button";

export function SelectGuildPage() {
  const navigate = useNavigate();
  const { setSelectedGuildId, guilds, isLoading } = useGuild();

  const handleSelect = (id: string) => {
    setSelectedGuildId(id);
    navigate("/bot-settings");
  };

  return (
    <PageContainer size="lg">
      <PageHeader
        title="Select a Server"
        description="Choose a server to start managing your bot"
        icon={Server}
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : guilds.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No Servers Found"
          description="Add the bot to a server to get started."
        >
          <Button asChild>
            <a href="#">
              <Plus className="w-4 h-4 mr-2" /> Add to Server
            </a>
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {guilds.map((guild) => (
              <button
                key={guild.id}
                onClick={() => handleSelect(guild.id)}
                className="group bg-card rounded-[10px] shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] border border-transparent hover:border-primary/30 p-5 text-left transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  {guild.icon ? (
                    <img
                      src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover ring-2 ring-border group-hover:ring-primary/30 transition-all"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center ring-2 ring-border group-hover:ring-primary/30 transition-all">
                      <span className="text-lg font-bold text-primary">{guild.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-card-foreground truncate group-hover:text-primary transition-colors text-[14px]">
                      {guild.name}
                    </p>
                    {guild.member_count != null ? (
                      <p className="text-[12px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {guild.member_count.toLocaleString()} members
                      </p>
                    ) : (
                      <p className="text-[12px] text-muted-foreground mt-0.5">Server</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="text-center pt-2">
            <Button variant="outline" asChild>
              <a href="#">
                <Plus className="w-4 h-4 mr-2" /> Invite Bot to Another Server
              </a>
            </Button>
          </div>
        </>
      )}
    </PageContainer>
  );
}
