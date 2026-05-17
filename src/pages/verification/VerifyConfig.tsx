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
} from "lucide-react";
import { fetchConfig, updateConfig } from "./shared";
import type { VerificationConfig } from "./shared";

export function VerifyConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();

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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings2 className="h-6 w-6" />
          Verification Configuration
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Configure how members verify their accounts and customize the verification page.
        </p>
      </div>

      {configQuery.isLoading || !configForm ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Enable toggle */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Enable Verification</Label>
                  <p className="text-sm text-muted-foreground">
                    Require members to verify before accessing the server
                  </p>
                </div>
                <Switch
                  checked={configForm.enabled}
                  onCheckedChange={(v) => setConfigForm({ ...configForm, enabled: v })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Role & Channel Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Roles & Channels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Verified Role ID</Label>
                  <Input
                    placeholder="e.g. 1234567890"
                    value={configForm.verified_role_id}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setConfigForm({ ...configForm, verified_role_id: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Role assigned after verification</p>
                </div>
                <div className="space-y-2">
                  <Label>Unverified Role ID</Label>
                  <Input
                    placeholder="e.g. 1234567890"
                    value={configForm.unverified_role_id}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setConfigForm({ ...configForm, unverified_role_id: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Role assigned before verification</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Verify Channel ID</Label>
                  <Input
                    placeholder="e.g. 1234567890"
                    value={configForm.verify_channel_id}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setConfigForm({ ...configForm, verify_channel_id: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Log Channel ID</Label>
                  <Input
                    placeholder="e.g. 1234567890"
                    value={configForm.log_channel_id}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setConfigForm({ ...configForm, log_channel_id: e.target.value })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Branding */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Verification Page Branding
              </CardTitle>
              <CardDescription>Customize the look and feel of the verification page</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Page Title</Label>
                  <Input
                    value={configForm.page_title}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setConfigForm({ ...configForm, page_title: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Button Text</Label>
                  <Input
                    value={configForm.button_text}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setConfigForm({ ...configForm, button_text: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Page Description</Label>
                <Input
                  value={configForm.page_description}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setConfigForm({ ...configForm, page_description: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Success Message</Label>
                <Input
                  value={configForm.success_message}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setConfigForm({ ...configForm, success_message: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Brand Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={configForm.page_color}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setConfigForm({ ...configForm, page_color: e.target.value })
                      }
                      className="h-9 w-12 rounded border cursor-pointer"
                    />
                    <Input
                      value={configForm.page_color}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setConfigForm({ ...configForm, page_color: e.target.value })
                      }
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input
                    placeholder="https://..."
                    value={configForm.page_logo_url}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setConfigForm({ ...configForm, page_logo_url: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Background Image URL</Label>
                <Input
                  placeholder="https://..."
                  value={configForm.page_background_url}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setConfigForm({ ...configForm, page_background_url: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">CAPTCHA Verification</Label>
                  <p className="text-xs text-muted-foreground">Require CAPTCHA before Discord OAuth</p>
                </div>
                <Switch
                  checked={configForm.captcha_enabled}
                  onCheckedChange={(v) => setConfigForm({ ...configForm, captcha_enabled: v })}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Minimum Account Age (days)</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={configForm.min_account_age_days}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setConfigForm({ ...configForm, min_account_age_days: Number(e.target.value) })
                  }
                  className="max-w-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  Discord accounts younger than this will be rejected. Set to 0 to disable.
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Block VPN/Proxy</Label>
                  <p className="text-xs text-muted-foreground">Reject verification from VPN or proxy connections</p>
                </div>
                <Switch
                  checked={configForm.block_vpn}
                  onCheckedChange={(v) => setConfigForm({ ...configForm, block_vpn: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Kick on De-auth</Label>
                  <p className="text-xs text-muted-foreground">Kick members who remove their Discord authorization</p>
                </div>
                <Switch
                  checked={configForm.kick_on_deauth}
                  onCheckedChange={(v) => setConfigForm({ ...configForm, kick_on_deauth: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Close Page After Verify</Label>
                  <p className="text-xs text-muted-foreground">Automatically close the verification page after successful verification</p>
                </div>
                <Switch
                  checked={configForm.close_page_after_verify}
                  onCheckedChange={(v) => setConfigForm({ ...configForm, close_page_after_verify: v })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveConfig}
              disabled={configMutation.isPending}
              className="gap-1.5"
            >
              {configMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Configuration
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
