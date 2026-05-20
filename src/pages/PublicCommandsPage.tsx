import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bot, Gift, Heart, Info, MoreHorizontal, Pin,
  Search, Settings2, Shield, ShoppingBag, Smile, Terminal,
  UserPlus, UserCog, Wrench, Zap, ChevronDown,
  UserCheck, ClipboardList, Bell, BarChart3, Rss, Activity, BrainCircuit,
} from "lucide-react";
import { LandingNavbar } from "@/components/LandingNavbar";

interface Command { name: string; description: string; usage?: string; admin?: boolean; }
interface Category { key?: string; name: string; commands: Command[]; }

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  interaction: Heart, expression: Smile, fun: Zap, shop: ShoppingBag,
  info: Info, giveaway: Gift, misc: MoreHorizontal, sticky: Pin,
  moderator: Shield, modtools: Wrench, channel_admin: Settings2,
  role: UserCog, invites: UserPlus, utility: Terminal, autorole: UserCheck,
  forms: ClipboardList, reminders: Bell, polls: BarChart3,
  social_feeds: Rss, stats_channels: Activity, ai_chat: BrainCircuit,
};

export function PublicCommandsPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/public/commands")
      .then(r => r.json())
      .then(d => {
        const categories = d.categories || [];
        setCats(categories);
        // Open all by default
        setOpenCats(new Set());
      });
    document.title = "Commands — Infinity Bot";
  }, []);

  const totalCommands = useMemo(
    () => cats.reduce((sum, cat) => sum + cat.commands.length, 0),
    [cats],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return cats;
    return cats
      .map(cat => ({
        ...cat,
        commands: cat.commands.filter(cmd =>
          cmd.name.toLowerCase().includes(query) ||
          cmd.description.toLowerCase().includes(query)
        ),
      }))
      .filter(cat => cat.commands.length > 0);
  }, [cats, q]);

  const toggle = (key: string) => {
    setOpenCats(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <LandingNavbar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-5 pt-24 pb-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Commands</h1>
          <p className="text-sm text-gray-400">
            {totalCommands} commands · {cats.length} categories
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search commands..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]/30 border border-gray-100 transition"
          />
        </div>

        {/* Categories accordion */}
        <div className="space-y-2">
          {filtered.map(cat => {
            const key = cat.key || cat.name;
            const Icon = categoryIcons[cat.key || ""] || Bot;
            const isOpen = openCats.has(key);

            return (
              <div key={key} className="rounded-xl border border-gray-100 overflow-hidden">
                {/* Category header */}
                <button
                  onClick={() => toggle(key)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#6C5CE7]/8 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#6C5CE7]" />
                  </div>
                  <span className="flex-1 text-left text-sm font-semibold text-gray-900">{cat.name}</span>
                  <span className="text-xs text-gray-400 mr-1">{cat.commands.length}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Commands list */}
                {isOpen && (
                  <div className="border-t border-gray-50">
                    {cat.commands.map((cmd, i) => (
                      <div
                        key={cmd.name}
                        className={`flex items-start gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-gray-50" : ""}`}
                      >
                        <code className="text-[#6C5CE7] text-[13px] font-semibold shrink-0 pt-0.5">{cmd.name}</code>
                        <p className="text-gray-500 text-[13px] leading-relaxed flex-1">{cmd.description}</p>
                        {cmd.admin && (
                          <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-bold uppercase">
                            <Shield className="w-2.5 h-2.5" /> Admin
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm">No commands found for "{q}"</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        <div className="flex items-center justify-center gap-6 mb-2">
          <Link to="/terms" className="hover:text-[#6C5CE7] transition-colors">Terms</Link>
          <Link to="/privacy" className="hover:text-[#6C5CE7] transition-colors">Privacy</Link>
          <Link to="/refund" className="hover:text-[#6C5CE7] transition-colors">Refund</Link>
        </div>
        <p>© 2025 Infinity Bot. All rights reserved.</p>
      </footer>
    </div>
  );
}
