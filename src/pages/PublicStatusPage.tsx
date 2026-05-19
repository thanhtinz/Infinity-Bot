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

const STATUS_COLORS = {
  operational: { dot: "bg-emerald-400", bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-400" },
  degraded: { dot: "bg-amber-400", bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-400" },
  outage: { dot: "bg-red-400", bg: "bg-red-500/5", border: "border-red-500/20", text: "text-red-400" },
};

function getStatusLevel(online: boolean | null) {
  if (online === null) return "degraded";
  return online ? "operational" : "outage";
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
  const level = getStatusLevel(online);
  const sc = STATUS_COLORS[level];
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

  const services = [
    { name: "Bot", icon: Zap, online: status?.online ?? null, latency: status?.latency_ms },
    { name: "API", icon: Server, online: status?.online ?? null, latency: status?.latency_ms },
    { name: "Dashboard", icon: Activity, online: true, latency: null },
    { name: "Database", icon: Database, online: status?.online ?? null, latency: null },
  ];

  return (
    <div className="min-h-screen bg-[#1E1E2D] animate-fade-in">
      <LandingNavbar />

      <div className="relative max-w-5xl mx-auto px-4 pt-28 pb-16">
        {/* Background glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[520px] h-[300px] rounded-full blur-3xl pointer-events-none bg-[#009DB5]/8" />

        {/* Header */}
        <div className="relative text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-[#262932] text-[#9FA8C1] text-[12px] font-semibold mb-5">
            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} ${online ? "animate-pulse" : ""}`} />
            {t("publicStatus_liveMonitor")}
          </div>
          <h1 className="text-[36px] md:text-[44px] font-bold text-white tracking-tight mb-3">
            {t("publicStatus_botStatusTitle")}
          </h1>
          <p className="text-[14px] text-[#9FA8C1]">{t("publicStatus_statusDesc")}</p>
        </div>

        {/* Overall status banner */}
        <div className={`relative flex items-center gap-3 p-4 rounded-[10px] border mb-5 shadow-[0px_7.8px_17.3px_rgba(0,157,181,0.07)] ${sc.bg} ${sc.border}`}>
          {online ? (
            <Wifi className="w-5 h-5 text-emerald-400" />
          ) : (
            <WifiOff className="w-5 h-5 text-red-400" />
          )}
          <div className="flex-1">
            <p className={`font-semibold ${sc.text}`}>
              {status === null ? t("publicStatus_checking") : online ? t("publicStatus_operational") : t("publicStatus_offline")}
            </p>
            {status?.username && <p className="text-[#9FA8C1] text-[13px]">{status.username}</p>}
          </div>
          {status !== null && (
            <div className="hidden sm:flex items-center gap-2 text-[12px] text-[#9FA8C1]">
              <Clock className="w-3.5 h-3.5" />
              {t("publicStatus_lastUpdated")} {secondsAgo(status.last_updated_at, t)}
            </div>
          )}
        </div>

        {/* Service cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {services.map(svc => {
            const svcLevel = svc.online === null ? "degraded" : svc.online ? "operational" : "outage";
            const svcColor = STATUS_COLORS[svcLevel];
            return (
              <div key={svc.name} className="p-4 rounded-[10px] bg-[#262932] shadow-[0px_7.8px_17.3px_rgba(0,157,181,0.07)]">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${svcColor.dot} ${svc.online ? "animate-pulse" : ""}`} />
                  <svc.icon className="w-4 h-4 text-[#009DB5]" />
                </div>
                <p className="text-[14px] font-semibold text-white">{svc.name}</p>
                <p className={`text-[12px] mt-0.5 ${svcColor.text}`}>
                  {svc.online === null ? "Checking..." : svc.online ? "Operational" : "Offline"}
                </p>
                {svc.latency != null && (
                  <p className="text-[11px] text-[#9FA8C1] mt-1">{svc.latency} ms</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Stats grid */}
        {online && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { icon: Server, label: t("publicStatus_servers"), value: status?.guild_count?.toLocaleString() ?? "—" },
              { icon: Users, label: t("publicStatus_cachedUsers"), value: status?.member_count?.toLocaleString() ?? "—" },
              { icon: Activity, label: t("publicStatus_latency"), value: status?.latency_ms != null ? `${status.latency_ms} ms` : "—" },
              { icon: Zap, label: t("publicStatus_shards"), value: status?.shard_count?.toLocaleString() ?? "—" },
            ].map((s, i) => (
              <div key={i} className="p-4 rounded-[10px] bg-[#262932] shadow-[0px_7.8px_17.3px_rgba(0,157,181,0.07)]">
                <s.icon className="w-4 h-4 text-[#009DB5] mb-3" />
                <p className="text-2xl font-bold text-white leading-none">{s.value}</p>
                <p className="text-[11px] text-[#9FA8C1] mt-2 uppercase tracking-[0.12em]">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Clusters section */}
        {online && (
          <div className="rounded-[10px] bg-[#262932] overflow-hidden shadow-[0px_7.8px_17.3px_rgba(0,157,181,0.07)]">
            <div className="p-5 md:p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div>
                <p className="text-[#009DB5] text-[11px] font-bold tracking-[0.15em] uppercase">{t("publicStatus_clusters")}</p>
                <h2 className="text-[20px] font-bold text-white mt-1">{t("publicStatus_shardDistribution")}</h2>
              </div>
              <div className="relative md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9FA8C1]/50" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t("publicStatus_searchCluster")}
                  className="w-full h-10 rounded-[8px] bg-[#1E1E2D] pl-10 pr-3 text-[13px] text-white placeholder:text-[#9FA8C1]/40 outline-none focus:ring-2 focus:ring-[#009DB5]/30 transition-all"
                />
              </div>
            </div>

            <div className="grid gap-4 p-4 md:p-6">
              {clusters.map(cluster => (
                <div key={cluster.id} className="rounded-[10px] bg-[#1E1E2D] p-5 hover:bg-[#1E1E2D]/80 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-5 justify-between">
                    <div className="min-w-44">
                      <p className="text-white text-[18px] font-bold lowercase">{t("publicStatus_cluster")} {cluster.id}</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {cluster.shards.length ? cluster.shards.map(shard => (
                          <span key={shard} className="w-7 h-7 rounded-[6px] bg-[#009DB5]/10 text-[#009DB5] text-[11px] font-bold flex items-center justify-center">
                            {shard}
                          </span>
                        )) : <span className="text-[#9FA8C1]/50 text-[13px]">{t("publicStatus_noShards")}</span>}
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
                        <div key={item.label} className="rounded-[8px] bg-[#262932] p-3">
                          <div className="flex items-center gap-1.5 text-[#9FA8C1]/50 mb-2">
                            <item.icon className="w-3.5 h-3.5" />
                            <span className="text-[10px] uppercase tracking-[0.12em]">{item.label}</span>
                          </div>
                          <p className="text-white font-semibold text-[13px] break-words">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-[#9FA8C1]/40 mt-4">{t("publicStatus_lastUpdatedLabel")} {secondsAgo(cluster.last_updated_at, t)}</p>
                </div>
              ))}

              {clusters.length === 0 && (
                <div className="text-center py-10 text-[#9FA8C1] text-[13px]">{t("publicStatus_noClusters")}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
