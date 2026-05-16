import { useEffect, useMemo, useState } from "react";
import { Activity, Clock, Database, Search, Server, Users, Wifi, WifiOff, Zap } from "lucide-react";
import { LandingNavbar, useLandingFonts } from "@/components/LandingNavbar";

interface ShardInfo { id: number; latency_ms: number | null; guild_count: number; }
interface ClusterInfo {
  id: number;
  shards: number[];
  servers: number;
  cached_users: number | null;
  latency_ms: number | null;
  uptime: string | null;
  mem_usage_mb: number | null;
  last_updated_at: string | null;
  last_updated_seconds?: number;
}
interface BotStatus {
  online: boolean;
  username: string | null;
  avatar_url: string | null;
  guild_count: number | null;
  member_count: number | null;
  latency_ms: number | null;
  uptime?: string | null;
  mem_usage_mb?: number | null;
  last_updated_at?: string | null;
  shard_count: number | null;
  cluster_count?: number;
  shards: ShardInfo[];
  clusters?: ClusterInfo[];
}

function secondsAgo(iso?: string | null) {
  if (!iso) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 1) return "just now";
  return `${seconds} second${seconds === 1 ? "" : "s"} ago`;
}

function compactShards(shards: number[]) {
  return shards.length ? shards.join("") : "—";
}

export function PublicStatusPage() {
  useLandingFonts();
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [query, setQuery] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    document.title = "Status — Infinity Bot";
    const load = () =>
      fetch("/api/public/status").then(r => r.json()).then(setStatus).catch(() => {});
    load();
    const refreshId = setInterval(load, 15000);
    const tickId = setInterval(() => setTick(n => n + 1), 1000);
    return () => {
      clearInterval(refreshId);
      clearInterval(tickId);
    };
  }, []);

  const online = status?.online;
  const clusters = useMemo(() => {
    const source = status?.clusters?.length
      ? status.clusters
      : status?.online
        ? [{
            id: 0,
            shards: status.shards.map(s => s.id),
            servers: status.guild_count ?? 0,
            cached_users: status.member_count,
            latency_ms: status.latency_ms,
            uptime: status.uptime ?? null,
            mem_usage_mb: status.mem_usage_mb ?? null,
            last_updated_at: status.last_updated_at ?? null,
          }]
        : [];
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter(c =>
      `cluster ${c.id} shards ${compactShards(c.shards)} ${c.servers} ${c.cached_users ?? ""}`.toLowerCase().includes(q)
    );
  }, [query, status]);

  return (
    <div style={{ background: "#0d0f14", minHeight: "100vh", fontFamily: "'Syne', sans-serif" }}>
      <LandingNavbar />

      <div className="relative max-w-5xl mx-auto px-4 pt-28 pb-16">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[520px] h-[300px] rounded-full blur-3xl pointer-events-none bg-[#5865F2]/10" />

        <div className="relative text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-white/50 text-xs mb-5">
            <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-[#00d4aa] animate-pulse" : "bg-red-400"}`} />
            Live infrastructure monitor
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3 tracking-tight">Bot Status</h1>
          <p className="text-white/40 text-sm">Clusters, shards, memory and latency. Updates every 15 seconds.</p>
        </div>

        <div className={`relative flex items-center gap-3 p-4 rounded-2xl border mb-5 ${online ? "border-[#00d4aa]/20 bg-[#00d4aa]/5" : "border-red-500/20 bg-red-500/5"}`}>
          {online
            ? <Wifi className="w-5 h-5 text-[#00d4aa]" />
            : <WifiOff className="w-5 h-5 text-red-400" />}
          <div className="flex-1">
            <p className={`font-bold ${online ? "text-[#00d4aa]" : "text-red-400"}`}>
              {status === null ? "Checking..." : online ? "Operational" : "Offline"}
            </p>
            {status?.username && <p className="text-white/40 text-sm">{status.username}</p>}
          </div>
          {status !== null && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-white/35">
              <Clock className="w-3.5 h-3.5" />
              Last updated {secondsAgo(status.last_updated_at)}
            </div>
          )}
        </div>

        {online && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { icon: Server, label: "Servers", value: status?.guild_count?.toLocaleString() ?? "—" },
              { icon: Users, label: "Cached users", value: status?.member_count?.toLocaleString() ?? "—" },
              { icon: Activity, label: "Latency", value: status?.latency_ms != null ? `${status.latency_ms} ms` : "—" },
              { icon: Zap, label: "Shards", value: status?.shard_count?.toLocaleString() ?? "—" },
            ].map((s, i) => (
              <div key={i} className="p-4 rounded-2xl border border-white/5 bg-white/[0.025] shadow-2xl shadow-black/10">
                <s.icon className="w-4 h-4 text-[#818cf8] mb-3" />
                <p className="text-2xl font-bold text-white leading-none">{s.value}</p>
                <p className="text-xs text-white/40 mt-2 uppercase tracking-[0.18em]">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {online && (
          <div className="relative rounded-3xl border border-white/10 bg-[#10131a]/80 overflow-hidden shadow-2xl shadow-black/30">
            <div className="p-5 md:p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div>
                <p className="text-[#818cf8] text-xs font-bold tracking-[0.2em] uppercase">Clusters</p>
                <h2 className="text-2xl font-extrabold text-white mt-1">Shard distribution</h2>
              </div>
              <div className="relative md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search cluster or shard..."
                  className="w-full h-11 rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-[#5865F2]/60 focus:bg-white/[0.06] transition-colors"
                />
              </div>
            </div>

            <div className="grid gap-4 p-4 md:p-6">
              {clusters.map(cluster => (
                <div key={cluster.id} className="group rounded-2xl border border-white/10 bg-white/[0.025] p-5 hover:bg-white/[0.04] transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-5 justify-between">
                    <div className="min-w-44">
                      <p className="text-white text-xl font-extrabold lowercase">cluster {cluster.id}</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {cluster.shards.length ? cluster.shards.map(shard => (
                          <span key={shard} className="w-7 h-7 rounded-lg bg-[#5865F2]/15 border border-[#5865F2]/20 text-[#aeb6ff] text-xs font-bold flex items-center justify-center">
                            {shard}
                          </span>
                        )) : <span className="text-white/30 text-sm">no shards</span>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 flex-1">
                      {[
                        { label: "shards", value: compactShards(cluster.shards), icon: Zap },
                        { label: "servers", value: cluster.servers.toLocaleString(), icon: Server },
                        { label: "cached users", value: cluster.cached_users?.toLocaleString() ?? "—", icon: Users },
                        { label: "latency", value: cluster.latency_ms != null ? `${cluster.latency_ms} ms` : "—", icon: Activity },
                        { label: "uptime", value: cluster.uptime ?? "—", icon: Clock },
                        { label: "mem usage", value: cluster.mem_usage_mb != null ? `${cluster.mem_usage_mb} mb` : "—", icon: Database },
                      ].map(item => (
                        <div key={item.label} className="rounded-xl bg-black/20 border border-white/5 p-3">
                          <div className="flex items-center gap-1.5 text-white/35 mb-2">
                            <item.icon className="w-3.5 h-3.5" />
                            <span className="text-[10px] uppercase tracking-[0.16em]">{item.label}</span>
                          </div>
                          <p className="text-white font-bold text-sm break-words">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-white/30 mt-4">last updated: {secondsAgo(cluster.last_updated_at)}</p>
                </div>
              ))}

              {clusters.length === 0 && (
                <div className="text-center py-10 text-white/40 text-sm">No clusters match your search.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
