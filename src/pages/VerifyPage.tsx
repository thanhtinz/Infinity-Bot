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
  typewriter_effect?: boolean;
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
        console.log("[VerifyPage] appearance config:", {
          bg_effect: data.bg_effect,
          bg_color: data.bg_color,
          text_color: data.text_color,
          btn_color: data.btn_color,
          card_bg_color: data.card_bg_color,
          card_border_color: data.card_border_color,
          typewriter_effect: data.typewriter_effect,
          glow_effect: data.glow_effect,
          tilt_effect: data.tilt_effect,
        });
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
        <div className="relative w-full max-w-md rounded-2xl backdrop-blur-xl border p-8 text-center shadow-2xl"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
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
        <div className="relative w-full max-w-md rounded-2xl backdrop-blur-xl border p-8 text-center shadow-2xl"
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
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

  return (
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
        <div className="absolute inset-0 z-10" style={{
          background: `linear-gradient(45deg, ${btnColor}20, transparent, ${btnColor}10)`,
          animation: "gradientShift 8s ease infinite",
        }} />
      )}

      {config?.custom_css && <style>{config.custom_css}</style>}

      <div
        ref={tiltRef}
        className="relative z-20 w-full max-w-md rounded-2xl backdrop-blur-xl border p-8 text-center shadow-2xl transition-transform duration-200"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      >
        {config?.banner_url && (
          <div className="w-full h-24 rounded-xl overflow-hidden mb-5 -mt-2">
            <img src={config.banner_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}

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

        {config?.server_name && (
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: `${textColor}40` }}>
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
          <p className="text-sm mb-2" style={{ color: `${textColor}60` }}>{config.bio_description}</p>
        )}

        <p className="text-sm mb-6 leading-relaxed" style={{ color: `${textColor}50` }}>
          {config?.page_description || "Please verify your Discord account to gain access to the server."}
        </p>

        {config?.captcha_enabled && config.captcha_type !== "none" && (
          <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium" style={{ color: textColor }}>Human check</p>
              {captchaToken ? <span className="text-xs text-emerald-400">Completed</span> : <span className="text-xs" style={{ color: `${textColor}50` }}>{config.captcha_type}</span>}
            </div>

            {captchaLoading && (
              <div className="flex items-center gap-2 text-sm" style={{ color: `${textColor}60` }}>
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
                    <p className="text-sm" style={{ color: `${textColor}70` }}>{captcha.message}</p>
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
                    <p className="text-sm" style={{ color: `${textColor}70` }}>{captcha.question}</p>
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
                    <p className="text-sm" style={{ color: `${textColor}70` }}>Drag to {captcha.target}%</p>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={sliderValue}
                      onChange={(e) => setSliderValue(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex items-center justify-between text-xs" style={{ color: `${textColor}50` }}>
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
          <p className="mt-4 text-xs" style={{ color: `${textColor}30` }}>
            By verifying you agree to the{" "}
            <a href={config.terms_url} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-60">
              Terms of Service
            </a>
          </p>
        )}

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

      {config?.music_url && <MusicPlayer url={config.music_url} color={btnColor} />}
    </div>
  );
}

function MusicPlayer({ url, color }: { url: string; color: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]   = useState(false);
  const [hovered, setHovered]   = useState(false);
  const [pos, setPos]           = useState({ x: 16, y: window.innerHeight / 2 - 28 });
  const dragging                = useRef(false);
  const dragOffset              = useRef({ dx: 0, dy: 0 });
  const didDrag                 = useRef(false);

  /* ── Audio event sync ── */
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = 0.3;
    const onPlay  = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("play",  onPlay);
    a.addEventListener("pause", onPause);
    return () => { a.removeEventListener("play", onPlay); a.removeEventListener("pause", onPause); };
  }, [url]);

  /* ── Drag handlers (mouse + touch) ── */
  function startDrag(clientX: number, clientY: number) {
    dragging.current = true;
    didDrag.current  = false;
    dragOffset.current = { dx: clientX - pos.x, dy: clientY - pos.y };
    document.body.style.overflow = "hidden"; // prevent page scroll during drag
  }
  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragging.current) return;
      e.preventDefault(); // prevent page scroll while dragging
      const { clientX, clientY } = "touches" in e ? e.touches[0] : e;
      didDrag.current = true;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth  - 56, clientX - dragOffset.current.dx)),
        y: Math.max(0, Math.min(window.innerHeight - 56, clientY - dragOffset.current.dy)),
      });
    }
    function onUp() {
      dragging.current = false;
      document.body.style.overflow = "";
    }
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
  }, [pos.x, pos.y]);

  /* ── Toggle play / pause ── */
  function handleClick() {
    if (didDrag.current) return; // ignore click after drag
    const a = audioRef.current;
    if (!a) return;
    if (!a.paused) {
      a.pause();
    } else {
      a.play().catch(() => {});
    }
  }

  return (
    <>
      <audio ref={audioRef} src={url} loop preload="auto" />
      <style>{`
        @keyframes vSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .v-spin  { animation: vSpin 3s linear infinite; }
        .v-pause { animation: vSpin 3s linear infinite; animation-play-state:paused; }
      `}</style>

      <div
        onMouseDown={e  => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
        onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "fixed", left: pos.x, top: pos.y, zIndex: 50,
          cursor: dragging.current ? "grabbing" : "grab",
          userSelect: "none", WebkitUserSelect: "none",
        }}
      >
        {/* Glow + scale wrapper */}
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          transition: "box-shadow .3s, transform .2s",
          transform: hovered ? "scale(1.12)" : "scale(1)",
          boxShadow: playing
            ? `0 0 22px ${color}80, 0 0 8px ${color}50, 0 4px 14px rgba(0,0,0,0.6)`
            : "0 4px 14px rgba(0,0,0,0.55)",
          position: "relative",
        }}>
          {/* Vinyl disc */}
          <div className={playing ? "v-spin" : "v-pause"} style={{
            width: 56, height: 56, borderRadius: "50%", position: "absolute",
            background: `conic-gradient(
              #111 0deg,#1d1d1d 20deg,#111 40deg,#1a1a1a 60deg,
              #111 80deg,#1d1d1d 100deg,#111 120deg,#1a1a1a 140deg,
              #111 160deg,#1d1d1d 180deg,#111 200deg,#1a1a1a 220deg,
              #111 240deg,#1d1d1d 260deg,#111 280deg,#1a1a1a 300deg,
              #111 320deg,#1d1d1d 340deg,#111 360deg
            )`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {/* Groove rings */}
            {[46,36,26].map(s => (
              <div key={s} style={{ position:"absolute", width:s, height:s, borderRadius:"50%", border:"1px solid rgba(255,255,255,0.07)" }} />
            ))}
            {/* Center label */}
            <div style={{
              width:18, height:18, borderRadius:"50%", backgroundColor:color,
              boxShadow:`0 0 8px ${color}70`, zIndex:2, position:"relative",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:"rgba(0,0,0,0.75)" }} />
            </div>
          </div>

          {/* Hover icon overlay */}
          <div style={{
            position:"absolute", inset:0, borderRadius:"50%",
            display:"flex", alignItems:"center", justifyContent:"center",
            background: hovered ? "rgba(0,0,0,0.38)" : "transparent",
            transition:"background .2s",
          }}>
            {hovered && (playing ? (
              <div style={{ display:"flex", gap:4 }}>
                <div style={{ width:4, height:14, borderRadius:2, background:"rgba(255,255,255,0.92)" }} />
                <div style={{ width:4, height:14, borderRadius:2, background:"rgba(255,255,255,0.92)" }} />
              </div>
            ) : (
              <svg width="13" height="15" viewBox="0 0 13 15" fill="rgba(255,255,255,0.92)" style={{marginLeft:2}}>
                <path d="M0 0 L13 7.5 L0 15 Z" />
              </svg>
            ))}
          </div>
        </div>

        {/* Hint tooltip — only when stopped & not hovered */}
        {!playing && !hovered && (
          <div style={{
            position:"absolute", top:"50%", left:"calc(100% + 8px)",
            transform:"translateY(-50%)", whiteSpace:"nowrap",
            fontSize:10, color:"rgba(255,255,255,0.45)",
            background:"rgba(0,0,0,0.48)", borderRadius:4, padding:"2px 7px",
            pointerEvents:"none",
          }}>🎵 click to play</div>
        )}
      </div>
    </>
  );
}
