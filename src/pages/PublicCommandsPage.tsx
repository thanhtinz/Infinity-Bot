import { useEffect, useMemo, useState } from "react";
import {
  Bot, Gift, Heart, Info, MoreHorizontal, Pin,
  Search, Settings2, Shield, ShoppingBag, Smile, Terminal,
  UserPlus, UserCog, Wrench, Zap, SearchX,
  UserCheck, ClipboardList, Bell, BarChart3, Rss, Activity, BrainCircuit,
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
  invites: UserPlus,
  utility: Terminal,
  autorole: UserCheck,
  forms: ClipboardList,
  reminders: Bell,
  polls: BarChart3,
  social_feeds: Rss,
  stats_channels: Activity,
  ai_chat: BrainCircuit,
  other: Bot,
};

function getCategoryIcon(key?: string) {
  if (!key) return Bot;
  return categoryIcons[key] || Bot;
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

  const filteredTotal = useMemo(
    () => filtered.reduce((sum, cat) => sum + cat.commands.length, 0),
    [filtered],
  );

  return (
    <div style={{ background: "#1E1E2D", fontFamily: "'Syne', sans-serif", minHeight: "100vh" }}>
      <LandingNavbar />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative pt-28 pb-8 px-4 overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(0,157,181,0.15) 0%, transparent 70%)", filter: "blur(60px)" }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight mb-4">
            Commands
          </h1>
          <p className="text-white/40 text-lg mb-8">
            <span className="text-primary font-semibold">{totalCommands}</span> commands across{" "}
            <span className="text-primary font-semibold">{cats.length}</span> categories
          </p>

          {/* Search bar */}
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search commands..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/30 transition-all text-sm backdrop-blur-sm"
            />
          </div>
        </div>
      </section>

      {/* ── Mobile category pills ─────────────────────────── */}
      <div className="lg:hidden px-4 pb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setActiveFilter("all")}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition-all ${
              activeFilter === "all"
                ? "bg-primary/15 border-primary/30 text-primary"
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70"
            }`}
          >
            All
            <span className="text-xs opacity-60">{totalCommands}</span>
          </button>
          {cats.map(cat => {
            const Icon = getCategoryIcon(cat.key);
            const active = activeFilter === cat.key;
            return (
              <button
                key={cat.key || cat.name}
                onClick={() => setActiveFilter(cat.key || cat.name)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition-all ${
                  active
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.name}
                <span className="text-xs opacity-60">{cat.commands.length}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main layout: sidebar + grid ───────────────────── */}
      <div className="max-w-7xl mx-auto px-4 pb-16 flex gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-20 space-y-1">
            <button
              onClick={() => setActiveFilter("all")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeFilter === "all"
                  ? "bg-primary/10 border border-primary/20 text-primary"
                  : "border border-transparent text-white/50 hover:bg-white/5 hover:text-white/70"
              }`}
            >
              <Zap className="w-4 h-4" />
              <span className="flex-1 text-left">All</span>
              <span className="text-xs opacity-50">{totalCommands}</span>
            </button>

            <div className="h-px bg-white/5 my-2" />

            {cats.map(cat => {
              const Icon = getCategoryIcon(cat.key);
              const active = activeFilter === (cat.key || cat.name);
              return (
                <button
                  key={cat.key || cat.name}
                  onClick={() => setActiveFilter(cat.key || cat.name)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-primary/10 border border-primary/20 text-primary"
                      : "border border-transparent text-white/50 hover:bg-white/5 hover:text-white/70"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left truncate">{cat.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                    active ? "bg-primary/15 text-primary" : "bg-white/5 text-white/30"
                  }`}>
                    {cat.commands.length}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Command grid area */}
        <div className="flex-1 min-w-0">
          {/* Results count */}
          {(q || activeFilter !== "all") && (
            <p className="text-white/30 text-sm mb-4">
              {filteredTotal} result{filteredTotal !== 1 ? "s" : ""}
              {q && <> for &ldquo;<span className="text-white/50">{q}</span>&rdquo;</>}
            </p>
          )}

          {filtered.map(cat => {
            const CatIcon = getCategoryIcon(cat.key);
            return (
              <section key={cat.key || cat.name} className="mb-8">
                {/* Category group header (visible when "All" is selected) */}
                {activeFilter === "all" && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center">
                      <CatIcon className="w-4 h-4 text-primary" />
                    </div>
                    <h2 className="text-white font-bold text-base">{cat.name}</h2>
                    <span className="text-white/25 text-xs">{cat.commands.length} command{cat.commands.length !== 1 ? "s" : ""}</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cat.commands.map(cmd => (
                    <article
                      key={`${cat.key}-${cmd.name}`}
                      className="group rounded-xl border border-white/[0.06] bg-card p-4 hover:border-primary/30 hover:bg-white/[0.04] transition-all shadow-[0px_8px_17px_rgba(0,157,181,0.07)]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                          <CatIcon className="w-4 h-4 text-primary" />
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
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-bold uppercase tracking-wider">
                                <Shield className="w-3 h-3" /> Admin
                              </span>
                            )}
                          </div>
                          <p className="text-white/45 text-sm leading-relaxed">
                            {cmd.description}
                          </p>
                          {cmd.usage && (
                            <p
                              style={{ fontFamily: "'JetBrains Mono', monospace" }}
                              className="mt-2 text-xs text-white/20 truncate"
                            >
                              {cmd.usage.replaceAll("`", "")}
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}

          {/* No results */}
          {filtered.length === 0 && (
            <div className="text-center py-20 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <SearchX className="w-12 h-12 mx-auto mb-4 text-white/15" />
              <p className="text-white/40 font-medium mb-1">No commands found</p>
              <p className="text-white/20 text-sm">
                {q ? `Try a different search term than "${q}"` : "Try selecting a different category"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
