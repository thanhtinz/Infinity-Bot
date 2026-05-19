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
import { Crown, Server, Globe, Palette, Clock, Copy, Check } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { apiFetch } from "@/hooks/useApi";

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
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* User card */}
      <Card className="card-yuri overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[#009DB5] to-[#F94C8E]" />
        <CardContent className="relative pt-0 pb-6 px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-10">
            <Avatar className="h-20 w-20 border-4 border-card shadow-lg">
              <AvatarImage src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`} />
              <AvatarFallback className="text-2xl">{user.username?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pb-1">
              <h2 className="text-xl font-bold truncate">{user.username}</h2>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={copyId}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="font-mono">{user.id}</span>
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </button>
                {user.is_owner && <Badge variant="secondary" className="text-[10px]">Owner</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guilds */}
      <Card className="card-yuri">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="w-4 h-4 text-primary" />
            Servers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {guilds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No servers found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {guilds.map(g => (
                <button
                  key={g.id}
                  onClick={() => { setSelectedGuildId(g.id); navigate("/bot-settings"); }}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                >
                  <Avatar className="h-9 w-9">
                    {g.icon ? (
                      <AvatarImage src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`} />
                    ) : null}
                    <AvatarFallback className="text-xs">{g.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{g.name}</p>
                    {g.member_count && <p className="text-xs text-muted-foreground">{g.member_count} members</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan */}
      <Card className="card-yuri">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="w-4 h-4 text-yellow-500" />
            Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">{plan?.name || "Free"}</p>
              {plan?.features && plan.features.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {plan.features.slice(0, 5).map(f => (
                    <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                  ))}
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/my-plan">View Details</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="card-yuri">
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Dashboard Language */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <Label className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                Dashboard Language
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Only affects dashboard UI, not bot commands</p>
            </div>
            <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "vi")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vi">Tiếng Việt</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Theme */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <Label className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                Theme
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Choose your preferred appearance</p>
            </div>
            <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Timezone */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Timezone
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Used for displaying timestamps</p>
            </div>
            <Select value={timezone} onValueChange={handleTimezone}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
