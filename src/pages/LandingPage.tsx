import { useT } from "@/i18n";
import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, Gift, Shield, Palette, ArrowRight, Zap, Server, Users, Activity, ChevronRight } from "lucide-react";
import { LandingNavbar, useLandingFonts } from "@/components/LandingNavbar";

/* ── Terminal typing animation ───────────────────────────────── */
const COMMANDS = [
  { cmd: "/shop", out: "→  Opening server shop..." },
  { cmd: "/verify setup", out: "→  Verification enabled ✓" },
  { cmd: "/giveaway start", out: "→  Giveaway started! 🎉" },
  { cmd: "/moderation cases", out: "→  Showing case list..." },
  { cmd: "/backup create", out: "→  Backup created ✓" },
];

function Terminal() {
  const [lineIdx, setLineIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [showOut, setShowOut] = useState(false);
  const [history, setHistory] = useState<{ cmd: string; out: string }[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const line = COMMANDS[lineIdx % COMMANDS.length];
    let i = 0;
    setTyped("");
    setShowOut(false);

    const type = () => {
      if (i <= line.cmd.length) {
        setTyped(line.cmd.slice(0, i));
        i++;
        timerRef.current = setTimeout(type, 55);
      } else {
        timerRef.current = setTimeout(() => {
          setShowOut(true);
          timerRef.current = setTimeout(() => {
            setHistory(h => [...h.slice(-3), { cmd: line.cmd, out: line.out }]);
            setLineIdx(n => n + 1);
          }, 900);
        }, 180);
      }
    };
    timerRef.current = setTimeout(type, 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [lineIdx]);

  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace" }}
      className="rounded-2xl border border-white/10 bg-[#0a0c10] p-5 text-sm shadow-2xl w-full max-w-md">
      {/* title bar */}
      <div className="flex items-center gap-1.5 mb-4">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-xs text-white/30">infinity-bot — terminal</span>
      </div>
      {/* history */}
      {history.map((h, i) => (
        <div key={i} className="mb-1 opacity-40">
          <span className="text-[#00d4aa]">$ </span>
          <span className="text-white">{h.cmd}</span>
          <div className="text-white/50 ml-2">{h.out}</div>
        </div>
      ))}
      {/* current */}
      <div className="mb-1">
        <span className="text-[#00d4aa]">$ </span>
        <span className="text-white">{typed}</span>
        <span className="inline-block w-2 h-4 bg-[#5865F2] ml-0.5 animate-pulse align-middle" />
      </div>
      {showOut && (
        <div className="text-[#00d4aa]/80 ml-2 animate-in fade-in duration-300">
          {COMMANDS[lineIdx > 0 ? (lineIdx - 1) % COMMANDS.length : 0]?.out}
        </div>
      )}
    </div>
  );
}

/* ── Stats counter ───────────────────────────────────────────── */
function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const start = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1);
        setVal(Math.floor(p * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration]);
  return { val, ref };
}

function StatCard({ icon: Icon, value, label, suffix = "+" }: { icon: typeof Zap; value: number; label: string; suffix?: string }) {
  const { val, ref } = useCountUp(value);
  return (
    <div ref={ref} className="flex flex-col items-center gap-1">
      <Icon className="w-5 h-5 text-[#5865F2] mb-1" />
      <span style={{ fontFamily: "'Syne', sans-serif" }} className="text-3xl font-800 text-white font-bold">
        {val.toLocaleString()}{suffix}
      </span>
      <span className="text-sm text-white/50">{label}</span>
    </div>
  );
}

/* ── Feature cards ───────────────────────────────────────────── */
const FEATURES = [
  { icon: ShoppingBag, titleKey: "landing_shopOrders", descKey: "landing_shopOrdersDesc", color: "#5865F2" },
  { icon: Gift, titleKey: "landing_giveaway", descKey: "landing_giveawayDesc", color: "#f59e0b" },
  { icon: Shield, titleKey: "landing_moderation", descKey: "landing_moderationDesc", color: "#ef4444" },
  { icon: Users, titleKey: "landing_verification", descKey: "landing_verificationDesc", color: "#a855f7" },
  { icon: Palette, titleKey: "landing_embedBuilder", descKey: "landing_embedBuilderDesc", color: "#ec4899" },
];

/* ── Main Landing Page ───────────────────────────────────────── */
export function LandingPage() {
  const { t } = useT();
  useLandingFonts();

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [supportUrl, setSupportUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/invite")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.invite_url) setInviteUrl(d.invite_url);
        if (d?.support_url) setSupportUrl(d.support_url);
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ background: "#0d0f14", fontFamily: "'Syne', sans-serif", minHeight: "100vh" }}>
      <LandingNavbar />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-20 pb-12 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(88,101,242,0.18) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute top-1/2 right-0 w-96 h-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(0,212,170,0.1) 0%, transparent 70%)", filter: "blur(60px)" }} />

        <div className="relative z-10 max-w-6xl w-full mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Text side */}
          <div className="flex-1 text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#5865F2]/30 bg-[#5865F2]/10 text-[#818cf8] text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
              {t("landing_allInOne")}
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.08] mb-6 tracking-tight">
              {t("landing_manageServer")}
              <br />
              <span style={{ background: "linear-gradient(135deg, #5865F2, #00d4aa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {t("landing_effortlessly")}
              </span>
            </h1>

            <p className="text-lg text-white/50 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              {t("landing_heroDesc")}
            </p>

            <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
              {inviteUrl && (
                <a href={inviteUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#5865F2]/25">
                  <Zap className="w-4 h-4" /> {t("landing_addToServer")}
                </a>
              )}
              <Link to="/dashboard"
                className="flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]">
                {t("landing_goToDashboard")} <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Stats */}
            <div className="flex gap-8 mt-10 justify-center lg:justify-start">
              <StatCard icon={Server} value={500} label={t("landing_servers")} />
              <StatCard icon={Users} value={50000} label={t("landing_members")} />
              <StatCard icon={Activity} value={99} label={t("landing_uptime")} suffix="%" />
            </div>
          </div>

          {/* Terminal side */}
          <div className="flex-shrink-0 w-full max-w-md">
            <Terminal />
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="relative px-4 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#5865F2] text-sm font-semibold tracking-widest uppercase mb-3">{t("landing_features")}</p>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
              {t("landing_everythingYouNeed")}
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              {t("landing_featuresDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i}
                className="group relative p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300 cursor-default overflow-hidden">
                {/* Glow on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `radial-gradient(circle at 0% 0%, ${f.color}15 0%, transparent 60%)` }} />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${f.color}20`, border: `1px solid ${f.color}30` }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <h3 className="text-white font-bold mb-2">{t(f.titleKey)}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{t(f.descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ───────────────────────────────────── */}
      <section className="px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative rounded-3xl border border-white/10 overflow-hidden p-12"
            style={{ background: "linear-gradient(135deg, rgba(88,101,242,0.15), rgba(0,212,170,0.08))" }}>
            <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 0%, rgba(88,101,242,0.2), transparent 70%)" }} />
            <div className="relative">
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
                {t("landing_readyToStart")}
              </h2>
              <p className="text-white/50 mb-8 text-lg">{t("landing_ctaDesc")}</p>
              <div className="flex flex-wrap gap-3 justify-center">
                {inviteUrl && (
                  <a href={inviteUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-sm transition-all hover:scale-[1.02] shadow-xl shadow-[#5865F2]/30">
                    <Zap className="w-4 h-4" /> {t("landing_addBotFree")}
                  </a>
                )}
                <Link to="/commands"
                  className="flex items-center gap-2 px-8 py-3.5 rounded-xl border border-white/15 text-white font-bold text-sm hover:bg-white/5 transition-all hover:scale-[1.02]">
                  {t("landing_viewCommands")} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-white/5 px-4 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <div className="w-5 h-5 rounded bg-[#5865F2] flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span>{t("landing_copyright")}</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-white/30">
            <Link to="/commands" className="hover:text-white/60 transition-colors">{t("landing_commands")}</Link>
            <Link to="/pricing" className="hover:text-white/60 transition-colors">{t("landing_pricing")}</Link>
            <Link to="/status" className="hover:text-white/60 transition-colors">{t("landing_status")}</Link>
            {supportUrl && (
              <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">{t("landing_support")}</a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
