import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { apiFetch } from "@/hooks/useApi";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  ExternalLink,
  Twitter, Github, Send, Tv, Youtube, Instagram, Globe, ShoppingCart, Share2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface VerifyConfig {
  page_title: string;
  page_description: string;
  page_color: string;
  page_logo_url: string;
  page_background_url: string;
  button_text: string;
  success_message: string;
  server_name?: string;
  server_icon?: string;
  page_footer_text?: string;
  // Advanced
  banner_url?: string;
  cursor_url?: string;
  font_family?: string;
  bg_effect?: string;
  bg_color?: string;
  text_color?: string;
  btn_color?: string;
  btn_border_color?: string;
  card_border_color?: string;
  card_bg_color?: string;
  typewriter_effect?: boolean;
  glow_effect?: boolean;
  tilt_effect?: boolean;
  bio_description?: string;
  socials?: Record<string, string>;
  music_url?: string;
  terms_url?: string;
  custom_css?: string;
}

const SOCIAL_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  twitter: { icon: Twitter, color: "#1DA1F2" },
  github: { icon: Github, color: "#8b949e" },
  telegram: { icon: Send, color: "#26A5E4" },
  twitch: { icon: Tv, color: "#9146FF" },
  youtube: { icon: Youtube, color: "#FF0000" },
  instagram: { icon: Instagram, color: "#E4405F" },
  tiktok: { icon: Share2, color: "#ffffff" },
  shop: { icon: ShoppingCart, color: "#10b981" },
  website: { icon: Globe, color: "#6366f1" },
};

// ── API ────────────────────────────────────────────────────────────────────

async function fetchVerifyConfig(guildId: string): Promise<VerifyConfig> {
  const res = await apiFetch(`/api/verify/${guildId}/config`);
  if (!res.ok) throw new Error("Failed to load verification config");
  return res.json();
}

// ── Background Effects ─────────────────────────────────────────────────────

function ShootingStars() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="absolute w-0.5 bg-gradient-to-b from-white/60 to-transparent"
          style={{
            height: `${40 + Math.random() * 60}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 50}%`,
            animation: `shootingStar ${2 + Math.random() * 3}s linear ${Math.random() * 5}s infinite`,
            transform: "rotate(-45deg)",
          }}
        />
      ))}
      <style>{`
        @keyframes shootingStar {
          0% { transform: translateX(0) translateY(0) rotate(-45deg); opacity: 1; }
          100% { transform: translateX(300px) translateY(300px) rotate(-45deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="absolute w-1 h-1 rounded-full bg-white/20"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${4 + Math.random() * 6}s ease-in-out ${Math.random() * 5}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0) scale(1); opacity: 0.2; }
          100% { transform: translateY(-40px) scale(1.5); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

// ── Typewriter Hook ────────────────────────────────────────────────────────

function useTypewriter(text: string, enabled: boolean, speed = 50) {
  const [displayed, setDisplayed] = useState(enabled ? "" : text);
  useEffect(() => {
    if (!enabled) { setDisplayed(text); return; }
    setDisplayed("");
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, enabled, speed]);
  return displayed;
}

// ── Tilt Effect Hook ───────────────────────────────────────────────────────

function useTilt(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const el = ref.current;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
    };
    const onLeave = () => { el.style.transform = "perspective(800px) rotateY(0) rotateX(0)"; };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
  }, [enabled]);
  return ref;
}

// ── Component ──────────────────────────────────────────────────────────────

export function VerifyPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [searchParams] = useSearchParams();

  const [config, setConfig] = useState<VerifyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState("");

  const isSuccess = searchParams.get("success") === "true";
  const urlError = searchParams.get("error");

  // Generate browser fingerprint for alt detection
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("InfinityBot fp", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("InfinityBot fp", 4, 17);
      }
      const dataUrl = canvas.toDataURL();
      // Simple hash
      let hash = 0;
      for (let i = 0; i < dataUrl.length; i++) {
        const chr = dataUrl.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
      }
      const info = `${navigator.userAgent}|${screen.width}x${screen.height}|${Intl.DateTimeFormat().resolvedOptions().timeZone}|${navigator.language}|${hash}`;
      let fpHash = 0;
      for (let i = 0; i < info.length; i++) {
        fpHash = ((fpHash << 5) - fpHash) + info.charCodeAt(i);
        fpHash |= 0;
      }
      setFingerprint(Math.abs(fpHash).toString(36));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!guildId) { setError("Invalid verification link."); setLoading(false); return; }
    fetchVerifyConfig(guildId)
      .then(data => { setConfig(data); setError(null); })
      .catch(() => setError("Unable to load verification page."))
      .finally(() => setLoading(false));
  }, [guildId]);

  const bgColor = config?.bg_color || "#0b0d14";
  const textColor = config?.text_color || "#ffffff";
  const btnColor = config?.btn_color || config?.page_color || "#5865F2";
  const btnBorder = config?.btn_border_color || btnColor;
  const cardBg = config?.card_bg_color || "#1a1d2e";
  const cardBorder = config?.card_border_color || "#1a1d2e";
  const fontFamily = config?.font_family || "Inter";
  const bgImage = config?.page_background_url;
  const bgEffect = config?.bg_effect || "none";

  const titleText = useTypewriter(
    config?.page_title || "Verify Your Account",
    config?.typewriter_effect ?? false,
  );
  const tiltRef = useTilt(config?.tilt_effect ?? false);

  const activeSocials = config?.socials
    ? Object.entries(config.socials).filter(([, v]) => v).map(([k, v]) => ({ key: k, url: v, ...SOCIAL_ICONS[k] }))
    : [];

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: `${textColor}60` }} />
          <p style={{ color: `${textColor}50` }} className="text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // ── Error (no config) ──
  if (error && !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0d14] p-4">
        <div className="w-full max-w-md rounded-2xl bg-[#1a1d2e] border border-white/10 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Verification Unavailable</h1>
          <p className="text-white/50 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: bgColor, fontFamily }}>
        {bgImage && <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        {bgImage && <div className="absolute inset-0 bg-black/60" />}
        <div className="relative w-full max-w-md rounded-2xl backdrop-blur-xl border p-8 text-center shadow-2xl"
          style={{ backgroundColor: `${cardBg}e6`, borderColor: cardBorder }}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${btnColor}20` }}>
            <CheckCircle2 className="h-8 w-8" style={{ color: btnColor }} />
          </div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: textColor }}>Verified!</h1>
          <p style={{ color: `${textColor}60` }} className="text-sm">
            {config?.success_message || "You have been verified successfully."}
          </p>
        </div>
      </div>
    );
  }

  // ── Error from OAuth ──
  if (urlError) {
    const errorMsg =
      urlError === "blacklisted" ? "Your account has been blacklisted."
      : urlError === "vpn_detected" ? "VPN or proxy detected. Please disable it."
      : urlError === "account_too_new" ? "Your Discord account is too new."
      : urlError === "captcha_failed" ? "CAPTCHA verification failed."
      : `An error occurred: ${urlError}`;
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: bgColor, fontFamily }}>
        {bgImage && <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        {bgImage && <div className="absolute inset-0 bg-black/60" />}
        <div className="relative w-full max-w-md rounded-2xl backdrop-blur-xl border p-8 text-center shadow-2xl"
          style={{ backgroundColor: `${cardBg}e6`, borderColor: cardBorder }}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: textColor }}>Verification Failed</h1>
          <p style={{ color: `${textColor}60` }} className="text-sm">{errorMsg}</p>
          <button onClick={() => window.location.reload()}
            className="mt-6 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: btnColor }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Main Verify Page ──
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundColor: bgColor,
        fontFamily,
        cursor: config?.cursor_url ? `url(${config.cursor_url}), auto` : undefined,
      }}
    >
      {bgImage && <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      {bgImage && <div className="absolute inset-0 bg-black/50" />}

      {/* Background effects */}
      {bgEffect === "stars" && <ShootingStars />}
      {bgEffect === "particles" && <FloatingParticles />}
      {bgEffect === "gradient" && (
        <div className="absolute inset-0" style={{
          background: `linear-gradient(45deg, ${btnColor}20, transparent, ${btnColor}10)`,
          animation: "gradientShift 8s ease infinite",
        }} />
      )}

      {/* Custom CSS */}
      {config?.custom_css && <style>{config.custom_css}</style>}

      <div
        ref={tiltRef}
        className="relative w-full max-w-md rounded-2xl backdrop-blur-xl border p-8 text-center shadow-2xl transition-transform duration-200"
        style={{ backgroundColor: `${cardBg}e6`, borderColor: cardBorder }}
      >
        {/* Banner */}
        {config?.banner_url && (
          <div className="w-full h-24 rounded-xl overflow-hidden mb-5 -mt-2">
            <img src={config.banner_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Logo */}
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl overflow-hidden border-2 shadow-lg"
          style={{ borderColor: `${textColor}15` }}>
          {config?.page_logo_url || config?.server_icon ? (
            <img src={config.page_logo_url || config?.server_icon} alt="Server" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-2xl" style={{ backgroundColor: `${btnColor}30` }}>
              <Shield className="h-10 w-10" style={{ color: btnColor }} />
            </div>
          )}
        </div>

        {/* Server name */}
        {config?.server_name && (
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: `${textColor}40` }}>
            {config.server_name}
          </p>
        )}

        {/* Title */}
        <h1
          className={`text-2xl font-bold mb-2 ${config?.glow_effect ? "drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]" : ""}`}
          style={{ color: textColor }}
        >
          {titleText}
          {config?.typewriter_effect && titleText.length < (config?.page_title || "Verify Your Account").length && (
            <span className="inline-block w-0.5 h-5 ml-0.5 align-middle animate-pulse" style={{ backgroundColor: btnColor }} />
          )}
        </h1>

        {/* Bio */}
        {config?.bio_description && (
          <p className="text-sm mb-2" style={{ color: `${textColor}60` }}>{config.bio_description}</p>
        )}

        {/* Description */}
        <p className="text-sm mb-8 leading-relaxed" style={{ color: `${textColor}50` }}>
          {config?.page_description || "Please verify your Discord account to gain access to the server."}
        </p>

        {/* Verify button */}
        <a
          href={`/api/verify/${guildId}/start${fingerprint ? `?fp=${fingerprint}` : ""}`}
          className="inline-flex items-center justify-center gap-2 w-full rounded-xl px-6 py-3.5 text-base font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] shadow-lg"
          style={{
            backgroundColor: btnColor,
            borderColor: btnBorder,
            borderWidth: 1,
            borderStyle: "solid",
            boxShadow: `0 8px 24px ${btnColor}30`,
          }}
        >
          <ExternalLink className="h-5 w-5" />
          {config?.button_text || "Verify with Discord"}
        </a>

        {/* Socials */}
        {activeSocials.length > 0 && (
          <div className="flex justify-center gap-3 mt-5">
            {activeSocials.map(s => {
              if (!s.icon) return null;
              const Icon = s.icon;
              return (
                <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors">
                  <Icon className="w-4 h-4" style={{ color: s.color }} />
                </a>
              );
            })}
          </div>
        )}

        {/* Terms */}
        {config?.terms_url && (
          <p className="mt-4 text-xs" style={{ color: `${textColor}30` }}>
            By verifying you agree to the{" "}
            <a href={config.terms_url} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-60">
              Terms of Service
            </a>
          </p>
        )}

        {/* Footer */}
        <p className="mt-6 text-xs" style={{ color: `${textColor}25` }}>
          {config?.page_footer_text || "Powered by Infinity Bot"}
        </p>
      </div>

      <style>{`
        @keyframes gradientShift {
          0%, 100% { opacity: 0.3; transform: rotate(0deg); }
          50% { opacity: 0.6; transform: rotate(2deg); }
        }
      `}</style>

      {/* Background Music */}
      {config?.music_url && <MusicPlayer url={config.music_url} color={btnColor} />}
    </div>
  );
}

function MusicPlayer({ url, color }: { url: string; color: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.3;
    audio.muted = true;
    audio.play().catch(() => {});
  }, [url]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
    if (!audio.muted) audio.play().catch(() => {});
  }

  return (
    <>
      <audio ref={audioRef} src={url} loop />
      <button
        onClick={toggle}
        className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center text-white text-lg shadow-lg transition-all hover:scale-110 active:scale-95"
        style={{ backgroundColor: color }}
        title={muted ? "Unmute" : "Mute"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </>
  );
}
