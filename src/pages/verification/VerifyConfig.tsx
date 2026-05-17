import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Settings2, Save, Loader2, ExternalLink, Shield, Eye,
  Link2, Copy, Check, ChevronDown,
  Image, Paintbrush, Palette, Sparkles, Type, Share2,
  Lock, Code2, KeyRound, XCircle, Plus,
  Twitter, Github, Send, Tv, Youtube, Instagram, Globe, ShoppingCart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGuild } from "@/contexts/GuildContext";
import { fetchConfig, updateConfig } from "./shared";
import type { VerificationConfig } from "./shared";

/* ── Constants ──────────────────────────────────────── */
const FONTS = [
  "Inter", "Poppins", "Roboto", "Montserrat", "Raleway", "Nunito",
  "Syne", "JetBrains Mono", "Fira Code", "Space Grotesk",
];

const BG_EFFECTS = [
  { value: "none", label: "None" },
  { value: "stars", label: "Shooting Stars" },
  { value: "particles", label: "Floating Particles" },
  { value: "gradient", label: "Animated Gradient" },
  { value: "rain", label: "Digital Rain" },
];

const SOCIALS: { key: string; label: string; icon: LucideIcon; placeholder: string; color: string }[] = [
  { key: "twitter", label: "Twitter", icon: Twitter, placeholder: "https://twitter.com/username", color: "#1DA1F2" },
  { key: "github", label: "GitHub", icon: Github, placeholder: "https://github.com/username", color: "#8b949e" },
  { key: "telegram", label: "Telegram", icon: Send, placeholder: "https://t.me/username", color: "#26A5E4" },
  { key: "twitch", label: "Twitch", icon: Tv, placeholder: "https://twitch.tv/username", color: "#9146FF" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@channel", color: "#FF0000" },
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/username", color: "#E4405F" },
  { key: "tiktok", label: "TikTok", icon: Share2, placeholder: "https://tiktok.com/@username", color: "#ffffff" },
  { key: "shop", label: "Shop", icon: ShoppingCart, placeholder: "https://shop.example.com", color: "#10b981" },
  { key: "website", label: "Website", icon: Globe, placeholder: "https://example.com", color: "#6366f1" },
];

/* ── Collapsible Section ────────────────────────────── */
function Section({ title, icon: Icon, children, defaultOpen = false }: {
  title: string; icon: LucideIcon; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f1118] overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm text-white">{title}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Color Picker ───────────────────────────────────── */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <div className="rounded-lg overflow-hidden border border-white/10">
        <div className="h-12 w-full" style={{ backgroundColor: value }} />
        <div className="flex items-center gap-2 px-3 py-2 bg-[#0a0c10]">
          <input type="color" value={value} onChange={e => onChange(e.target.value)}
            className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent" />
          <Input value={value} onChange={e => onChange(e.target.value)}
            className="h-7 text-xs font-mono border-0 bg-transparent px-0" />
        </div>
      </div>
    </div>
  );
}

/* ── Live Preview ───────────────────────────────────── */
function VerifyPreview({ config: c }: { config: VerificationConfig }) {
  const activeSocials = SOCIALS.filter(s => c.socials?.[s.key]);
  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/10" style={{ minHeight: 500 }}>
      {/* Background */}
      <div className="absolute inset-0" style={{ backgroundColor: c.bg_color || "#0b0d14" }}>
        {c.page_background_url && (
          <img src={c.page_background_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {c.page_background_url && <div className="absolute inset-0 bg-black/50" />}
        {/* BG effect hint */}
        {c.bg_effect !== "none" && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-white/10 text-[10px] text-white/40">
            {BG_EFFECTS.find(e => e.value === c.bg_effect)?.label}
          </div>
        )}
      </div>

      {/* Card */}
      <div className="relative flex items-center justify-center p-6" style={{ minHeight: 500, fontFamily: c.font_family }}>
        <div
          className="w-full max-w-xs rounded-xl backdrop-blur-xl p-6 text-center shadow-2xl"
          style={{
            backgroundColor: `${c.card_bg_color || "#1a1d2e"}e6`,
            borderColor: c.card_border_color || "#1a1d2e",
            borderWidth: 1,
            borderStyle: "solid",
          }}
        >
          {/* Banner */}
          {c.banner_url && (
            <div className="w-full h-20 rounded-lg overflow-hidden mb-4 -mt-1">
              <img src={c.banner_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Logo */}
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl overflow-hidden border border-white/10">
            {c.page_logo_url ? (
              <img src={c.page_logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: `${c.btn_color}30` }}>
                <Shield className="h-8 w-8" style={{ color: c.btn_color }} />
              </div>
            )}
          </div>

          <h2
            className={`text-lg font-bold mb-1 ${c.glow_effect ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" : ""}`}
            style={{ color: c.text_color }}
          >
            {c.page_title || "Verify Your Account"}
          </h2>

          {c.bio_description && (
            <p className="text-xs mb-2 opacity-60" style={{ color: c.text_color }}>
              {c.bio_description}
            </p>
          )}

          <p className="text-xs mb-5 leading-relaxed opacity-50" style={{ color: c.text_color }}>
            {c.page_description || "Please verify your Discord account to gain access."}
          </p>

          {/* Button */}
          <div
            className="inline-flex items-center justify-center gap-1.5 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all"
            style={{
              backgroundColor: c.btn_color,
              borderColor: c.btn_border_color,
              borderWidth: 1,
              borderStyle: "solid",
              boxShadow: `0 4px 16px ${c.btn_color}30`,
            }}
          >
            <ExternalLink className="h-4 w-4" />
            {c.button_text || "Verify with Discord"}
          </div>

          {/* Socials */}
          {activeSocials.length > 0 && (
            <div className="flex justify-center gap-3 mt-4">
              {activeSocials.map(s => {
                const Icon = s.icon;
                return (
                  <a key={s.key} href={c.socials[s.key]} target="_blank" rel="noopener noreferrer"
                    className="w-7 h-7 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors">
                    <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                  </a>
                );
              })}
            </div>
          )}

          {c.terms_url && (
            <p className="mt-3 text-[10px] opacity-30" style={{ color: c.text_color }}>
              By verifying you agree to the <span className="underline">Terms</span>
            </p>
          )}

          <p className="mt-4 text-[10px] opacity-20" style={{ color: c.text_color }}>
            {c.page_footer_text || "Powered by Infinity Bot"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────── */
export function VerifyConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();
  const [copied, setCopied] = useState(false);
  const [configForm, setConfigForm] = useState<VerificationConfig | null>(null);

  const configQuery = useQuery({
    queryKey: ["verification-config"],
    queryFn: fetchConfig,
  });

  useEffect(() => {
    if (configQuery.data && !configForm) {
      setConfigForm(configQuery.data);
    }
  }, [configQuery.data, configForm]);

  const configMutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      toast({ title: "Configuration saved" });
      qc.invalidateQueries({ queryKey: ["verification-config"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function update(patch: Partial<VerificationConfig>) {
    if (!configForm) return;
    setConfigForm({ ...configForm, ...patch });
  }

  function updateSocial(key: string, value: string) {
    if (!configForm) return;
    setConfigForm({ ...configForm, socials: { ...configForm.socials, [key]: value } });
  }

  const verifyUrl = selectedGuildId ? `${window.location.origin}/verify/${selectedGuildId}` : "";
  function copyUrl() {
    navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeSocialCount = configForm ? SOCIALS.filter(s => configForm.socials?.[s.key]).length : 0;

  if (configQuery.isLoading || !configForm) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Customize</h1>
            <p className="text-sm text-muted-foreground">Customize your verification page</p>
          </div>
        </div>
        <div className="flex gap-2">
          {verifyUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={verifyUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-1.5" />Preview
              </a>
            </Button>
          )}
          <Button size="sm" onClick={() => configMutation.mutate(configForm)} disabled={configMutation.isPending}>
            {configMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save
          </Button>
        </div>
      </div>

      {/* Verify Link */}
      {verifyUrl && (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0f1118] px-4 py-3">
          <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input value={verifyUrl} readOnly className="text-xs font-mono border-0 bg-transparent h-7" />
          <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={copyUrl}>
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      {/* Enable toggle */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0f1118] px-5 py-4">
        <div>
          <p className="font-semibold text-sm">Enable Verification</p>
          <p className="text-xs text-muted-foreground">Require members to verify via OAuth2</p>
        </div>
        <Switch checked={configForm.enabled} onCheckedChange={v => update({ enabled: v })} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: Customize sections */}
        <div className="space-y-3">
          {/* Media */}
          <Section title="Media" icon={Image} defaultOpen>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Profile Image</Label>
                <Input value={configForm.page_logo_url} onChange={e => update({ page_logo_url: e.target.value })}
                  placeholder="Image URL" className="text-xs" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Banner Image</Label>
                <Input value={configForm.banner_url} onChange={e => update({ banner_url: e.target.value })}
                  placeholder="Image URL" className="text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Background Image</Label>
                <Input value={configForm.page_background_url} onChange={e => update({ page_background_url: e.target.value })}
                  placeholder="Image URL" className="text-xs" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Mouse Cursor</Label>
                <Input value={configForm.cursor_url} onChange={e => update({ cursor_url: e.target.value })}
                  placeholder="Cursor image URL" className="text-xs" />
              </div>
            </div>
          </Section>

          {/* Appearance */}
          <Section title="Appearance" icon={Paintbrush}>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Font Family</Label>
              <select
                value={configForm.font_family}
                onChange={e => update({ font_family: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {FONTS.map(f => <option key={f} value={f} className="bg-[#0a0c10]">{f}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Background Effects</Label>
              <select
                value={configForm.bg_effect}
                onChange={e => update({ bg_effect: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {BG_EFFECTS.map(e => <option key={e.value} value={e.value} className="bg-[#0a0c10]">{e.label}</option>)}
              </select>
            </div>
          </Section>

          {/* Colors */}
          <Section title="Colors" icon={Palette}>
            <div className="grid grid-cols-2 gap-4">
              <ColorField label="Background Color" value={configForm.bg_color} onChange={v => update({ bg_color: v })} />
              <ColorField label="Text Color" value={configForm.text_color} onChange={v => update({ text_color: v })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ColorField label="Button Color" value={configForm.btn_color} onChange={v => update({ btn_color: v })} />
              <ColorField label="Button Border" value={configForm.btn_border_color} onChange={v => update({ btn_border_color: v })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ColorField label="Card Background" value={configForm.card_bg_color} onChange={v => update({ card_bg_color: v })} />
              <ColorField label="Card Border" value={configForm.card_border_color} onChange={v => update({ card_border_color: v })} />
            </div>
          </Section>

          {/* Effects & Options */}
          <Section title="Effects & Options" icon={Sparkles}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Text Effects</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Typewriter text effect</p>
                <p className="text-xs text-muted-foreground">Animate title text with typing effect</p>
              </div>
              <Switch checked={configForm.typewriter_effect} onCheckedChange={v => update({ typewriter_effect: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Glowing text effect</p>
                <p className="text-xs text-muted-foreground">Add glow shadow to title</p>
              </div>
              <Switch checked={configForm.glow_effect} onCheckedChange={v => update({ glow_effect: v })} />
            </div>
            <Separator className="opacity-10" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Animation</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Card tilting effect</p>
                <p className="text-xs text-muted-foreground">3D tilt on mouse hover</p>
              </div>
              <Switch checked={configForm.tilt_effect} onCheckedChange={v => update({ tilt_effect: v })} />
            </div>
          </Section>

          {/* Content */}
          <Section title="Content" icon={Type}>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Page Title</Label>
              <Input value={configForm.page_title} onChange={e => update({ page_title: e.target.value })} placeholder="Verify Your Account" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Description</Label>
              <Input value={configForm.page_description} onChange={e => update({ page_description: e.target.value })}
                placeholder="Please verify your Discord account..." />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Bio Description</Label>
              <textarea
                value={configForm.bio_description}
                onChange={e => update({ bio_description: e.target.value })}
                placeholder="Short bio shown below the title"
                rows={2}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Button Text</Label>
                <Input value={configForm.button_text} onChange={e => update({ button_text: e.target.value })} placeholder="Verify with Discord" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Footer Text</Label>
                <Input value={configForm.page_footer_text} onChange={e => update({ page_footer_text: e.target.value })} placeholder="Powered by Infinity Bot" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Success Message</Label>
              <Input value={configForm.success_message} onChange={e => update({ success_message: e.target.value })}
                placeholder="You have been verified successfully!" />
            </div>
          </Section>

          {/* Socials */}
          <Section title="Socials" icon={Share2}>
            <p className="text-xs text-muted-foreground">{activeSocialCount} of {SOCIALS.length} active</p>
            <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-white/10 bg-white/[0.02]">
              {SOCIALS.map(s => {
                const active = !!configForm.socials?.[s.key];
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => {
                      if (active) updateSocial(s.key, "");
                      else updateSocial(s.key, s.placeholder);
                    }}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                      active ? "bg-white/15 border border-white/20" : "bg-white/5 border border-transparent hover:bg-white/10"
                    }`}
                  >
                    <Icon className="w-4 h-4" style={{ color: active ? s.color : "#6b7280" }} />
                  </button>
                );
              })}
            </div>
            {SOCIALS.filter(s => configForm.socials?.[s.key]).map(s => {
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <Icon className="w-5 h-5 shrink-0" style={{ color: s.color }} />
                  <div className="flex-1">
                    <Label className="text-xs font-medium mb-1 block">{s.label}</Label>
                    <Input
                      value={configForm.socials?.[s.key] || ""}
                      onChange={e => updateSocial(s.key, e.target.value)}
                      placeholder={s.placeholder}
                      className="text-xs"
                    />
                  </div>
                </div>
              );
            })}
          </Section>

          {/* Security */}
          <Section title="Security" icon={Lock}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Account Requirements</p>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm font-medium">Minimum account age</Label>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min={0} max={365} value={configForm.min_account_age_days}
                    onChange={e => update({ min_account_age_days: parseInt(e.target.value) || 0 })}
                    className="w-16 h-7 text-xs text-center" />
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
              </div>
              <input type="range" min={0} max={365} value={configForm.min_account_age_days}
                onChange={e => update({ min_account_age_days: parseInt(e.target.value) })}
                className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-indigo-500" />
              <p className="text-xs text-muted-foreground text-right mt-1">
                {configForm.min_account_age_days >= 30
                  ? `${Math.floor(configForm.min_account_age_days / 30)} month${Math.floor(configForm.min_account_age_days / 30) > 1 ? "s" : ""}`
                  : `${configForm.min_account_age_days} days`}
              </p>
            </div>

            <Separator className="opacity-10" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">User Experience</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Require CAPTCHA to verify</p>
                <p className="text-xs text-muted-foreground">Members must complete a captcha</p>
              </div>
              <Switch checked={configForm.captcha_enabled} onCheckedChange={v => update({ captcha_enabled: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Close page when complete</p>
                <p className="text-xs text-muted-foreground">Auto-close after successful verification</p>
              </div>
              <Switch checked={configForm.close_page_after_verify} onCheckedChange={v => update({ close_page_after_verify: v })} />
            </div>

            <Separator className="opacity-10" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Protection</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Block VPN networks</p>
              <Switch checked={configForm.block_vpn} onCheckedChange={v => update({ block_vpn: v })} />
            </div>
            {configForm.block_vpn && (
              <div className="space-y-3 pl-2 border-l-2 border-blue-500/30 ml-1">
                <div className="space-y-1.5">
                  <Label className="text-xs">VPN Detection Provider</Label>
                  <select
                    value={configForm.vpn_api_provider || "proxycheck"}
                    onChange={e => update({ vpn_api_provider: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                  >
                    <option value="proxycheck">proxycheck.io</option>
                    <option value="ipqualityscore">IPQualityScore</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">API Key</Label>
                  <Input
                    type="password"
                    value={configForm.vpn_api_key || ""}
                    onChange={e => update({ vpn_api_key: e.target.value })}
                    placeholder="Enter your API key..."
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {configForm.vpn_api_provider === "ipqualityscore"
                      ? "Get a free key at ipqualityscore.com"
                      : "Get a free key at proxycheck.io"}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Block mobile/wireless networks</p>
              <Switch checked={configForm.block_mobile} onCheckedChange={v => update({ block_mobile: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Remove role from unauthorized members</p>
                <p className="text-xs text-muted-foreground">Kick when user de-authorizes the bot</p>
              </div>
              <Switch checked={configForm.kick_on_deauth} onCheckedChange={v => update({ kick_on_deauth: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Block scammers from verification</p>
                <p className="text-xs text-muted-foreground">Block known scammer accounts</p>
              </div>
              <Switch checked={configForm.block_scammers} onCheckedChange={v => update({ block_scammers: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{"Don't give role to alts"}</p>
                <p className="text-xs text-muted-foreground">Detected alt accounts won't get verified role</p>
              </div>
              <Switch checked={configForm.deny_alt_role} onCheckedChange={v => update({ deny_alt_role: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Automatically ban alt accounts</p>
                <p className="text-xs text-muted-foreground">Ban detected alts on verification</p>
              </div>
              <Switch checked={configForm.auto_ban_alts} onCheckedChange={v => update({ auto_ban_alts: v })} />
            </div>

            <Separator className="opacity-10" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Privacy</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{"Don't save IP address"}</p>
                <p className="text-xs text-muted-foreground">IP addresses will not be stored</p>
              </div>
              <Switch checked={configForm.no_save_ip} onCheckedChange={v => update({ no_save_ip: v })} />
            </div>

            <Separator className="opacity-10" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Permissions</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{"Enable \"Join servers for you\" permission"}</p>
                <p className="text-xs text-muted-foreground">Allow bot to add members to guilds</p>
              </div>
              <Switch checked={configForm.guild_join_enabled} onCheckedChange={v => update({ guild_join_enabled: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Force members to accept all permissions</p>
                <p className="text-xs text-muted-foreground">Users cannot uncheck OAuth scopes</p>
              </div>
              <Switch checked={configForm.force_all_permissions} onCheckedChange={v => update({ force_all_permissions: v })} />
            </div>
          </Section>

          {/* Firewall — Passwords */}
          <Section title="Firewall" icon={KeyRound}>
            <p className="text-xs text-muted-foreground mb-2">
              Create password-protected verification links. Users will need the correct password to verify.
            </p>
            {(configForm.verify_passwords || []).map((pw, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input value={pw.label} placeholder="Label"
                  onChange={e => {
                    const arr = [...(configForm.verify_passwords || [])];
                    arr[idx] = { ...arr[idx], label: e.target.value };
                    update({ verify_passwords: arr });
                  }} className="flex-1 text-xs" />
                <Input value={pw.password} placeholder="Password"
                  onChange={e => {
                    const arr = [...(configForm.verify_passwords || [])];
                    arr[idx] = { ...arr[idx], password: e.target.value };
                    update({ verify_passwords: arr });
                  }} className="flex-1 text-xs" />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-red-400 hover:text-red-300"
                  onClick={() => {
                    const arr = (configForm.verify_passwords || []).filter((_, i) => i !== idx);
                    update({ verify_passwords: arr });
                  }}>
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full"
              onClick={() => update({ verify_passwords: [...(configForm.verify_passwords || []), { password: "", label: "" }] })}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Password
            </Button>
          </Section>

          {/* Roles & Channels */}
          <Section title="Roles & Channels" icon={Shield}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Verified Role ID</Label>
                <Input value={configForm.verified_role_id} onChange={e => update({ verified_role_id: e.target.value })} placeholder="Role ID" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Unverified Role ID</Label>
                <Input value={configForm.unverified_role_id} onChange={e => update({ unverified_role_id: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Verify Channel ID</Label>
                <Input value={configForm.verify_channel_id} onChange={e => update({ verify_channel_id: e.target.value })} placeholder="Channel ID" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Log Channel ID</Label>
                <Input value={configForm.log_channel_id} onChange={e => update({ log_channel_id: e.target.value })} placeholder="Channel ID" />
              </div>
            </div>
            <Separator className="opacity-10" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Notify Roles</p>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Notify role for successful verifications</Label>
              <Input value={configForm.notify_success_role_id} onChange={e => update({ notify_success_role_id: e.target.value })}
                placeholder="Role ID — pinged when member verifies" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Notify role for blocked events</Label>
              <Input value={configForm.notify_blocked_role_id} onChange={e => update({ notify_blocked_role_id: e.target.value })}
                placeholder="Role ID — pinged when member is blocked" />
            </div>
          </Section>

          {/* Extra / Advanced */}
          <Section title="Advanced" icon={Code2}>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Gateway Server ID</Label>
              <Input value={configForm.gateway_guild_id} onChange={e => update({ gateway_guild_id: e.target.value })}
                placeholder="Add members to an extra server on verify" />
              <p className="text-xs text-muted-foreground mt-1">Optional — members will also be added to this server</p>
            </div>
            <Separator className="opacity-10" />
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Redirect URL (after verify)</Label>
              <Input value={configForm.redirect_url} onChange={e => update({ redirect_url: e.target.value })} placeholder="https://..." />
              <p className="text-xs text-muted-foreground mt-1">Leave empty to show success message</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Terms of Service URL</Label>
              <Input value={configForm.terms_url} onChange={e => update({ terms_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Custom CSS</Label>
              <textarea
                value={configForm.custom_css}
                onChange={e => update({ custom_css: e.target.value })}
                placeholder="/* Custom styles */"
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </Section>
        </div>

        {/* Right: Live Preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span className="font-medium">Live Preview</span>
          </div>
          <div className="sticky top-4">
            <VerifyPreview config={configForm} />
          </div>
        </div>
      </div>
    </div>
  );
}
