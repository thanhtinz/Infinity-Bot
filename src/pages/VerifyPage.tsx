import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { apiFetch } from "@/hooks/useApi";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  ExternalLink,
} from "lucide-react";

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
}

// ── API ────────────────────────────────────────────────────────────────────

async function fetchVerifyConfig(guildId: string): Promise<VerifyConfig> {
  const res = await apiFetch(`/api/verify/${guildId}/config`);
  if (!res.ok) throw new Error("Failed to load verification config");
  return res.json();
}

// ── Component ──────────────────────────────────────────────────────────────

export function VerifyPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [searchParams] = useSearchParams();

  const [config, setConfig] = useState<VerifyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check URL params for success/error states
  const isSuccess = searchParams.get("success") === "true";
  const urlError = searchParams.get("error");

  useEffect(() => {
    if (!guildId) {
      setError("Invalid verification link.");
      setLoading(false);
      return;
    }

    fetchVerifyConfig(guildId)
      .then((data) => {
        setConfig(data);
        setError(null);
      })
      .catch(() => {
        setError("Unable to load verification page. The link may be invalid or expired.");
      })
      .finally(() => setLoading(false));
  }, [guildId]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0d14]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-white/60" />
          <p className="text-white/50 text-sm">Loading verification page...</p>
        </div>
      </div>
    );
  }

  // ── Error state (config load failed) ──
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

  const brandColor = config?.page_color || "#5865F2";
  const bgImage = config?.page_background_url;

  // ── Success state ──
  if (isSuccess) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[#0b0d14] p-4"
        style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative w-full max-w-md rounded-2xl bg-[#1a1d2e]/95 backdrop-blur-xl border border-white/10 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${brandColor}20` }}>
            <CheckCircle2 className="h-8 w-8" style={{ color: brandColor }} />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Verified!</h1>
          <p className="text-white/60 text-sm">
            {config?.success_message || "You have been verified successfully. You can now close this page."}
          </p>
        </div>
      </div>
    );
  }

  // ── Error state from OAuth ──
  if (urlError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[#0b0d14] p-4"
        style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative w-full max-w-md rounded-2xl bg-[#1a1d2e]/95 backdrop-blur-xl border border-white/10 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Verification Failed</h1>
          <p className="text-white/60 text-sm">
            {urlError === "blacklisted"
              ? "Your account has been blacklisted and cannot be verified."
              : urlError === "vpn_detected"
              ? "VPN or proxy detected. Please disable it and try again."
              : urlError === "account_too_new"
              ? "Your Discord account is too new to verify."
              : urlError === "captcha_failed"
              ? "CAPTCHA verification failed. Please try again."
              : `An error occurred: ${urlError}`}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: brandColor }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Main verification page ──
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#0b0d14] p-4"
      style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      {bgImage && <div className="absolute inset-0 bg-black/60" />}

      <div className="relative w-full max-w-md rounded-2xl bg-[#1a1d2e]/95 backdrop-blur-xl border border-white/10 p-8 text-center shadow-2xl">
        {/* Server icon / Logo */}
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl overflow-hidden border-2 border-white/10 shadow-lg">
          {config?.page_logo_url || config?.server_icon ? (
            <img
              src={config.page_logo_url || config?.server_icon}
              alt="Server"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${brandColor}30` }}
            >
              <Shield className="h-10 w-10" style={{ color: brandColor }} />
            </div>
          )}
        </div>

        {/* Server name */}
        {config?.server_name && (
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-1">
            {config.server_name}
          </p>
        )}

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-2">
          {config?.page_title || "Verify Your Account"}
        </h1>

        {/* Description */}
        <p className="text-white/50 text-sm mb-8 leading-relaxed">
          {config?.page_description || "Please verify your Discord account to gain access to the server."}
        </p>

        {/* Verify button */}
        <a
          href={`/api/verify/${guildId}/start`}
          className="inline-flex items-center justify-center gap-2 w-full rounded-xl px-6 py-3.5 text-base font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] shadow-lg"
          style={{
            backgroundColor: brandColor,
            boxShadow: `0 8px 24px ${brandColor}30`,
          }}
        >
          <ExternalLink className="h-5 w-5" />
          {config?.button_text || "Verify with Discord"}
        </a>

        {/* Footer */}
        <p className="mt-6 text-white/25 text-xs">
          Powered by VaultCord Security
        </p>
      </div>
    </div>
  );
}
