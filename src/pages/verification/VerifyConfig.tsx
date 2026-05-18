import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleSelect, MultiRoleSelect } from "@/components/RoleSelect";
import { ChannelSelect } from "@/components/ChannelSelect";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Save, Loader2, ExternalLink, Shield, Eye,
  Link2, Copy, Check, Globe,
  Image, Paintbrush, Palette, Sparkles, Type, Share2,
  KeyRound, Code2,
  Trash2,
  Settings2, Upload, X, Music,
  Plus, XCircle, Search, User, Flag, Mail, Network,
  MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  FaXTwitter, FaGithub, FaTelegram, FaTwitch,
  FaYoutube, FaInstagram, FaTiktok, FaDiscord,
  FaGlobe,
} from "react-icons/fa6";
import type { IconType } from "react-icons";
import { useGuild } from "@/contexts/GuildContext";
import { fetchConfig, updateConfig } from "./shared";
import type { VerificationConfig } from "./shared";
import { PremiumBadge, PremiumGate } from "@/components/ui/premium-gate";
import { useEntitlements } from "@/hooks/useEntitlements";
import { apiFetch } from "@/hooks/useApi";
import { formatDistanceToNow } from "date-fns";

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

const CAPTCHA_TYPES = [
  { value: "none", label: "None", premium: false },
  { value: "button", label: "Button", premium: false },
  { value: "emoji", label: "Emoji", premium: false },
  { value: "math", label: "Math", premium: false },
  { value: "slider", label: "Slider", premium: false },
  { value: "hcaptcha", label: "hCaptcha", premium: true },
  { value: "turnstile", label: "Cloudflare Turnstile", premium: true },
] as const;

const CAPTCHA_DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
] as const;

const SOCIALS: { key: string; label: string; icon: IconType; placeholder: string; color: string }[] = [
  { key: "twitter",   label: "X / Twitter", icon: FaXTwitter,  placeholder: "https://x.com/username",         color: "#e7e9ea" },
  { key: "github",    label: "GitHub",       icon: FaGithub,    placeholder: "https://github.com/username",    color: "#8b949e" },
  { key: "telegram",  label: "Telegram",     icon: FaTelegram,  placeholder: "https://t.me/username",          color: "#26A5E4" },
  { key: "twitch",    label: "Twitch",       icon: FaTwitch,    placeholder: "https://twitch.tv/username",     color: "#9146FF" },
  { key: "youtube",   label: "YouTube",      icon: FaYoutube,   placeholder: "https://youtube.com/@channel",   color: "#FF0000" },
  { key: "instagram", label: "Instagram",    icon: FaInstagram, placeholder: "https://instagram.com/username", color: "#E4405F" },
  { key: "tiktok",    label: "TikTok",       icon: FaTiktok,    placeholder: "https://tiktok.com/@username",   color: "#ffffff" },
  { key: "discord",   label: "Discord",      icon: FaDiscord,   placeholder: "https://discord.gg/invite",      color: "#5865F2" },
  { key: "website",   label: "Website",      icon: FaGlobe,     placeholder: "https://example.com",            color: "#6366f1" },
  { key: "shop",      label: "Shop",         icon: FaGlobe,     placeholder: "https://shop.example.com",       color: "#10b981" },
];

type FirewallRule = {
  id: number;
  rule_type: "block" | "allow";
  target_type: "user_id" | "ip" | "country" | "email_domain" | "asn";
  target_value: string;
  reason: string | null;
  created_by: string | null;
  created_at: string | null;
};
type TargetType = FirewallRule["target_type"];
const TARGET_TYPE_CONFIG: Record<TargetType, { label: string; icon: LucideIcon; placeholder: string }> = {
  user_id: { label: "User ID", icon: User, placeholder: "123456789012345678" },
  ip: { label: "IP Address", icon: Globe, placeholder: "192.168.1.1" },
  country: { label: "Country Code", icon: Flag, placeholder: "VN" },
  email_domain: { label: "Email Domain", icon: Mail, placeholder: "example.com" },
  asn: { label: "ASN", icon: Network, placeholder: "AS13335" },
};

/* ── MediaUpload Component ──────────────────────────── */
function MediaUpload({
  label,
  value,
  onChange,
  accept = "image/*",
  placeholder = "https://example.com/image.png",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accept?: string;
  placeholder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  async function handleFile(file: File) {
    setUploading(true);
    setProgress(20);
    try {
      const fd = new FormData();
      fd.append("file", file);
      setProgress(50);
      const res = await apiFetch("/api/files/upload", { method: "POST", body: fd });
      setProgress(90);
      onChange(res.url);
      setProgress(100);
    } catch (e: unknown) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setTimeout(() => { setUploading(false); setProgress(0); }, 600);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>

      {/* Preview strip */}
      {value && (
        <div className="relative flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          {accept.startsWith("audio") ? (
            <Music className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <img
              src={value}
              alt=""
              className="h-8 w-8 rounded object-cover shrink-0 border border-border"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <span className="flex-1 text-xs text-muted-foreground font-mono truncate">{value}</span>
          <button onClick={() => onChange("")} className="text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Upload progress */}
      {uploading && <Progress value={progress} className="h-1" />}

      {/* Input row */}
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-xs flex-1"
        />
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 px-3"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

/* ── Color Picker ───────────────────────────────────── */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <div className="rounded-lg overflow-hidden border border-border">
        <div className="h-10 w-full" style={{ backgroundColor: value }} />
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50">
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
    <div className="relative w-full rounded-xl overflow-hidden border border-border" style={{ minHeight: 500 }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: c.bg_color || "#0f0f17",
          backgroundImage: c.page_background_url ? `url(${c.page_background_url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      {c.page_background_url && <div className="absolute inset-0 bg-black/50" />}

      <div className="relative z-10 flex flex-col items-center justify-center min-h-[500px] p-8 text-center"
        style={{ fontFamily: c.font_family, color: c.text_color || "#ffffff" }}>

        {c.page_logo_url && (
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl overflow-hidden border border-border">
            <img src={c.page_logo_url} alt="Logo" className="h-full w-full object-cover" />
          </div>
        )}

        <h1 className="text-2xl font-bold mb-2" style={{
          textShadow: c.glow_effect ? `0 0 20px ${c.text_color || "#fff"}` : undefined,
        }}>
          {c.page_title || "Verify Your Account"}
        </h1>

        {c.page_description && (
          <p className="text-sm mb-4 opacity-70">{c.page_description}</p>
        )}

        <button
          className="px-6 py-2.5 rounded-lg font-medium text-sm transition-all"
          style={{
            backgroundColor: c.btn_color || "#5865F2",
            color: "#fff",
            border: `1px solid ${c.btn_border_color || "transparent"}`,
          }}
        >
          {c.button_text || "Verify with Discord"}
        </button>

        {activeSocials.length > 0 && (
          <div className="flex gap-2 mt-4">
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
  );
}

/* ── Main Component ─────────────────────────────────── */
export function VerifyConfig() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();
  const [copied, setCopied] = useState(false);
  const [configForm, setConfigForm] = useState<VerificationConfig | null>(null);
  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [slugInput, setSlugInput] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [fwSearch, setFwSearch] = useState("");
  const [fwFilterType, setFwFilterType] = useState("all");
  const [fwAddOpen, setFwAddOpen] = useState(false);
  const [fwNewRule, setFwNewRule] = useState<{ rule_type: "block" | "allow"; target_type: TargetType; target_value: string; reason: string }>({
    rule_type: "block", target_type: "user_id", target_value: "", reason: "",
  });
  const { hasFeature, isLoading: entLoading } = useEntitlements();

  const configQuery = useQuery({ queryKey: ["verification-config", selectedGuildId], queryFn: fetchConfig, enabled: !!selectedGuildId });

  // Reset configForm when guild changes so stale data isn't shown
  const prevGuildRef = useRef<string | null>(null);
  const domainStatusQuery = useQuery({
    queryKey: ["verification-domain-status", selectedGuildId],
    queryFn: async () => {
      const r = await fetch(`/api/verification/domain-status?guild_id=${selectedGuildId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ domain: string; status: string; cname_target: string | null; railway_configured: boolean; error?: string }>;
    },
    enabled: !!selectedGuildId,
    refetchInterval: false,
  });
  const firewallQuery = useQuery<FirewallRule[]>({
    queryKey: ["firewall-rules", selectedGuildId],
    queryFn: () => apiFetch("/api/firewall/rules").then(r => r.json()),
    enabled: !!selectedGuildId,
  });

  useEffect(() => {
    if (configQuery.data) {
      const guildChanged = prevGuildRef.current !== selectedGuildId;
      if (!configForm || guildChanged) {
        setConfigForm(configQuery.data);
        prevGuildRef.current = selectedGuildId;
      }
    } else if (selectedGuildId !== prevGuildRef.current) {
      // Guild changed, clear stale form while new data loads
      setConfigForm(null);
      prevGuildRef.current = selectedGuildId;
    }
  }, [configQuery.data, selectedGuildId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (configQuery.data?.verify_slug && !slugInput) setSlugInput(configQuery.data.verify_slug); }, [configQuery.data?.verify_slug]);

  const configMutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      toast({ title: "Configuration saved" });
      qc.invalidateQueries({ queryKey: ["verification-config"] });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["verification-domain-status", selectedGuildId] }), 1500);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const fwDeleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/firewall/rules/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Rule deleted" }); qc.invalidateQueries({ queryKey: ["firewall-rules", selectedGuildId] }); },
    onError: (err) => toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" }),
  });
  const fwAddMutation = useMutation({
    mutationFn: () => apiFetch("/api/firewall/rules", { method: "POST", body: JSON.stringify(fwNewRule) }),
    onSuccess: () => {
      toast({ title: "Rule added" });
      qc.invalidateQueries({ queryKey: ["firewall-rules", selectedGuildId] });
      setFwAddOpen(false);
      setFwNewRule({ rule_type: "block", target_type: "user_id", target_value: "", reason: "" });
    },
    onError: (err) => toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" }),
  });

  function update(patch: Partial<VerificationConfig>) {
    if (!configForm) return;
    setConfigForm({ ...configForm, ...patch });
  }

  const slugCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSlugChange(val: string) {
    const s = val.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlugInput(s);
    setSlugStatus("idle");
    if (slugCheckRef.current) clearTimeout(slugCheckRef.current);
    if (!s || s === configForm?.verify_slug) return;
    if (!/^[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]$/.test(s)) { setSlugStatus("invalid"); return; }
    setSlugStatus("checking");
    slugCheckRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/verification/slug/check?slug=${encodeURIComponent(s)}`);
        const data = await res.json() as { available: boolean };
        setSlugStatus(data.available ? "available" : "taken");
      } catch { setSlugStatus("idle"); }
    }, 600);
  }
  function applySlug() {
    if (slugStatus === "available" || (slugInput === configForm?.verify_slug)) {
      update({ verify_slug: slugInput || "" });
      configMutation.mutate({ ...configForm!, verify_slug: slugInput || "" });
    }
  }

  function updateSocial(key: string, value: string) {
    if (!configForm) return;
    setConfigForm({ ...configForm, socials: { ...configForm.socials, [key]: value } });
  }

  const verifyUrl = selectedGuildId
    ? `${window.location.origin}/verify/${configForm?.verify_slug || selectedGuildId}`
    : "";
  function copyUrl() { navigator.clipboard.writeText(verifyUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  const activeSocialCount = configForm ? SOCIALS.filter(s => configForm.socials?.[s.key]).length : 0;
  const filteredRules = (firewallQuery.data || []).filter(r => {
    const matchSearch = !fwSearch || r.target_value.toLowerCase().includes(fwSearch.toLowerCase()) || r.reason?.toLowerCase().includes(fwSearch.toLowerCase());
    const matchType = fwFilterType === "all" || r.target_type === fwFilterType;
    return matchSearch && matchType;
  });

  if (configQuery.isLoading || !configForm) {
    if (configQuery.isError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
          <p className="text-sm">Failed to load configuration.</p>
          <button onClick={() => configQuery.refetch()} className="text-xs underline">Retry</button>
        </div>
      );
    }
    return <div className="space-y-4 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const domainStatus = domainStatusQuery.data;
  const statusMap: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
    verified: { label: "✓ Active", variant: "default" },
    pending: { label: "⏳ Pending DNS", variant: "secondary" },
    not_found: { label: "Not registered", variant: "outline" },
    unknown: { label: "Unknown", variant: "outline" },
    none: { label: "No domain set", variant: "outline" },
  };

  return (
    <div className="space-y-4 p-4 md:p-6">

      {/* ── Action buttons row ── */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-10 gap-2 justify-start"
          onClick={() => {
            if (!hasFeature("custom_domain")) return;
            setDomainDialogOpen(true);
          }}
        >
          <Globe className="h-4 w-4 text-blue-500" />
          <span className="font-medium text-sm">Custom Domain</span>
          {!hasFeature("custom_domain") && !entLoading && <PremiumBadge size="xs" className="ml-auto" />}
          {hasFeature("custom_domain") && domainStatus?.status === "verified" && <Badge variant="secondary" className="ml-auto text-[10px] py-0">Active</Badge>}
        </Button>

        <Button
          variant="outline"
          className="h-10 gap-2 justify-start"
          onClick={() => navigate("/embeds?event=verify_panel")}
        >
          <MessageSquare className="h-4 w-4 text-indigo-500" />
          <span className="font-medium text-sm">Verify Message</span>
        </Button>
      </div>

      {/* ── Verify link bar ── */}
      {verifyUrl && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
          <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input value={verifyUrl} readOnly className="text-xs font-mono border-0 bg-transparent h-7 p-0" />
          <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={copyUrl}>
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          {verifyUrl && (
            <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" asChild>
              <a href={verifyUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
            </Button>
          )}
        </div>
      )}

      {/* ── 6-tab icon bar ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 h-11">
          {[
            { value: "general", icon: Settings2, title: "General" },
            { value: "custom", icon: Paintbrush, title: "Customize" },
            { value: "security", icon: Shield, title: "Security" },
            { value: "firewall", icon: KeyRound, title: "Firewall" },
            { value: "advanced", icon: Code2, title: "Advanced" },
          ].map(({ value, icon: Icon, title }) => (
            <TabsTrigger key={value} value={value} title={title} className="flex flex-col gap-0.5 px-1 py-1.5 text-[10px] h-full">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:block truncate">{title}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ─── GENERAL ─── */}
        <TabsContent value="general" className="space-y-4 pt-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
            <div>
              <p className="font-semibold text-sm">Enable Verification</p>
              <p className="text-xs text-muted-foreground">Require members to verify via OAuth2</p>
            </div>
            <Switch checked={configForm.enabled} onCheckedChange={v => update({ enabled: v })} />
          </div>

          {/* Custom Slug */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Verify Link Slug</p>
              <p className="text-xs text-muted-foreground">Set a custom name for your verify URL instead of the guild ID.</p>
            </div>
            <div className="flex items-center gap-0 rounded-lg border border-input bg-muted/30 overflow-hidden">
              <span className="px-3 text-xs text-muted-foreground whitespace-nowrap bg-muted/50 border-r border-input py-2.5">infinitybot.website/verify/</span>
              <Input
                value={slugInput}
                onChange={e => handleSlugChange(e.target.value)}
                placeholder="myserver"
                className="border-0 rounded-none bg-transparent focus-visible:ring-0 text-sm font-mono"
                maxLength={32}
              />
              <Button
                size="sm"
                variant="ghost"
                className="rounded-none border-l border-input px-3 shrink-0"
                disabled={slugStatus !== "available" && slugInput !== configForm.verify_slug}
                onClick={applySlug}
              >
                {configMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {slugInput && (
              <p className={`text-xs flex items-center gap-1.5 ${
                slugStatus === "available" ? "text-emerald-500" :
                slugStatus === "taken" ? "text-destructive" :
                slugStatus === "invalid" ? "text-amber-500" :
                slugStatus === "checking" ? "text-muted-foreground" :
                slugInput === configForm.verify_slug ? "text-emerald-500" : "text-muted-foreground"
              }`}>
                {slugStatus === "checking" && <Loader2 className="h-3 w-3 animate-spin" />}
                {slugStatus === "available" && "✓ Available"}
                {slugStatus === "taken" && "✗ Already taken"}
                {slugStatus === "invalid" && "Invalid — 3–32 chars, lowercase, no start/end hyphen"}
                {slugStatus === "idle" && slugInput === configForm.verify_slug && "✓ Current slug"}
              </p>
            )}
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">On Verify Action</p>
            <p className="text-xs text-muted-foreground -mt-2">Both settings apply if saved.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Give Role</Label>
                <RoleSelect value={configForm.verified_role_id ?? ""} onChange={val => update({ verified_role_id: val })} placeholder="Verified role" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Remove Role</Label>
                <RoleSelect value={configForm.unverified_role_id ?? ""} onChange={val => update({ unverified_role_id: val })} placeholder="Unverified role" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">NOTE: Roles above the bot or other bot roles will NOT show. Put bot ABOVE your verified role in Discord settings.</p>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channels</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Verify Channel</Label>
                <ChannelSelect value={configForm.verify_channel_id ?? ""} onChange={val => update({ verify_channel_id: val })} placeholder="Select channel" filter="text" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Log Channel</Label>
                <ChannelSelect value={configForm.log_channel_id ?? ""} onChange={val => update({ log_channel_id: val })} placeholder="Select channel" filter="text" />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notify Roles</p>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">On successful verification</Label>
              <MultiRoleSelect value={(configForm.notify_success_role_id ?? "").split(",").filter(Boolean)} onChange={vals => update({ notify_success_role_id: vals.join(",") })} placeholder="Select roles to ping" /></div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">On blocked event</Label>
              <MultiRoleSelect value={(configForm.notify_blocked_role_id ?? "").split(",").filter(Boolean)} onChange={vals => update({ notify_blocked_role_id: vals.join(",") })} placeholder="Select roles to ping" /></div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => configMutation.mutate(configForm)} disabled={configMutation.isPending}>
              {configMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Save
            </Button>
          </div>
        </TabsContent>

        {/* ─── CUSTOM ─── */}
        <TabsContent value="custom" className="pt-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Media */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Image className="h-3.5 w-3.5" />Media</p>
                <MediaUpload label="Profile Image" value={configForm.page_logo_url} onChange={v => update({ page_logo_url: v })} />
                <MediaUpload label="Banner Image" value={configForm.banner_url} onChange={v => update({ banner_url: v })} />
                <MediaUpload label="Background Image" value={configForm.page_background_url} onChange={v => update({ page_background_url: v })} />
                <MediaUpload label="Mouse Cursor" value={configForm.cursor_url} onChange={v => update({ cursor_url: v })} placeholder="Cursor image URL" />
                <MediaUpload label="Background Music" value={configForm.music_url || ""} onChange={v => update({ music_url: v })} accept="audio/*" placeholder="Audio URL (mp3, ogg, wav)" />
              </div>

              {/* Appearance */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Paintbrush className="h-3.5 w-3.5" />Appearance</p>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Font Family</Label>
                  <select value={configForm.font_family} onChange={e => update({ font_family: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    {FONTS.map(f => <option key={f} value={f} className="bg-popover">{f}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Background Effect</Label>
                  <select value={configForm.bg_effect} onChange={e => update({ bg_effect: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    {BG_EFFECTS.map(e => <option key={e.value} value={e.value} className="bg-popover">{e.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Colors */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" />Colors</p>
                <div className="grid grid-cols-2 gap-4">
                  <ColorField label="Background" value={configForm.bg_color} onChange={v => update({ bg_color: v })} />
                  <ColorField label="Text" value={configForm.text_color} onChange={v => update({ text_color: v })} />
                  <ColorField label="Button" value={configForm.btn_color} onChange={v => update({ btn_color: v })} />
                  <ColorField label="Button Border" value={configForm.btn_border_color} onChange={v => update({ btn_border_color: v })} />
                  <ColorField label="Card Background" value={configForm.card_bg_color} onChange={v => update({ card_bg_color: v })} />
                  <ColorField label="Card Border" value={configForm.card_border_color} onChange={v => update({ card_border_color: v })} />
                </div>
              </div>

              {/* Effects */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />Effects</p>
                {[
                  { key: "typewriter_effect" as const, label: "Typewriter text effect", desc: "Animate title with typing effect" },
                  { key: "glow_effect" as const, label: "Glowing text effect", desc: "Add glow shadow to title" },
                  { key: "tilt_effect" as const, label: "Card tilting effect", desc: "3D tilt on mouse hover" },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                    <Switch checked={configForm[key]} onCheckedChange={v => update({ [key]: v })} />
                  </div>
                ))}
              </div>

              {/* Content */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Type className="h-3.5 w-3.5" />Content</p>
                <div><Label className="text-xs text-muted-foreground mb-1.5 block">Page Title</Label><Input value={configForm.page_title} onChange={e => update({ page_title: e.target.value })} placeholder="Verify Your Account" /></div>
                <div><Label className="text-xs text-muted-foreground mb-1.5 block">Description</Label><Input value={configForm.page_description} onChange={e => update({ page_description: e.target.value })} placeholder="Please verify..." /></div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Bio</Label>
                  <textarea value={configForm.bio_description} onChange={e => update({ bio_description: e.target.value })} rows={2}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-muted-foreground mb-1.5 block">Button Text</Label><Input value={configForm.button_text} onChange={e => update({ button_text: e.target.value })} placeholder="Verify with Discord" /></div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Label className="text-xs text-muted-foreground">Footer Text</Label>
                      <PremiumBadge size="xs" />
                    </div>
                    <PremiumGate feature="custom_footer" featureLabel="Custom Footer Text" hasAccess={hasFeature("custom_footer")} isLoading={entLoading} mode="inline">
                      <Input value={configForm.page_footer_text} onChange={e => update({ page_footer_text: e.target.value })} placeholder="Powered by Infinity Bot" />
                    </PremiumGate>
                  </div>
                </div>
                <div><Label className="text-xs text-muted-foreground mb-1.5 block">Success Message</Label><Input value={configForm.success_message} onChange={e => update({ success_message: e.target.value })} placeholder="Verified successfully!" /></div>
              </div>

              {/* Socials */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Share2 className="h-3.5 w-3.5" />Socials <span className="normal-case font-normal">({activeSocialCount}/{SOCIALS.length} active)</span></p>
                <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border bg-muted/20">
                  {SOCIALS.map(s => {
                    const active = !!configForm.socials?.[s.key];
                    const Icon = s.icon;
                    return (
                      <button key={s.key} onClick={() => active ? updateSocial(s.key, "") : updateSocial(s.key, s.placeholder)}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${active ? "bg-primary/15 border border-primary/20" : "bg-muted/30 border border-transparent hover:bg-muted/50"}`}>
                        <Icon className="w-4 h-4" style={{ color: active ? s.color : undefined }} />
                      </button>
                    );
                  })}
                </div>
                {SOCIALS.filter(s => configForm.socials?.[s.key]).map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      <Icon className="w-5 h-5 shrink-0" style={{ color: s.color }} />
                      <div className="flex-1"><Label className="text-xs font-medium mb-1 block">{s.label}</Label>
                        <Input value={configForm.socials?.[s.key] || ""} onChange={e => updateSocial(s.key, e.target.value)} placeholder={s.placeholder} className="text-xs" /></div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={() => configMutation.mutate(configForm)} disabled={configMutation.isPending}>
                  {configMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}Save
                </Button>
              </div>
            </div>

            {/* Right: Live Preview */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Eye className="h-4 w-4" /><span className="font-medium">Live Preview</span></div>
              <div className="sticky top-4"><VerifyPreview config={configForm} /></div>
            </div>
          </div>
        </TabsContent>

        {/* ─── SECURITY ─── */}
        <TabsContent value="security" className="space-y-4 pt-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Requirements</p>
            <div>
              <div className="flex items-center justify-between mb-2">
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
                className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CAPTCHA</p>
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium">Require CAPTCHA</p><p className="text-xs text-muted-foreground">Members must complete a challenge</p></div>
              <Switch checked={configForm.captcha_enabled} onCheckedChange={v => update({ captcha_enabled: v, captcha_type: v ? (configForm.captcha_type === "none" ? "button" : configForm.captcha_type) : "none" })} />
            </div>
            {configForm.captcha_enabled && (
              <div className="space-y-3 pl-3 border-l-2 border-primary/30">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <PremiumBadge size="sm" /><span className="text-[10px] text-muted-foreground">(hCaptcha, Turnstile)</span>
                  </div>
                  <select value={configForm.captcha_type} onChange={e => { const val = e.target.value as VerificationConfig["captcha_type"]; if ((val === "hcaptcha" || val === "turnstile") && !hasFeature("advanced_captcha")) return; update({ captcha_type: val }); }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    {CAPTCHA_TYPES.filter(t => t.value !== "none").map(t => (
                      <option key={t.value} value={t.value} className="bg-popover" disabled={t.premium && !hasFeature("advanced_captcha")}>
                        {t.label}{t.premium && !hasFeature("advanced_captcha") ? " 🔒" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Difficulty</Label>
                  <select value={configForm.captcha_difficulty} onChange={e => update({ captcha_difficulty: e.target.value as VerificationConfig["captcha_difficulty"] })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                    {CAPTCHA_DIFFICULTIES.map(d => <option key={d.value} value={d.value} className="bg-popover">{d.label}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Protection</p>
              <PremiumBadge size="xs" />
            </div>
            <PremiumGate feature="verification_protection" featureLabel="Verification Protection" hasAccess={hasFeature("verification_protection")} isLoading={entLoading}>
            {[
              { key: "block_vpn" as const, label: "Block VPN networks", premiumKey: "vpn_block" },
              { key: "block_mobile" as const, label: "Block mobile/cellular networks (LTE, 5G, 6G)", premiumKey: "vpn_block" },
              { key: "block_scammers" as const, label: "Block known scammers", premiumKey: null },
              { key: "deny_alt_role" as const, label: "Don't give role to alt accounts", premiumKey: "alt_detection" },
              { key: "auto_ban_alts" as const, label: "Auto-ban alt accounts on verify", premiumKey: "alt_detection" },
              { key: "kick_on_deauth" as const, label: "Kick when user de-authorizes bot", premiumKey: "kick_unauthorized" },
              { key: "close_page_after_verify" as const, label: "Close page after successful verify", premiumKey: null },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <p className="text-sm font-medium">{label}</p>
                <Switch checked={configForm[key]} onCheckedChange={v => update({ [key]: v })} />
              </div>
            ))}
            {configForm.block_vpn && (
              <div className="space-y-3 pl-3 border-l-2 border-blue-500/40 mt-2">
                <div>
                  <Label className="text-xs mb-1.5 block">VPN Detection Provider</Label>
                  <select value={configForm.vpn_api_provider || "proxycheck"} onChange={e => update({ vpn_api_provider: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    <option value="proxycheck">proxycheck.io</option>
                    <option value="ipqualityscore">IPQualityScore</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">API Key</Label>
                  <Input type="password" value={configForm.vpn_api_key || ""} onChange={e => update({ vpn_api_key: e.target.value })} placeholder="Enter API key..." />
                </div>
              </div>
            )}
            </PremiumGate>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Privacy & Permissions</p>
            {[
              { key: "no_save_ip" as const, label: "Don't save IP addresses", premiumKey: null },
              { key: "guild_join_enabled" as const, label: "Enable \"Join servers for you\" permission", premiumKey: "view_discord_data" },
              { key: "force_all_permissions" as const, label: "Force members to accept all permissions", premiumKey: "view_discord_data" },
            ].map(({ key, label, premiumKey }) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{label}</p>
                  {premiumKey && !hasFeature(premiumKey) && <PremiumBadge size="xs" />}
                </div>
                <PremiumGate feature={premiumKey ?? ""} hasAccess={!premiumKey || hasFeature(premiumKey)} isLoading={entLoading} mode="inline">
                  <Switch checked={configForm[key]} onCheckedChange={v => update({ [key]: v })} />
                </PremiumGate>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => configMutation.mutate(configForm)} disabled={configMutation.isPending}>
              {configMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}Save
            </Button>
          </div>
        </TabsContent>

        {/* ─── FIREWALL ─── */}
        <TabsContent value="firewall" className="space-y-4 pt-4">
          {/* Verify passwords */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" />Password-Protected Links</p>
            <p className="text-xs text-muted-foreground">Create password-protected verification links. Users need the correct password to verify.</p>
            {(configForm.verify_passwords || []).map((pw, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input value={pw.label} placeholder="Label" onChange={e => { const arr = [...(configForm.verify_passwords || [])]; arr[idx] = { ...arr[idx], label: e.target.value }; update({ verify_passwords: arr }); }} className="flex-1 text-xs" />
                <Input value={pw.password} placeholder="Password" onChange={e => { const arr = [...(configForm.verify_passwords || [])]; arr[idx] = { ...arr[idx], password: e.target.value }; update({ verify_passwords: arr }); }} className="flex-1 text-xs" />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => update({ verify_passwords: (configForm.verify_passwords || []).filter((_, i) => i !== idx) })}>
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={() => update({ verify_passwords: [...(configForm.verify_passwords || []), { password: "", label: "" }] })}>
              <Plus className="w-4 h-4 mr-1.5" />Add Password
            </Button>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => configMutation.mutate(configForm)} disabled={configMutation.isPending}>
                {configMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}Save
              </Button>
            </div>
          </div>

          {/* Block rules */}
          <PremiumGate feature="advanced_blocklist" featureLabel="Advanced Blocklist (IP, Country, ASN, Email)" hasAccess={hasFeature("advanced_blocklist")} isLoading={entLoading}>
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">Block / Allow Rules <PremiumBadge size="xs" /></p>
                <p className="text-xs text-muted-foreground">Block or allow specific users, IPs, countries, email domains, or ASNs</p>
              </div>
              <Button size="sm" onClick={() => setFwAddOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" />Add Rule</Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search rules..." value={fwSearch} onChange={e => setFwSearch(e.target.value)} className="pl-8" />
              </div>
              <UISelect value={fwFilterType} onValueChange={setFwFilterType}>
                <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Filter type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.entries(TARGET_TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </UISelect>
            </div>

            {firewallQuery.isLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : filteredRules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No rules found</div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRules.map(rule => {
                      const cfg = TARGET_TYPE_CONFIG[rule.target_type];
                      const Icon = cfg.icon;
                      return (
                        <TableRow key={rule.id}>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{cfg.label}</div>
                          </TableCell>
                          <TableCell className="text-xs font-mono max-w-[160px] truncate">{rule.target_value}</TableCell>
                          <TableCell>
                            <Badge variant={rule.rule_type === "block" ? "destructive" : "default"} className="text-[10px]">
                              {rule.rule_type === "block" ? "Block" : "Allow"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {rule.created_at ? formatDistanceToNow(new Date(rule.created_at), { addSuffix: true }) : "—"}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => fwDeleteMutation.mutate(rule.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          </PremiumGate>
        </TabsContent>

        {/* ─── ADVANCED ─── */}
        <TabsContent value="advanced" className="space-y-4 pt-4">
          {/* Misc advanced */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Misc</p>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">Pull Cooldown (hours)</Label>
              <Input type="number" min={0} max={720} value={configForm.pull_cooldown_hours ?? 10} onChange={e => update({ pull_cooldown_hours: parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-muted-foreground mt-1">0 = no cooldown</p></div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Label className="text-xs text-muted-foreground">Gateway Server ID</Label>
                <PremiumBadge size="xs" />
              </div>
              <PremiumGate feature="multi_server_pull" featureLabel="Multi-Server Pulling" hasAccess={hasFeature("multi_server_pull")} isLoading={entLoading} mode="inline">
                <Input value={configForm.gateway_guild_id} onChange={e => update({ gateway_guild_id: e.target.value })} placeholder="Add members to extra server on verify" />
              </PremiumGate>
            </div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">Redirect URL (after verify)</Label>
              <Input value={configForm.redirect_url} onChange={e => update({ redirect_url: e.target.value })} placeholder="https://..." /></div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">Terms of Service URL</Label>
              <Input value={configForm.terms_url} onChange={e => update({ terms_url: e.target.value })} placeholder="https://..." /></div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Label className="text-xs text-muted-foreground">Custom CSS</Label>
                <PremiumBadge size="xs" />
              </div>
              <PremiumGate feature="custom_css_feature" featureLabel="Custom CSS" hasAccess={hasFeature("custom_css_feature")} isLoading={entLoading} mode="inline">
                <textarea value={configForm.custom_css} onChange={e => update({ custom_css: e.target.value })} placeholder="/* Custom styles */" rows={4}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </PremiumGate>
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => configMutation.mutate(configForm)} disabled={configMutation.isPending}>
              {configMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}Save
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Custom Domain Dialog ── */}
      <Dialog open={domainDialogOpen} onOpenChange={setDomainDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-blue-500" />Custom Domain</DialogTitle>
            <DialogDescription>Point a CNAME record to host your verify page on your own domain.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Domain</Label>
              <Input value={configForm.custom_domain || ""} onChange={e => update({ custom_domain: e.target.value })} placeholder="verify.yourdomain.com" />
            </div>
            {domainStatus?.cname_target && (
              <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-2">
                <p className="text-xs font-medium">Point a CNAME record to:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-primary bg-muted/40 rounded px-2 py-1.5 font-mono truncate">{domainStatus.cname_target}</code>
                  <button onClick={() => navigator.clipboard.writeText(domainStatus.cname_target!)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Copy className="w-3.5 h-3.5" /></button>
                </div>
                {configForm.custom_domain && (() => {
                  const s = domainStatus.status;
                  const info = statusMap[s ?? "unknown"] ?? statusMap.unknown;
                  return (
                    <div className="flex items-center justify-between">
                      <Badge variant={info.variant} className="text-[10px]">{info.label}</Badge>
                      <button onClick={() => qc.invalidateQueries({ queryKey: ["verification-domain-status", selectedGuildId] })} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                        {domainStatusQuery.isFetching ? "Checking…" : "Check DNS"}
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDomainDialogOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => { configMutation.mutate(configForm); setDomainDialogOpen(false); }}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Firewall Rule Dialog ── */}
      <Dialog open={fwAddOpen} onOpenChange={setFwAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Firewall Rule</DialogTitle>
            <DialogDescription>Block or allow a user, IP, country, email domain, or ASN.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Action</Label>
                <UISelect value={fwNewRule.rule_type} onValueChange={v => setFwNewRule(p => ({ ...p, rule_type: v as "block" | "allow" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="block">Block</SelectItem><SelectItem value="allow">Allow</SelectItem></SelectContent>
                </UISelect>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Target Type</Label>
                <UISelect value={fwNewRule.target_type} onValueChange={v => setFwNewRule(p => ({ ...p, target_type: v as TargetType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TARGET_TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </UISelect>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Value</Label>
              <Input value={fwNewRule.target_value} onChange={e => setFwNewRule(p => ({ ...p, target_value: e.target.value }))} placeholder={TARGET_TYPE_CONFIG[fwNewRule.target_type].placeholder} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Reason (optional)</Label>
              <Input value={fwNewRule.reason} onChange={e => setFwNewRule(p => ({ ...p, reason: e.target.value }))} placeholder="Why this rule?" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setFwAddOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => fwAddMutation.mutate()} disabled={!fwNewRule.target_value || fwAddMutation.isPending}>
                {fwAddMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}Add Rule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
