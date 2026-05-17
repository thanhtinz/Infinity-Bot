import { useEffect, useMemo, useState } from "react";
import { Bot, Gift, Hash, Heart, Info, Mic, Package, Pin, Search, Shield, Smile, Tags, TerminalSquare, Ticket, Trophy, Wrench, Zap } from "lucide-react";
import { LandingNavbar, useLandingFonts } from "@/components/LandingNavbar";

interface Command { name: string; description: string; usage?: string; admin?: boolean; }
interface Category { key?: string; name: string; count?: number; commands: Command[]; }

type FilterKey = "all" | string;

const categoryIcons = {
  interaction: Heart,
  expression: Smile,
  fun: Zap,
  shop: Package,
  info: Info,
  level: Trophy,
  giveaway: Gift,
  ticket: Ticket,
  misc: Wrench,
  sticky: Pin,
  moderator: Shield,
  modtools: Hash,
  role: Tags,
  tempvoice: Mic,
  other: Bot,
} as const;

function getCategoryIcon(key?: string) {
  return categoryIcons[key as keyof typeof categoryIcons] || TerminalSquare;
}

function getCommandIcon(catKey?: string, admin?: boolean) {
  if (admin) return Shield;
  return getCategoryIcon(catKey);
}

export function PublicCommandsPage() {
  useLandingFonts();
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  useEffect(() => {
    fetch("/api/public/commands").then(r => r.json()).then(d => setCats(d.categories || []));
    document.title = "Bot Commands — Infinity Bot";
  }, []);

  const allCommands = useMemo(() => cats.flatMap(cat => cat.commands.map(cmd => ({ ...cmd, category: cat }))), [cats]);
  const totalCommands = allCommands.length;

  const tabs = useMemo(() => [
    { key: "all", label: "All", count: totalCommands },
    ...cats.map(cat => ({ key: cat.key || cat.name, label: cat.name, count: cat.commands.length })),
  ], [cats, totalCommands]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return cats.map(cat => ({
      ...cat,
      commands: cat.commands.filter(cmd => {
        const matchesTab =
          activeFilter === "all" ||
          activeFilter === cat.key ||
          activeFilter === cat.name;
        const haystack = `${cmd.name} ${cmd.description} ${cmd.usage || ""} ${cat.name}`.toLowerCase();
        return matchesTab && (!query || haystack.includes(query));
      }),
    })).filter(cat => cat.commands.length > 0);
  }, [activeFilter, cats, q]);

  const visibleCount = filtered.reduce((sum, cat) => sum + cat.commands.length, 0);

  return (
    <div style={{ background: "#0d0f14", minHeight: "100vh", fontFamily: "'Syne', sans-serif" }}>
      <LandingNavbar />
      <div className="relative max-w-6xl mx-auto px-4 pt-28 pb-16">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[640px] h-[360px] rounded-full blur-3xl pointer-events-none bg-[#5865F2]/10" />

        <div className="relative text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#5865F2]/25 bg-[#5865F2]/10 text-[#aeb6ff] text-xs font-bold tracking-[0.16em] uppercase mb-5">
            <Zap className="w-3.5 h-3.5" /> Slash command index
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-3 tracking-tight">Command List</h1>
          <p className="text-white/40 max-w-xl mx-auto">Full Infinity Bot command catalog with search, admin tags, usages and category filters.</p>
        </div>

        <div className="relative rounded-3xl border border-white/10 bg-[#10131a]/80 shadow-2xl shadow-black/30 overflow-hidden mb-7">
          <div className="p-4 md:p-5 border-b border-white/10 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search commands, usage, category..."
                className="w-full h-12 pl-11 pr-4 rounded-2xl border border-white/10 bg-white/[0.04] text-white text-sm placeholder:text-white/30 outline-none focus:border-[#5865F2]/60 focus:bg-white/[0.06] transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-white/45">
              <TerminalSquare className="w-4 h-4 text-[#aeb6ff]" />
              <span>{visibleCount}/{totalCommands} commands</span>
            </div>
          </div>

          <div className="px-4 md:px-5 py-4 overflow-x-auto border-b border-white/10">
            <div className="flex gap-2 min-w-max">
              {tabs.map(tab => {
                const active = activeFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFilter(tab.key)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-all ${
                      active
                        ? "border-[#5865F2]/50 bg-[#5865F2]/20 text-white shadow-lg shadow-[#5865F2]/10"
                        : "border-white/10 bg-white/[0.025] text-white/45 hover:text-white hover:bg-white/[0.06]"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-black/25 text-white/45">{tab.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="relative space-y-8">
          {filtered.map(cat => {
            const CategoryIcon = getCategoryIcon(cat.key);
            return (
            <section key={cat.key || cat.name} className="rounded-3xl border border-white/10 bg-white/[0.025] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                    <CategoryIcon className="w-5 h-5 text-[#aeb6ff]" />
                    <span>{cat.name}</span>
                  </h2>
                  <p className="text-xs text-white/35 mt-1">{cat.commands.length} visible commands</p>
                </div>
                <span className="hidden sm:inline-flex text-xs text-white/35 border border-white/10 rounded-full px-3 py-1 bg-black/20">
                  {cat.key || "category"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 md:p-5">
                {cat.commands.map(cmd => {
                  const CommandIcon = getCommandIcon(cat.key, cmd.admin);
                  return (
                  <article key={`${cat.key}-${cmd.name}`} className="group rounded-2xl border border-white/8 bg-[#0b0e14]/80 p-4 hover:bg-[#121722] hover:border-[#5865F2]/25 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#5865F2]/15 border border-[#5865F2]/20 flex items-center justify-center shrink-0">
                        <CommandIcon className="w-5 h-5 text-[#aeb6ff]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <code style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-[#aeb6ff] text-sm font-bold break-all">
                            {cmd.name}
                          </code>
                          {cmd.admin && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] text-[10px] font-bold uppercase tracking-[0.12em]">
                              <Shield className="w-3 h-3" /> admin
                            </span>
                          )}
                        </div>
                        <p className="text-white/55 text-sm leading-relaxed">{cmd.description}</p>
                        {cmd.usage && (
                          <p style={{ fontFamily: "'JetBrains Mono', monospace" }} className="mt-3 text-xs text-white/30 truncate">
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
            <div className="text-center py-16 rounded-3xl border border-white/10 bg-white/[0.025]">
              <p className="text-white/35">No commands found for “{q}”.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
