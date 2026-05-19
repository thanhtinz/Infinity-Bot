import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGuild } from "@/contexts/GuildContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useT, useLanguage } from "@/i18n";
import { Crown, Server, Globe, Palette, Clock, Copy, Check, User, Settings, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { apiFetch } from "@/hooks/useApi";
import { PageContainer, PageHeader } from "@/components/yuri";

const TIMEZONES = [
  "Asia/Ho_Chi_Minh", "Asia/Bangkok", "Asia/Tokyo", "Asia/Shanghai",
  "Asia/Singapore", "Asia/Seoul", "Asia/Kolkata",
  "Europe/London", "Europe/Paris", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Australia/Sydney", "Pacific/Auckland", "UTC",
];

export function ProfilePage() {
  const { t } = useT();
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { setSelectedGuildId } = useGuild();
  const [timezone, setTimezone] = useState(() => localStorage.getItem("tz") || "Asia/Ho_Chi_Minh");
  const [copied, setCopied] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["auth_me"],
    queryFn: () => fetch("/api/auth/me", { credentials: "include" }).then(r => r.ok ? r.json() : null),
    retry: false,
  });

  const { data: guilds = [] } = useQuery<{ id: string; name: string; icon: string | null; member_count?: number }[]>({
    queryKey: ["guilds"],
    queryFn: () => apiFetch("/api/guilds").then(r => r.ok ? r.json() : []),
    retry: false,
  });

  const { data: plan } = useQuery<{ name: string; features: string[] }>({
    queryKey: ["my_plan"],
    queryFn: () => apiFetch("/api/premium/my-plan").then(r => r.ok ? r.json() : { name: "Free", features: [] }),
    retry: false,
  });

  const handleTimezone = (tz: string) => {
    setTimezone(tz);
    localStorage.setItem("tz", tz);
  };

  const copyId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!user) return null;

  return (
    <PageContainer size="md">
      <PageHeader title="Profile" icon={User} description="Manage your account and preferences" />

      {/* User card */}
      <Card className="overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-primary to-[#F94C8E] relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-40" />
        </div>
        <CardContent className="relative pb-6 px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-12">
            <Avatar className="h-24 w-24 border-4 border-card shadow-lg ring-2 ring-primary/20">
              <AvatarImage src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`} />
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {user.username?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pb-1">
              <h2 className="text-xl font-bold truncate">{user.username}</h2>
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  onClick={copyId}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono bg-muted/50 px-2 py-1 rounded-md"
                >
                  {user.id}
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </button>
                {user.is_owner && (
                  <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-[10px]">
                    <Crown className="w-3 h-3 mr-1" /> Owner
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan summary */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="font-semibold">{plan?.name || "Free"}</p>
                <p className="text-xs text-muted-foreground">Current plan</p>
              </div>
            </div>
            {plan?.features && plan.features.length > 0 && (
              <div className="hidden sm:flex flex-wrap gap-1.5">
                {plan.features.slice(0, 3).map(f => (
                  <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/my-plan" className="flex items-center gap-1">
                Details <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Servers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="w-4 h-4 text-primary" />
            Servers
            <Badge variant="secondary" className="ml-auto text-[10px]">{guilds.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {guilds.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No servers found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {guilds.map(g => (
                <button
                  key={g.id}
                  onClick={() => { setSelectedGuildId(g.id); navigate("/bot-settings"); }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                >
                  <Avatar className="h-9 w-9">
                    {g.icon && <AvatarImage src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`} />}
                    <AvatarFallback className="text-xs bg-muted">{g.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{g.name}</p>
                    {g.member_count && <p className="text-xs text-muted-foreground">{g.member_count.toLocaleString()} members</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="w-4 h-4 text-primary" />
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <Label className="flex items-center gap-2 font-medium">
                <Globe className="w-4 h-4 text-primary" />
                Dashboard Language
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Only affects dashboard UI, not bot commands</p>
            </div>
            <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "vi")}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vi">Tiếng Việt</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="h-px bg-border" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <Label className="flex items-center gap-2 font-medium">
                <Palette className="w-4 h-4 text-primary" />
                Theme
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Choose your preferred appearance</p>
            </div>
            <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="h-px bg-border" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <Label className="flex items-center gap-2 font-medium">
                <Clock className="w-4 h-4 text-primary" />
                Timezone
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Used for displaying timestamps</p>
            </div>
            <Select value={timezone} onValueChange={handleTimezone}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
