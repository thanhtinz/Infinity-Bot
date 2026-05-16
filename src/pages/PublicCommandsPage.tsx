import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Zap, } from "lucide-react";
import { LandingNavbar, useLandingFonts } from "@/components/LandingNavbar";

interface Command { name: string; description: string; }
interface Category { name: string; commands: Command[]; }

export function PublicCommandsPage() {
  useLandingFonts();
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/public/commands").then(r => r.json()).then(d => setCats(d.categories || []));
    document.title = "Bot Commands — Infinity Bot";
  }, []);

  const filtered = cats.map(c => ({
    ...c,
    commands: c.commands.filter(cmd =>
      cmd.name.toLowerCase().includes(q.toLowerCase()) ||
      cmd.description.toLowerCase().includes(q.toLowerCase())
    ),
  })).filter(c => c.commands.length > 0);

  return (
    <div style={{ background: "#0d0f14", minHeight: "100vh", fontFamily: "'Syne', sans-serif" }}>
      <LandingNavbar />
      <div className="max-w-4xl mx-auto px-4 pt-28 pb-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/30 mb-4 mx-auto">
            <Zap className="w-5 h-5 text-[#5865F2]" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-3">Command List</h1>
          <p className="text-white/40">All slash commands for Infinity Bot</p>
        </div>

        {/* Search */}
        <div className="relative mb-8 max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search commands..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#5865F2]/50"
          />
        </div>

        <div className="space-y-8">
          {filtered.map((cat, i) => (
            <div key={i}>
              <h2 className="text-lg font-bold text-white mb-3">{cat.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cat.commands.map((cmd, j) => (
                  <div key={j} className="flex gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                    <code style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      className="text-[#5865F2] text-sm font-medium shrink-0">{cmd.name}</code>
                    <span className="text-white/50 text-sm">{cmd.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && q && (
            <p className="text-center text-white/30 py-12">No commands found for "{q}"</p>
          )}
        </div>
      </div>
    </div>
  );
}
