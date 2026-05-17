import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Settings2,
  ShieldCheck,
  Palette,
  Lock,
  Save,
  Loader2,
  ExternalLink,
  Shield,
  Eye,
  Link2,
  Code2,
  Copy,
  Check,
} from "lucide-react";
import { useGuild } from "@/contexts/GuildContext";
import { fetchConfig, updateConfig } from "./shared";
import type { VerificationConfig } from "./shared";

/* ── Live Preview ───────────────────────────────────────────── */
function VerifyPreview({ config }: { config: VerificationConfig }) {
  const brandColor = config.page_color || "#5865F2";
  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/10" style={{ minHeight: 420 }}>
      {/* Background */}
      <div
        className="absolute inset-0 bg-[#0b0d14]"
        style={config.page_background_url ? {
          backgroundImage: `url(${config.page_background_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        } : undefined}
      />
      {config.page_background_url && <div className="absolute inset-0 bg-black/60" />}

      {/* Card */}
      <div className="relative flex items-center justify-center p-6" style={{ minHeight: 420 }}>
        <div className="w-full max-w-xs rounded-xl bg-[#1a1d2e]/95 backdrop-blur-xl border border-white/10 p-6 text-center shadow-2xl">
          {/* Logo */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl overflow-hidden border border-white/10">
            {config.page_logo_url ? (
              <img src={config.page_logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: `${brandColor}30` }}>
                <Shield className="h-7 w-7" style={{ color: brandColor }} />
              </div>
            )}
          </div>

          <h2 className="text-lg font-bold text-white mb-1">
            {config.page_title || "Verify Your Account"}
          </h2>
          <p className="text-white/50 text-xs mb-5 leading-relaxed">
            {config.page_description || "Please verify your Discord account to gain access."}
          </p>

          {/* Button */}
          <div
            className="inline-flex items-center justify-center gap-1.5 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: brandColor, boxShadow: `0 4px 16px ${brandColor}30` }}
          >
            <ExternalLink className="h-4 w-4" />
            {config.button_text || "Verify with Discord"}
          </div>

          {config.terms_url && (
            <p className="mt-3 text-white/30 text-[10px]">
              By verifying you agree to the <span className="underline">Terms</span>
            </p>
          )}

          <p className="mt-4 text-white/20 text-[10px]">
            {config.page_footer_text || "Secure Verification"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
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

  function handleSaveConfig() {
    if (!configForm) return;
    configMutation.mutate(configForm);
  }

  function update(patch: Partial<VerificationConfig>) {
    if (!configForm) return;
    setConfigForm({ ...configForm, ...patch });
  }

  const verifyUrl = selectedGuildId
    ? `${window.location.origin}/verify/${selectedGuildId}`
    : "";

  function copyUrl() {
    navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            Verification Configuration
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Configure verification and customize the page members see.
          </p>
        </div>
        <Button onClick={handleSaveConfig} disabled={configMutation.isPending} className="gap-1.5">
          {configMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </div>

      {configQuery.isLoading || !configForm ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left: Config form */}
          <div className="space-y-4">

            {/* Verify Link */}
            {verifyUrl && (
              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input value={verifyUrl} readOnly className="text-xs font-mono" />
                    <Button variant="outline" size="icon" className="shrink-0" onClick={copyUrl}>
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" className="shrink-0" asChild>
                      <a href={verifyUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Enable */}
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Enable Verification</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Require members to verify via OAuth2</p>
                  </div>
                  <Switch checked={configForm.enabled} onCheckedChange={v => update({ enabled: v })} />
                </div>
              </CardContent>
            </Card>

            {/* Roles & Channels */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Roles & Channels
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Verified Role ID</Label>
                  <Input value={configForm.verified_role_id} onChange={e => update({ verified_role_id: e.target.value })} placeholder="Role ID" />
                </div>
                <div>
                  <Label className="text-xs">Unverified Role ID</Label>
                  <Input value={configForm.unverified_role_id} onChange={e => update({ unverified_role_id: e.target.value })} placeholder="Role ID (optional)" />
                </div>
                <div>
                  <Label className="text-xs">Verify Channel ID</Label>
                  <Input value={configForm.verify_channel_id} onChange={e => update({ verify_channel_id: e.target.value })} placeholder="Channel ID" />
                </div>
                <div>
                  <Label className="text-xs">Log Channel ID</Label>
                  <Input value={configForm.log_channel_id} onChange={e => update({ log_channel_id: e.target.value })} placeholder="Channel ID" />
                </div>
              </CardContent>
            </Card>

            {/* Branding */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Page Branding
                </CardTitle>
                <CardDescription className="text-xs">Customize how the verification page looks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Page Title</Label>
                  <Input value={configForm.page_title} onChange={e => update({ page_title: e.target.value })} placeholder="Verify Your Account" />
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input value={configForm.page_description} onChange={e => update({ page_description: e.target.value })} placeholder="Please verify your Discord account..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Brand Color</Label>
                    <div className="flex gap-2">
                      <input type="color" value={configForm.page_color || "#5865F2"}
                        onChange={e => update({ page_color: e.target.value })}
                        className="w-10 h-9 rounded border border-input cursor-pointer" />
                      <Input value={configForm.page_color} onChange={e => update({ page_color: e.target.value })} placeholder="#5865F2" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Button Text</Label>
                    <Input value={configForm.button_text} onChange={e => update({ button_text: e.target.value })} placeholder="Verify with Discord" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Logo URL</Label>
                  <Input value={configForm.page_logo_url} onChange={e => update({ page_logo_url: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <Label className="text-xs">Background Image URL</Label>
                  <Input value={configForm.page_background_url} onChange={e => update({ page_background_url: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <Label className="text-xs">Footer Text</Label>
                  <Input value={configForm.page_footer_text ?? ""} onChange={e => update({ page_footer_text: e.target.value })} placeholder="Secure Verification" />
                </div>
                <div>
                  <Label className="text-xs">Success Message</Label>
                  <Input value={configForm.success_message} onChange={e => update({ success_message: e.target.value })} placeholder="You have been verified successfully." />
                </div>
              </CardContent>
            </Card>

            {/* Security */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">CAPTCHA</Label>
                    <p className="text-xs text-muted-foreground">Require CAPTCHA before verification</p>
                  </div>
                  <Switch checked={configForm.captcha_enabled} onCheckedChange={v => update({ captcha_enabled: v })} />
                </div>
                <Separator />
                <div>
                  <Label className="text-xs">Minimum Account Age (days)</Label>
                  <Input type="number" min={0} max={365} value={configForm.min_account_age_days}
                    onChange={e => update({ min_account_age_days: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-muted-foreground mt-1">Set to 0 to disable</p>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Block VPN/Proxy</Label>
                    <p className="text-xs text-muted-foreground">Reject from VPN or proxy connections</p>
                  </div>
                  <Switch checked={configForm.block_vpn} onCheckedChange={v => update({ block_vpn: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Kick on De-auth</Label>
                    <p className="text-xs text-muted-foreground">Kick members who remove authorization</p>
                  </div>
                  <Switch checked={configForm.kick_on_deauth} onCheckedChange={v => update({ kick_on_deauth: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Close Page After Verify</Label>
                    <p className="text-xs text-muted-foreground">Auto-close page on success</p>
                  </div>
                  <Switch checked={configForm.close_page_after_verify} onCheckedChange={v => update({ close_page_after_verify: v })} />
                </div>
              </CardContent>
            </Card>

            {/* Advanced */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Code2 className="h-4 w-4" />
                  Advanced
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Redirect URL (after verify)</Label>
                  <Input value={configForm.redirect_url ?? ""} onChange={e => update({ redirect_url: e.target.value })} placeholder="https://..." />
                  <p className="text-xs text-muted-foreground mt-1">Leave empty to show success message</p>
                </div>
                <div>
                  <Label className="text-xs">Terms of Service URL</Label>
                  <Input value={configForm.terms_url ?? ""} onChange={e => update({ terms_url: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <Label className="text-xs">Custom CSS</Label>
                  <textarea
                    value={configForm.custom_css ?? ""}
                    onChange={e => update({ custom_css: e.target.value })}
                    placeholder="/* Custom styles */"
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </CardContent>
            </Card>
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
      )}
    </div>
  );
}
