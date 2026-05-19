import { useT } from "@/i18n";
import { useEffect, useMemo, useState } from "react";
import { Activity, Clock, Database, Search, Server, Users, Wifi, WifiOff, Zap } from "lucide-react";
import { LandingNavbar } from "@/components/LandingNavbar";

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

function secondsAgo(iso?: string | null, t?: (key: string) => string) {
  if (!iso) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 1) return t ? t("publicStatus_justNow") : "just now";
  if (seconds === 1) return t ? `1 ${t("publicStatus_secondAgo")}` : "1 second ago";
  return t ? `${seconds} ${t("publicStatus_secondsAgo")}` : `${seconds} seconds ago`;
}

function compactShards(shards: number[]) {
  return shards.length ? shards.join("") : "—";
}

export function PublicStatusPage() {
  const { t } = useT();
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [query, setQuery] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    document.title = t("publicStatus_title");
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
    <div className="min-h-screen bg-[#1E1E2D]">
      <LandingNavbar />

      <div className="relative max-w-5xl mx-auto px-4 pt-28 pb-16">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[520px] h-[300px] rounded-full blur-3xl pointer-events-none bg-primary/10" />

        <div className="relative text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-white/50 text-xs mb-5">
            <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            {t("publicStatus_liveMonitor")}
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3 tracking-tight">{t("publicStatus_botStatusTitle")}</h1>
          <p className="text-white/40 text-sm">{t("publicStatus_statusDesc")}</p>
        </div>

        <div className={`relative flex items-center gap-3 p-4 rounded-2xl border mb-5 shadow-[0px_8px_17px_rgba(0,157,181,0.07)] ${online ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
          {online
            ? <Wifi className="w-5 h-5 text-green-400" />
            : <WifiOff className="w-5 h-5 text-red-400" />}
          <div className="flex-1">
            <p className={`font-bold ${online ? "text-green-400" : "text-red-400"}`}>
              {status === null ? t("publicStatus_checking") : online ? t("publicStatus_operational") : t("publicStatus_offline")}
            </p>
            {status?.username && <p className="text-white/40 text-sm">{status.username}</p>}
          </div>
          {status !== null && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-white/35">
              <Clock className="w-3.5 h-3.5" />
              {t("publicStatus_lastUpdated")} {secondsAgo(status.last_updated_at, t)}
            </div>
          )}
        </div>

        {online && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { icon: Server, label: t("publicStatus_servers"), value: status?.guild_count?.toLocaleString() ?? "—" },
              { icon: Users, label: t("publicStatus_cachedUsers"), value: status?.member_count?.toLocaleString() ?? "—" },
              { icon: Activity, label: t("publicStatus_latency"), value: status?.latency_ms != null ? `${status.latency_ms} ms` : "—" },
              { icon: Zap, label: t("publicStatus_shards"), value: status?.shard_count?.toLocaleString() ?? "—" },
            ].map((s, i) => (
              <div key={i} className="p-4 rounded-2xl border border-white/5 bg-card shadow-[0px_8px_17px_rgba(0,157,181,0.07)]">
                <s.icon className="w-4 h-4 text-primary mb-3" />
                <p className="text-2xl font-bold text-white leading-none">{s.value}</p>
                <p className="text-xs text-white/40 mt-2 uppercase tracking-[0.18em]">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {online && (
          <div className="relative rounded-3xl border border-white/10 bg-card overflow-hidden shadow-[0px_8px_17px_rgba(0,157,181,0.07)]">
            <div className="p-5 md:p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div>
                <p className="text-primary text-xs font-bold tracking-[0.2em] uppercase">{t("publicStatus_clusters")}</p>
                <h2 className="text-2xl font-extrabold text-white mt-1">{t("publicStatus_shardDistribution")}</h2>
              </div>
              <div className="relative md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t("publicStatus_searchCluster")}
                  className="w-full h-11 rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-primary/60 focus:bg-white/[0.06] transition-colors"
                />
              </div>
            </div>

            <div className="grid gap-4 p-4 md:p-6">
              {clusters.map(cluster => (
                <div key={cluster.id} className="group rounded-2xl border border-white/10 bg-white/[0.025] p-5 hover:bg-white/[0.04] transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-5 justify-between">
                    <div className="min-w-44">
                      <p className="text-white text-xl font-extrabold lowercase">{t("publicStatus_cluster")} {cluster.id}</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {cluster.shards.length ? cluster.shards.map(shard => (
                          <span key={shard} className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                            {shard}
                          </span>
                        )) : <span className="text-white/30 text-sm">{t("publicStatus_noShards")}</span>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 flex-1">
                      {[
                        { label: t("publicStatus_shards"), value: compactShards(cluster.shards), icon: Zap },
                        { label: t("publicStatus_servers"), value: cluster.servers.toLocaleString(), icon: Server },
                        { label: t("publicStatus_cachedUsers"), value: cluster.cached_users?.toLocaleString() ?? "—", icon: Users },
                        { label: t("publicStatus_latency"), value: cluster.latency_ms != null ? `${cluster.latency_ms} ms` : "—", icon: Activity },
                        { label: t("uptime"), value: cluster.uptime ?? "—", icon: Clock },
                        { label: t("publicStatus_memUsage"), value: cluster.mem_usage_mb != null ? `${cluster.mem_usage_mb} mb` : "—", icon: Database },
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
                  <p className="text-xs text-white/30 mt-4">{t("publicStatus_lastUpdatedLabel")} {secondsAgo(cluster.last_updated_at, t)}</p>
                </div>
              ))}

              {clusters.length === 0 && (
                <div className="text-center py-10 text-white/40 text-sm">{t("publicStatus_noClusters")}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
