import { useEffect, useMemo, useState } from "react";
import {
  Bot, Gift, Heart, HelpCircle, Info, Mic2, MoreHorizontal, Pin,
  Search, Settings2, Shield, ShoppingBag, Smile, Terminal, Trophy,
  UserPlus, UserCog, Users, Wrench, Zap,
} from "lucide-react";
import { LandingNavbar, useLandingFonts } from "@/components/LandingNavbar";

interface Command { name: string; description: string; usage?: string; admin?: boolean; }
interface Category { key?: string; name: string; count?: number; commands: Command[]; }

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  interaction: Heart,
  expression: Smile,
  fun: Zap,
  shop: ShoppingBag,
  info: Info,
  giveaway: Gift,
  misc: MoreHorizontal,
  sticky: Pin,
  moderator: Shield,
  modtools: Wrench,
  channel_admin: Settings2,
  role: UserCog,
  community: Users,
  utility: Terminal,
  invites: UserPlus,
  voice: Mic2,
  level: Trophy,
  other: Bot,
};

function getCategoryIcon(key?: string) {
  if (!key) return HelpCircle;
  return categoryIcons[key] || HelpCircle;
}

export function PublicCommandsPage() {
  useLandingFonts();
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/public/commands")
      .then(r => r.json())
      .then(d => setCats(d.categories || []));
    document.title = "Commands — Infinity Bot";
  }, []);

  const totalCommands = useMemo(
    () => cats.reduce((sum, cat) => sum + cat.commands.length, 0),
    [cats],
  );

  const tabs = useMemo(() => [
    { key: "all", label: "All", count: totalCommands },
    ...cats.map(cat => ({ key: cat.key || cat.name, label: cat.name, count: cat.commands.length })),
  ], [cats, totalCommands]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return cats
      .map(cat => ({
        ...cat,
        commands: cat.commands.filter(cmd => {
          const matchesTab = activeFilter === "all" || activeFilter === cat.key;
          const matchesSearch =
            !query ||
            cmd.name.toLowerCase().includes(query) ||
            cmd.description.toLowerCase().includes(query);
          return matchesTab && matchesSearch;
        }),
      }))
      .filter(cat => cat.commands.length > 0);
  }, [cats, activeFilter, q]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />

      {/* Hero */}
      <section className="pt-28 pb-10 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1
            style={{ fontFamily: "'Syne', sans-serif" }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight"
          >
            Bot Commands
          </h1>
          <p className="mt-3 text-muted-foreground text-lg">
            Explore{" "}
            <span className="text-primary font-semibold">{totalCommands}</span>{" "}
            commands across{" "}
            <span className="text-primary font-semibold">{cats.length}</span>{" "}
            categories
          </p>
        </div>
      </section>

      {/* Search + Filters */}
      <div className="max-w-5xl mx-auto px-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search commands..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow text-sm"
          />
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map(tab => {
            const Icon = tab.key === "all" ? Zap : getCategoryIcon(tab.key);
            const active = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  active
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-card border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                <span className={`ml-0.5 text-xs ${active ? "text-primary/70" : "text-muted-foreground/60"}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Command grid */}
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {filtered.map(cat => {
          const CatIcon = getCategoryIcon(cat.key);
          return (
            <section key={cat.key || cat.name}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CatIcon className="w-4 h-4 text-primary" />
                </div>
                <h2
                  style={{ fontFamily: "'Syne', sans-serif" }}
                  className="text-lg font-bold"
                >
                  {cat.name}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {cat.commands.length} command{cat.commands.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {cat.commands.map(cmd => {
                  const CmdIcon = cmd.admin ? Shield : getCategoryIcon(cat.key);
                  return (
                    <article
                      key={`${cat.key}-${cmd.name}`}
                      className="group rounded-xl border border-border bg-card p-4 hover:border-primary/25 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                          <CmdIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <code
                              style={{ fontFamily: "'JetBrains Mono', monospace" }}
                              className="text-primary text-sm font-bold break-all"
                            >
                              {cmd.name}
                            </code>
                            {cmd.admin && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-bold uppercase tracking-wider">
                                <Shield className="w-3 h-3" /> Admin
                              </span>
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm leading-relaxed">
                            {cmd.description}
                          </p>
                          {cmd.usage && (
                            <p
                              style={{ fontFamily: "'JetBrains Mono', monospace" }}
                              className="mt-2 text-xs text-muted-foreground/50 truncate"
                            >
                              {cmd.usage.replaceAll("`", "")}
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 rounded-2xl border border-border bg-card">
            <HelpCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground">
              No commands found{q ? ` for "${q}"` : ""}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
