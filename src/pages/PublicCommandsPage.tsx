import { useEffect, useMemo, useState } from "react";
import {
  Bot, Gift, Heart, Info, MoreHorizontal, Pin,
  Search, Settings2, Shield, ShoppingBag, Smile, Terminal,
  UserPlus, UserCog, Wrench, Zap, SearchX,
  UserCheck, ClipboardList, Bell, BarChart3, Rss, Activity, BrainCircuit,
} from "lucide-react";
import { LandingNavbar } from "@/components/LandingNavbar";

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
    <div className="min-h-screen bg-[#1E1E2D] animate-fade-in">
      <LandingNavbar />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative pt-28 pb-8 px-4 overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(0,157,181,0.12) 0%, transparent 70%)", filter: "blur(60px)" }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#009DB5]/20 bg-[#009DB5]/5 text-[#009DB5] text-[12px] font-semibold mb-5">
            <Terminal className="w-3.5 h-3.5" /> Bot Commands
          </div>
          <h1 className="text-[36px] md:text-[44px] font-bold text-white tracking-tight mb-3">
            Commands
          </h1>
          <p className="text-[14px] text-[#9FA8C1] mb-8">
            <span className="text-[#009DB5] font-semibold">{totalCommands}</span> commands across{" "}
            <span className="text-[#009DB5] font-semibold">{cats.length}</span> categories
          </p>

          {/* Search bar */}
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9FA8C1] pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search commands..."
              className="w-full pl-11 pr-4 py-3 rounded-[10px] bg-[#262932] text-white placeholder:text-[#9FA8C1]/50 focus:outline-none focus:ring-2 focus:ring-[#009DB5]/40 transition-all text-[14px] shadow-[0px_7.8px_17.3px_rgba(0,157,181,0.07)]"
            />
          </div>
        </div>
      </section>

      {/* ── Category filter pills ─────────────────────────── */}
      <div className="px-4 pb-4">
        <div className="max-w-7xl mx-auto flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setActiveFilter("all")}
            className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all ${
              activeFilter === "all"
                ? "bg-[#009DB5]/15 border border-[#009DB5]/30 text-[#009DB5]"
                : "bg-[#262932] border border-transparent text-[#9FA8C1] hover:text-white hover:bg-[#262932]/80"
            }`}
          >
            All
            <span className="text-[11px] opacity-60">{totalCommands}</span>
          </button>
          {cats.map(cat => {
            const Icon = getCategoryIcon(cat.key);
            const active = activeFilter === (cat.key || cat.name);
            return (
              <button
                key={cat.key || cat.name}
                onClick={() => setActiveFilter(cat.key || cat.name)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all ${
                  active
                    ? "bg-[#009DB5]/15 border border-[#009DB5]/30 text-[#009DB5]"
                    : "bg-[#262932] border border-transparent text-[#9FA8C1] hover:text-white hover:bg-[#262932]/80"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.name}
                <span className="text-[11px] opacity-60">{cat.commands.length}</span>
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-semibold transition-all ${
                activeFilter === "all"
                  ? "bg-[#009DB5]/10 border border-[#009DB5]/20 text-[#009DB5]"
                  : "border border-transparent text-[#9FA8C1] hover:bg-[#262932] hover:text-white"
              }`}
            >
              <Zap className="w-4 h-4" />
              <span className="flex-1 text-left">All</span>
              <span className="text-[11px] opacity-50">{totalCommands}</span>
            </button>

            <div className="h-px bg-white/5 my-2" />

            {cats.map(cat => {
              const Icon = getCategoryIcon(cat.key);
              const active = activeFilter === (cat.key || cat.name);
              return (
                <button
                  key={cat.key || cat.name}
                  onClick={() => setActiveFilter(cat.key || cat.name)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-semibold transition-all ${
                    active
                      ? "bg-[#009DB5]/10 border border-[#009DB5]/20 text-[#009DB5]"
                      : "border border-transparent text-[#9FA8C1] hover:bg-[#262932] hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left truncate">{cat.name}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${
                    active ? "bg-[#009DB5]/15 text-[#009DB5]" : "bg-[#262932] text-[#9FA8C1]/50"
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
            <p className="text-[#9FA8C1] text-[13px] mb-4">
              {filteredTotal} result{filteredTotal !== 1 ? "s" : ""}
              {q && <> for &ldquo;<span className="text-white/70">{q}</span>&rdquo;</>}
            </p>
          )}

          {filtered.map(cat => {
            const CatIcon = getCategoryIcon(cat.key);
            return (
              <section key={cat.key || cat.name} className="mb-8">
                {/* Category group header */}
                {activeFilter === "all" && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-[8px] bg-[#009DB5]/10 flex items-center justify-center">
                      <CatIcon className="w-4 h-4 text-[#009DB5]" />
                    </div>
                    <h2 className="text-white font-semibold text-[15px]">{cat.name}</h2>
                    <span className="text-[#9FA8C1]/50 text-[12px]">{cat.commands.length} command{cat.commands.length !== 1 ? "s" : ""}</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cat.commands.map(cmd => (
                    <article
                      key={`${cat.key}-${cmd.name}`}
                      className="group rounded-[10px] bg-[#262932] p-4 hover:ring-1 hover:ring-[#009DB5]/30 transition-all shadow-[0px_7.8px_17.3px_rgba(0,157,181,0.07)]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-[8px] bg-[#009DB5]/10 flex items-center justify-center shrink-0">
                          <CatIcon className="w-4 h-4 text-[#009DB5]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <code
                              style={{ fontFamily: "'JetBrains Mono', monospace" }}
                              className="text-[#009DB5] text-[14px] font-bold break-all"
                            >
                              /{cmd.name}
                            </code>
                            {cmd.admin && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F94C8E]/10 text-[#F94C8E] text-[10px] font-bold uppercase tracking-wider">
                                <Shield className="w-3 h-3" /> Admin
                              </span>
                            )}
                          </div>
                          <p className="text-[#9FA8C1] text-[13px] leading-relaxed">
                            {cmd.description}
                          </p>
                          {cmd.usage && (
                            <p
                              style={{ fontFamily: "'JetBrains Mono', monospace" }}
                              className="mt-2 text-[12px] text-[#9FA8C1]/40 truncate"
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
            <div className="text-center py-20 rounded-[10px] bg-[#262932] shadow-[0px_7.8px_17.3px_rgba(0,157,181,0.07)]">
              <SearchX className="w-12 h-12 mx-auto mb-4 text-[#9FA8C1]/30" />
              <p className="text-white/50 font-semibold mb-1">No commands found</p>
              <p className="text-[#9FA8C1] text-[13px]">
                {q ? `Try a different search term than "${q}"` : "Try selecting a different category"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
