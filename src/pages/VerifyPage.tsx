import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { apiFetch } from "@/hooks/useApi";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  ExternalLink,
  Send, Tv, Globe, ShoppingCart, Share2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface VerifyConfig {
  page_title: string;
  page_description: string;
  page_color: string;
  page_logo_url: string;
  page_background_url: string;
  button_text: string;
  success_message: string;
  captcha_enabled?: boolean;
  captcha_type?: "none" | "button" | "emoji" | "math" | "slider";
  captcha_difficulty?: "easy" | "medium" | "hard";
  server_name?: string;
  server_icon?: string;
  page_footer_text?: string;
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
  card_opacity?: number;
  content_opacity?: number;
  typewriter_effect?: boolean;
  typewriter_desc_effect?: boolean;
  glow_effect?: boolean;
  tilt_effect?: boolean;
  bio_description?: string;
  socials?: Record<string, string>;
  music_url?: string;
  terms_url?: string;
  custom_css?: string;
}

interface CaptchaChallenge {
  type: "none" | "button" | "emoji" | "math" | "slider";
  token?: string;
  message?: string;
  target?: string | number;
  options?: string[];
  question?: string;
  answer_hash?: string;
  tolerance?: number;
}

const SOCIAL_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  twitter: { icon: Globe, color: "#1DA1F2" },
  github: { icon: Globe, color: "#8b949e" },
  telegram: { icon: Send, color: "#26A5E4" },
  twitch: { icon: Tv, color: "#9146FF" },
  youtube: { icon: Globe, color: "#FF0000" },
  instagram: { icon: Globe, color: "#E4405F" },
  tiktok: { icon: Share2, color: "#ffffff" },
  shop: { icon: ShoppingCart, color: "#10b981" },
  website: { icon: Globe, color: "#6366f1" },
};

async function fetchVerifyConfig(guildId: string): Promise<VerifyConfig> {
  const res = await apiFetch(`/api/verify/${guildId}/config`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load verification config");
  return res.json();
}

async function generateCaptcha(guildId: string): Promise<CaptchaChallenge> {
  const res = await apiFetch(`/api/verify/${guildId}/captcha/generate`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to generate captcha");
  return res.json();
}

async function validateCaptcha(guildId: string, body: Record<string, unknown>): Promise<{ valid: boolean; token?: string; error?: string }> {
  const res = await apiFetch(`/api/verify/${guildId}/captcha/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to validate captcha");
  return res.json();
}

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
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white/25"
          style={{
            width: `${2 + (i % 3)}px`,
            height: `${2 + (i % 3)}px`,
            left: `${(i * 11) % 100}%`,
            top: `${(i * 17) % 100}%`,
            animation: `floatParticle ${5 + (i % 6)}s ease-in-out ${(i % 5) * 0.6}s infinite alternate`,
            filter: "blur(0.2px)",
          }}
        />
      ))}
      <style>{`
        @keyframes floatParticle {
          0% { transform: translate3d(0, 0, 0) scale(0.9); opacity: 0.15; }
          50% { transform: translate3d(10px, -18px, 0) scale(1.2); opacity: 0.45; }
          100% { transform: translate3d(-8px, -42px, 0) scale(1.5); opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}

function DigitalRain() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="absolute w-px bg-gradient-to-b from-green-400/60 to-transparent"
          style={{
            height: `${20 + Math.random() * 50}px`,
            left: `${Math.random() * 100}%`,
            top: `-${Math.random() * 20}%`,
            animation: `digitalRain ${0.8 + Math.random() * 2}s linear ${Math.random() * 3}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes digitalRain {
          0% { transform: translateY(0); opacity: 0.8; }
          100% { transform: translateY(110vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function useTypewriter(text: string, enabled: boolean, speed = 50, delay = 0) {
  const [displayed, setDisplayed] = useState(enabled ? "" : text);
  useEffect(() => {
    if (!enabled) { setDisplayed(text); return; }
    setDisplayed("");
    let i = 0;
    let timer: ReturnType<typeof setInterval>;
    const startTimer = () => {
      timer = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(timer);
      }, speed);
    };
    const delayTimer = delay > 0 ? setTimeout(startTimer, delay) : (startTimer(), undefined);
    return () => { clearInterval(timer); if (delayTimer) clearTimeout(delayTimer); };
  }, [text, enabled, speed, delay]);
  return displayed;
}

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

export function VerifyPage() {
  const { guildId: guildIdParam } = useParams<{ guildId: string }>();
  const [searchParams] = useSearchParams();

  // guildId may be a slug (e.g. "infinitymall") or a numeric Discord guild ID
  const [guildId, setGuildId] = useState<string | undefined>(
    /^\d+$/.test(guildIdParam ?? "") ? guildIdParam : undefined
  );

  const [config, setConfig] = useState<VerifyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [mathAnswer, setMathAnswer] = useState("");
  const [sliderValue, setSliderValue] = useState(50);

  // Resolve slug → guild_id if param is not numeric
  useEffect(() => {
    if (!guildIdParam) return;
    if (/^\d+$/.test(guildIdParam)) { setGuildId(guildIdParam); return; }
    apiFetch(`/api/verify/by-slug/${encodeURIComponent(guildIdParam)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setGuildId(data.guild_id))
      .catch(() => { setError("Unable to load verification page."); setLoading(false); });
  }, [guildIdParam]);

  const isSuccess = searchParams.get("success") === "true";
  const urlError = searchParams.get("error");

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
    } catch {}
  }, []);

  useEffect(() => {
    if (!guildId) return; // wait for slug resolution
    fetchVerifyConfig(guildId)
      .then(data => {
        setConfig(data);
        setError(null);
      })
      .catch((e) => { console.error("[VerifyPage] fetch error:", e); setError("Unable to load verification page."); })
      .finally(() => setLoading(false));
  }, [guildId]);

  useEffect(() => {
    if (!guildId || !config || !config.captcha_enabled || config.captcha_type === "none") {
      setCaptcha(null);
      setCaptchaToken("");
      return;
    }
    setCaptchaLoading(true);
    setCaptchaError(null);
    generateCaptcha(guildId)
      .then((data) => {
        setCaptcha(data);
        if (data.type === "none" && data.token) setCaptchaToken(data.token);
      })
      .catch(() => setCaptchaError("Unable to load captcha."))
      .finally(() => setCaptchaLoading(false));
  }, [guildId, config]);

  async function solveCaptcha(body: Record<string, unknown>) {
    if (!guildId) return;
    setCaptchaLoading(true);
    setCaptchaError(null);
    try {
      const result = await validateCaptcha(guildId, body);
      if (result.valid && result.token) {
        setCaptchaToken(result.token);
      } else {
        setCaptchaToken("");
        setCaptchaError(result.error || "Captcha failed.");
      }
    } catch {
      setCaptchaError("Captcha validation failed.");
    } finally {
      setCaptchaLoading(false);
    }
  }

  const bgColor = config?.bg_color || "#0b0d14";
  const textColor = config?.text_color || "#ffffff";
  const btnColor = config?.btn_color || config?.page_color || "#5865F2";
  const btnBorder = config?.btn_border_color || btnColor;
  const cardBgHex = config?.card_bg_color || "#1a1d2e";
  const cardOpacity = (config?.card_opacity ?? 95) / 100;
  const cardBg = (() => {
    const hex = cardBgHex.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${cardOpacity})`;
  })();
  const cardBorder = config?.card_border_color || "#1a1d2e";
  const contentOpacity = ((config?.content_opacity ?? 100) / 100);

  // Helper: apply contentOpacity on top of a hex color with alpha suffix (e.g. textColor + "50")
  const tc = (alphaHex: string) => {
    const hex = textColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const baseAlpha = parseInt(alphaHex, 16) / 255;
    return `rgba(${r},${g},${b},${(baseAlpha * contentOpacity).toFixed(3)})`;
  };
  const fontFamily = config?.font_family || "Inter";
  const bgImage = config?.page_background_url;
  const bgEffect = config?.bg_effect || "none";

  const titleText = useTypewriter(
    config?.page_title || "Verify Your Account",
    config?.typewriter_effect ?? false,
  );
  const descText = useTypewriter(
    config?.page_description || "Please verify your Discord account to gain access to the server.",
    config?.typewriter_desc_effect ?? false,
    30,
    config?.typewriter_desc_effect ? 300 : 0,
  );
  const tiltRef = useTilt(config?.tilt_effect ?? false);

  const activeSocials = config?.socials
    ? Object.entries(config.socials).filter(([, v]) => v).map(([k, v]) => ({ key: k, url: v, ...SOCIAL_ICONS[k] }))
    : [];

  const verifyParams = new URLSearchParams();
  if (fingerprint) verifyParams.set("fp", fingerprint);
  if (captchaToken) verifyParams.set("captcha_token", captchaToken);
  const verifyHref = `/api/verify/${guildId}/start${verifyParams.toString() ? `?${verifyParams.toString()}` : ""}`;

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: bgColor }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: `${textColor}60` }} />
          <p style={{ color: `${textColor}50` }} className="text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0b0d14", padding: "1rem" }}>
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

  if (isSuccess) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backgroundColor: bgColor, fontFamily }}>
        {bgImage && <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        {bgImage && <div className="absolute inset-0 bg-black/60" />}
        <div className="relative w-full max-w-md rounded-2xl border p-8 text-center shadow-2xl"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
          <div style={{ opacity: contentOpacity }}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${btnColor}20` }}>
            <CheckCircle2 className="h-8 w-8" style={{ color: btnColor }} />
          </div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: textColor }}>Verified!</h1>
          <p style={{ color: `${textColor}60` }} className="text-sm">
            {config?.success_message || "You have been verified successfully."}
          </p>
          </div>
        </div>
      </div>
    );
  }

  if (urlError) {
    const errorMsg =
      urlError === "blacklisted" ? "Your account has been blacklisted."
      : urlError === "vpn_detected" ? "VPN or proxy detected. Please disable it."
      : urlError === "account_too_new" ? "Your Discord account is too new."
      : urlError === "captcha_failed" ? "CAPTCHA verification failed."
      : `An error occurred: ${urlError}`;
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backgroundColor: bgColor, fontFamily }}>
        {bgImage && <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        {bgImage && <div className="absolute inset-0 bg-black/60" />}
        <div className="relative w-full max-w-md rounded-2xl border p-8 text-center shadow-2xl"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
          <div style={{ opacity: contentOpacity }}>
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
      </div>
    );
  }

  return (
    <>
    <div
      className="flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        width: "100vw",
        height: "100dvh",
        backgroundColor: bgColor,
        fontFamily,
        cursor: config?.cursor_url ? `url(${config.cursor_url}), auto` : undefined,
      }}
    >
      {bgImage && <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover z-0" />}
      {bgImage && <div className="absolute inset-0 bg-black/50 z-0" />}

      {bgEffect === "stars" && <div className="absolute inset-0 z-10 pointer-events-none"><ShootingStars /></div>}
      {bgEffect === "particles" && <div className="absolute inset-0 z-10 pointer-events-none"><FloatingParticles /></div>}
      {bgEffect === "rain" && <div className="absolute inset-0 z-10 pointer-events-none"><DigitalRain /></div>}
      {bgEffect === "gradient" && (
        <div className="absolute inset-0 z-10 pointer-events-none" style={{
          background: `linear-gradient(120deg, ${btnColor}22 0%, transparent 25%, ${btnColor}14 50%, transparent 75%, ${btnColor}22 100%)`,
          backgroundSize: "220% 220%",
          animation: "gradientShift 10s ease-in-out infinite",
        }} />
      )}

      {config?.custom_css && <style>{config.custom_css}</style>}

      <div
        ref={tiltRef}
        className="relative z-20 w-full max-w-md rounded-2xl border p-8 text-center shadow-2xl transition-transform duration-200"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      >
        <div style={{ opacity: contentOpacity }}>
        {config?.banner_url && (
          <div className="w-full h-24 rounded-xl overflow-hidden mb-5 -mt-2">
            <img src={config.banner_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl overflow-hidden border-2 shadow-lg"
          style={{ borderColor: tc("15") }}>
          {config?.page_logo_url || config?.server_icon ? (
            <img src={config.page_logo_url || config?.server_icon} alt="Server" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-2xl" style={{ backgroundColor: `${btnColor}30` }}>
              <Shield className="h-10 w-10" style={{ color: btnColor }} />
            </div>
          )}
        </div>

        {config?.server_name && (
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: tc("40") }}>
            {config.server_name}
          </p>
        )}

        <h1
          className={`text-2xl font-bold mb-2 ${config?.glow_effect ? "drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]" : ""}`}
          style={{ color: textColor }}
        >
          {titleText}
          {config?.typewriter_effect && titleText.length < (config?.page_title || "Verify Your Account").length && (
            <span className="inline-block w-0.5 h-5 ml-0.5 align-middle animate-pulse" style={{ backgroundColor: btnColor }} />
          )}
        </h1>

        {config?.bio_description && (
          <p className="text-sm mb-2" style={{ color: tc("60") }}>{config.bio_description}</p>
        )}

        <p className="text-sm mb-6 leading-relaxed" style={{ color: tc("50") }}>
          {descText}
          {config?.typewriter_desc_effect && descText.length < (config?.page_description || "Please verify your Discord account to gain access to the server.").length && (
            <span className="inline-block w-0.5 h-3.5 ml-0.5 align-middle animate-pulse" style={{ backgroundColor: btnColor }} />
          )}
        </p>

        {config?.captcha_enabled && config.captcha_type !== "none" && (
          <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium" style={{ color: textColor }}>Human check</p>
              {captchaToken ? <span className="text-xs text-emerald-400">Completed</span> : <span className="text-xs" style={{ color: tc("50") }}>{config.captcha_type}</span>}
            </div>

            {captchaLoading && (
              <div className="flex items-center gap-2 text-sm" style={{ color: tc("60") }}>
                <Loader2 className="h-4 w-4 animate-spin" /> Loading captcha...
              </div>
            )}

            {!captchaLoading && captchaError && (
              <div className="space-y-3">
                <p className="text-sm text-red-300">{captchaError}</p>
                <button
                  onClick={() => guildId && generateCaptcha(guildId).then(setCaptcha).catch(() => setCaptchaError("Unable to reload captcha."))}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-white"
                  style={{ backgroundColor: btnColor }}
                >
                  Reload captcha
                </button>
              </div>
            )}

            {!captchaLoading && !captchaError && captcha && !captchaToken && (
              <div className="space-y-3">
                {captcha.type === "button" && (
                  <button
                    onClick={() => solveCaptcha({})}
                    className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
                    style={{ backgroundColor: btnColor, border: `1px solid ${btnBorder}` }}
                  >
                    {captcha.message || "Click to verify you are human"}
                  </button>
                )}

                {captcha.type === "emoji" && (
                  <>
                    <p className="text-sm" style={{ color: tc("70") }}>{captcha.message}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {captcha.options?.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => solveCaptcha({ selected: emoji, target: captcha.target })}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-2xl hover:bg-white/10"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {captcha.type === "math" && (
                  <>
                    <p className="text-sm" style={{ color: tc("70") }}>{captcha.question}</p>
                    <div className="flex gap-2">
                      <input
                        value={mathAnswer}
                        onChange={(e) => setMathAnswer(e.target.value)}
                        placeholder="Answer"
                        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                      />
                      <button
                        onClick={() => solveCaptcha({ answer: mathAnswer, answer_hash: captcha.answer_hash })}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                        style={{ backgroundColor: btnColor }}
                      >
                        Submit
                      </button>
                    </div>
                  </>
                )}

                {captcha.type === "slider" && (
                  <>
                    <p className="text-sm" style={{ color: tc("70") }}>Drag to {captcha.target}%</p>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={sliderValue}
                      onChange={(e) => setSliderValue(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex items-center justify-between text-xs" style={{ color: tc("50") }}>
                      <span>Current: {sliderValue}%</span>
                      <span>Tolerance: ±{captcha.tolerance}%</span>
                    </div>
                    <button
                      onClick={() => solveCaptcha({ value: sliderValue, target: captcha.target, tolerance: captcha.tolerance })}
                      className="w-full rounded-lg px-4 py-2 text-sm font-medium text-white"
                      style={{ backgroundColor: btnColor }}
                    >
                      Confirm position
                    </button>
                  </>
                )}
              </div>
            )}

            {captchaToken && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                Captcha completed. You can continue with Discord verification.
              </div>
            )}
          </div>
        )}

        <a
          href={verifyHref}
          className={`inline-flex items-center justify-center gap-2 w-full rounded-xl px-6 py-3.5 text-base font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] shadow-lg ${config?.captcha_enabled && config.captcha_type !== "none" && !captchaToken ? "pointer-events-none opacity-50" : ""}`}
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

        {config?.terms_url && (
          <p className="mt-4 text-xs" style={{ color: tc("30") }}>
            By verifying you agree to the{" "}
            <a href={config.terms_url} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-60">
              Terms of Service
            </a>
          </p>
        )}

        <p className="mt-6 text-xs" style={{ color: tc("25") }}>
          {config?.page_footer_text || "Powered by Infinity Bot"}
        </p>
        </div>
      </div>

      <style>{`
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; opacity: 0.35; }
          50%  { background-position: 100% 50%; opacity: 0.65; }
          100% { background-position: 0% 50%; opacity: 0.35; }
        }
      `}</style>

    </div>
    {config?.music_url && <MusicPlayer url={config.music_url} color={btnColor} />}
    </>
  );
}

function MusicPlayer({ url, color }: { url: string; color: string }) {
  const audioRef   = useRef<HTMLAudioElement>(null);
  const [audioState, setAudioState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [muted, setMuted]           = useState(false);
  const [pos, setPos]               = useState({
    x: window.innerWidth  - 68,
    y: window.innerHeight - 68,
  });
  const posRef     = useRef(pos);
  posRef.current   = pos;
  const dragging   = useRef(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });
  const didDrag    = useRef(false);

  /* ── Audio events ── */
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = 0.3;
    const onPlay    = () => setAudioState("playing");
    const onPause   = () => setAudioState("idle");
    const onWaiting = () => setAudioState("loading");
    const onPlaying = () => setAudioState("playing");
    const onError   = () => { console.error("[MusicPlayer]", a.error); setAudioState("error"); };
    a.addEventListener("play",    onPlay);
    a.addEventListener("pause",   onPause);
    a.addEventListener("waiting", onWaiting);
    a.addEventListener("playing", onPlaying);
    a.addEventListener("error",   onError);
    setAudioState("loading");
    a.muted = false;
    a.play().catch(() => {
      a.muted = true;
      setMuted(true);
      a.play().catch(() => setAudioState("idle"));
    });
    return () => {
      a.removeEventListener("play",    onPlay);
      a.removeEventListener("pause",   onPause);
      a.removeEventListener("waiting", onWaiting);
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("error",   onError);
    };
  }, [url]);

  /* ── Unmute on first interaction ── */
  useEffect(() => {
    if (!muted) return;
    const unmute = () => { const a = audioRef.current; if (a) { a.muted = false; setMuted(false); } };
    window.addEventListener("click",      unmute, { once: true });
    window.addEventListener("touchstart", unmute, { once: true });
    window.addEventListener("keydown",    unmute, { once: true });
    return () => {
      window.removeEventListener("click",      unmute);
      window.removeEventListener("touchstart", unmute);
      window.removeEventListener("keydown",    unmute);
    };
  }, [muted]);

  /* ── Drag ── */
  function startDrag(clientX: number, clientY: number) {
    dragging.current   = true;
    didDrag.current    = false;
    dragOffset.current = { dx: clientX - posRef.current.x, dy: clientY - posRef.current.y };
    document.body.style.overflow = "hidden";
  }
  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragging.current) return;
      e.preventDefault();
      const { clientX, clientY } = "touches" in e ? e.touches[0] : e;
      didDrag.current = true;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth  - 44, clientX - dragOffset.current.dx)),
        y: Math.max(0, Math.min(window.innerHeight - 44, clientY - dragOffset.current.dy)),
      });
    }
    function onUp() { dragging.current = false; document.body.style.overflow = ""; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend",  onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend",  onUp);
    };
  }, []);

  /* ── Click to toggle ── */
  function handleClick() {
    if (didDrag.current) return;
    const a = audioRef.current;
    if (!a) return;
    if (!a.paused) { a.pause(); }
    else { setAudioState("loading"); a.play().catch(() => setAudioState("error")); }
  }

  const playing  = audioState === "playing";
  const loading  = audioState === "loading";
  const hasError = audioState === "error";

  /* Waveform bar heights cycle */
  const BAR_DELAYS = ["0s", "0.15s", "0.3s", "0.15s"];
  const BAR_HEIGHTS = [10, 16, 12, 18];

  return (
    <>
      <audio ref={audioRef} src={url} loop preload="auto" />
      <style>{`
        @keyframes mpWave {
          0%,100% { transform: scaleY(0.4); }
          50%      { transform: scaleY(1); }
        }
        @keyframes mpSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes mpPulse {
          0%,100% { box-shadow: 0 0 0 0 ${color}40; }
          50%     { box-shadow: 0 0 0 6px ${color}00; }
        }
      `}</style>

      <div
        onMouseDown={e  => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
        onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        onClick={handleClick}
        title={hasError ? "Audio error" : muted ? "Tap anywhere to unmute" : playing ? "Click to pause" : "Click to play"}
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          zIndex: 9999,
          width: 44,
          height: 44,
          borderRadius: "50%",
          cursor: "grab",
          userSelect: "none",
          WebkitUserSelect: "none",
          /* glassmorphism */
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1.5px solid ${hasError ? "rgba(239,68,68,0.5)" : playing && !muted ? `${color}60` : "rgba(255,255,255,0.14)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform .18s, box-shadow .25s, border-color .25s",
          boxShadow: hasError
            ? "0 0 12px rgba(239,68,68,0.55), 0 4px 16px rgba(0,0,0,0.5)"
            : playing && !muted
              ? `0 0 18px ${color}55, 0 0 6px ${color}30, 0 4px 16px rgba(0,0,0,0.45)`
              : "0 4px 16px rgba(0,0,0,0.4)",
          animation: playing && !muted ? "mpPulse 2s ease infinite" : "none",
        }}
      >
        {/* ── Content ── */}
        {loading && (
          <svg width="18" height="18" viewBox="0 0 18 18" style={{ animation: "mpSpin 0.9s linear infinite", opacity: 0.7 }}>
            <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeDasharray="22 10" />
          </svg>
        )}

        {!loading && hasError && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.9)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        )}

        {/* Waveform bars when playing */}
        {!loading && !hasError && playing && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, height: 20 }}>
            {BAR_HEIGHTS.map((h, i) => (
              <div key={i} style={{
                width: 3,
                height: h,
                borderRadius: 2,
                background: muted ? "rgba(255,255,255,0.35)" : color,
                transformOrigin: "bottom",
                animation: playing && !muted ? `mpWave ${0.6 + i * 0.1}s ease-in-out ${BAR_DELAYS[i]} infinite` : "none",
                transform: playing && !muted ? undefined : "scaleY(0.4)",
                opacity: muted ? 0.45 : 0.9,
              }} />
            ))}
          </div>
        )}

        {/* Music note icon when idle/muted-playing */}
        {!loading && !hasError && (!playing || muted) && (
          <svg
            width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke={muted ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.75)"}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        )}

        {/* Muted dot indicator */}
        {muted && playing && (
          <div style={{
            position: "absolute", top: 2, right: 2,
            width: 8, height: 8, borderRadius: "50%",
            background: "rgba(250,204,21,0.9)",
            boxShadow: "0 0 4px rgba(250,204,21,0.6)",
          }} />
        )}
      </div>
    </>
  );
}



