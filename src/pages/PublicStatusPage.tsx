import { useEffect, useState } from "react";
import { Zap, Server, Users, Activity, Wifi, WifiOff } from "lucide-react";
import { LandingNavbar, useLandingFonts } from "@/components/LandingNavbar";

interface ShardInfo { id: number; latency_ms: number | null; guild_count: number; }
interface BotStatus {
  online: boolean;
  username: string | null;
  avatar_url: string | null;
  guild_count: number | null;
  member_count: number | null;
  latency_ms: number | null;
  shard_count: number | null;
  shards: ShardInfo[];
}

export function PublicStatusPage() {
  useLandingFonts();
  const [status, setStatus] = useState<BotStatus | null>(null);

  useEffect(() => {
    document.title = "Trạng thái — Infinity Bot";
    const load = () =>
      fetch("/api/public/status").then(r => r.json()).then(setStatus).catch(() => {});
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const online = status?.online;

  return (
    <div style={{ background: "#0d0f14", minHeight: "100vh", fontFamily: "'Syne', sans-serif" }}>
      <LandingNavbar />

      <div className="max-w-3xl mx-auto px-4 pt-28 pb-16">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-white mb-2">Trạng thái Bot</h1>
          <p className="text-white/40 text-sm">Cập nhật mỗi 15 giây</p>
        </div>

        {/* Status banner */}
        <div className={`flex items-center gap-3 p-4 rounded-2xl border mb-6 ${online ? "border-[#00d4aa]/20 bg-[#00d4aa]/5" : "border-red-500/20 bg-red-500/5"}`}>
          {online
            ? <Wifi className="w-5 h-5 text-[#00d4aa]" />
            : <WifiOff className="w-5 h-5 text-red-400" />}
          <div className="flex-1">
            <p className={`font-bold ${online ? "text-[#00d4aa]" : "text-red-400"}`}>
              {status === null ? "Đang kiểm tra..." : online ? "Đang hoạt động" : "Ngoại tuyến"}
            </p>
            {status?.username && <p className="text-white/40 text-sm">{status.username}</p>}
          </div>
          {status !== null && (
            <div className={`w-2.5 h-2.5 rounded-full ${online ? "bg-[#00d4aa] animate-pulse" : "bg-red-400"}`} />
          )}
        </div>

        {/* Stats */}
        {online && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { icon: Server, label: "Servers", value: status?.guild_count?.toLocaleString() ?? "—" },
              { icon: Users, label: "Thành viên", value: status?.member_count?.toLocaleString() ?? "—" },
              { icon: Activity, label: "Latency", value: status?.latency_ms != null ? `${status.latency_ms}ms` : "—" },
            ].map((s, i) => (
              <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] text-center">
                <s.icon className="w-4 h-4 text-[#5865F2] mx-auto mb-2" />
                <p className="text-xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Shards table */}
        {online && status?.shards && status.shards.length > 0 && (
          <div className="rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#5865F2]" />
              <span className="text-sm font-semibold text-white">
                Shards ({status.shard_count ?? status.shards.length})
              </span>
            </div>
            <div className="divide-y divide-white/5">
              {status.shards.map(sh => (
                <div key={sh.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-[#5865F2]/20 flex items-center justify-center text-[#818cf8] text-xs font-bold">
                      {sh.id}
                    </span>
                    <span className="text-white/60">Shard #{sh.id}</span>
                  </div>
                  <div className="flex items-center gap-6 text-white/50">
                    <span>{sh.guild_count} servers</span>
                    <span className={sh.latency_ms != null && sh.latency_ms < 100 ? "text-[#00d4aa]" : "text-yellow-400"}>
                      {sh.latency_ms != null ? `${sh.latency_ms}ms` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
