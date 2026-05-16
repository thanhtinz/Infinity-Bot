import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Zap, ArrowLeft } from "lucide-react";

interface Command { name: string; description: string; }
interface Category { name: string; commands: Command[]; }

export function PublicCommandsPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/public/commands").then(r => r.json()).then(d => setCats(d.categories || []));
    document.title = "Lệnh Bot — Infinity Bot";
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
      {/* Header */}
      <div className="border-b border-white/5 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Infinity Bot
          </Link>
          <Link to="/dashboard" className="text-sm text-[#5865F2] hover:text-[#818cf8] transition-colors font-medium">Dashboard →</Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 w-8 h-8 rounded-lg bg-[#5865F2] justify-center mx-auto mb-4">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-3">Danh sách lệnh</h1>
          <p className="text-white/40">Tất cả slash commands của Infinity Bot</p>
        </div>

        {/* Search */}
        <div className="relative mb-8 max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Tìm kiếm lệnh..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#5865F2]/50"
          />
        </div>

        {/* Categories */}
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
            <p className="text-center text-white/30 py-12">Không tìm thấy lệnh "{q}"</p>
          )}
        </div>
      </div>
    </div>
  );
}
