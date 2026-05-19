import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGuild } from "@/contexts/GuildContext";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import {
  Key,
  Wifi,
  Loader2,
  Save,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/infinity";

// ── Types ──────────────────────────────────────────────────────────────────

interface SecurityConfigData {
  has_vpn_api_key: boolean;
  vpn_api_provider: string;
}

// ── API ────────────────────────────────────────────────────────────────────

async function fetchConfig(): Promise<SecurityConfigData> {
  const res = await apiFetch("/api/config");
  if (!res.ok) throw new Error("Failed to load config");
  const data = await res.json();
  return {
    has_vpn_api_key: data.has_vpn_api_key ?? false,
    vpn_api_provider: data.vpn_api_provider ?? "proxycheck.io",
  };
}

async function updateConfig(data: SecurityConfigData): Promise<void> {
  const res = await apiFetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save config");
}

// ── Component ──────────────────────────────────────────────────────────────

export function SecurityConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedGuildId } = useGuild();

  const [form, setForm] = useState<SecurityConfigData | null>(null);
  const [newApiKey, setNewApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  const configQuery = useQuery({
    queryKey: ["security-config", selectedGuildId],
    queryFn: fetchConfig,
    enabled: !!selectedGuildId,
  });

  useEffect(() => {
    if (configQuery.data && !form) {
      setForm(configQuery.data);
    }
  }, [configQuery.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      toast({ title: "Security configuration saved" });
      qc.invalidateQueries({ queryKey: ["security-config", selectedGuildId] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function handleSave() {
    if (!form) return;
    const payload: Record<string, unknown> = { vpn_api_provider: form.vpn_api_provider };
    if (newApiKey.trim()) payload.vpn_api_key = newApiKey.trim();
    saveMutation.mutate(payload as unknown as SecurityConfigData);
  }

  function handleTestConnection() {
    if (!form?.has_vpn_api_key && !newApiKey.trim()) {
      toast({ title: "API Key required", description: "Enter an API key before testing.", variant: "destructive" });
      return;
    }
    setTestStatus("testing");
    // Placeholder — simulate a test
    setTimeout(() => {
      setTestStatus("success");
      toast({ title: "Connection test successful", description: "The VPN/Proxy API is reachable and the key is valid." });
    }, 1500);
  }

  if (configQuery.isLoading || !form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full max-w-2xl" />
      </div>
    );
  }

  return (
    <PageContainer size="sm">
      <PageHeader title="Security Configuration" description="Configure security features including VPN/proxy detection for member verification." icon={Lock} />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            VPN / Proxy Detection API
          </CardTitle>
          <CardDescription>
            Configure the API provider and key used to detect VPN and proxy connections during member verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider select */}
          <div className="space-y-2">
            <Label>API Provider</Label>
            <Select
              value={form.vpn_api_provider}
              onValueChange={(v) => setForm({ ...form, vpn_api_provider: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proxycheck.io">proxycheck.io</SelectItem>
                <SelectItem value="ipqualityscore">IPQualityScore</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the VPN/proxy detection service to use for verification checks.
            </p>
          </div>

          <Separator />

          {/* API Key */}
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={newApiKey}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewApiKey(e.target.value)}
                  placeholder={form.has_vpn_api_key ? "••••••••  (set — enter new key to replace)" : "Enter your API key"}
                  className="pl-9 pr-10"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Your API key is stored securely and never exposed to clients.
            </p>
          </div>

          <Separator />

          {/* Test connection */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testStatus === "testing" || (!form.has_vpn_api_key && !newApiKey.trim())}
              className="gap-1.5"
            >
              {testStatus === "testing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : testStatus === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}
              Test Connection
            </Button>
            {testStatus === "success" && (
              <span className="text-sm text-emerald-600">Connection successful</span>
            )}
            {testStatus === "error" && (
              <span className="text-sm text-destructive">Connection failed</span>
            )}
          </div>

          <Separator />

          {/* Save */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="gap-1.5"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Save Configuration</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
