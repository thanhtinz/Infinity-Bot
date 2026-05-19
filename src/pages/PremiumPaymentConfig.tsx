import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChannelSelect } from "@/components/ChannelSelect";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmojiTextarea } from "@/components/EmojiInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { PageContainer, PageHeader } from "@/components/infinity";
import {
  Save,
  Loader2,
  ChevronDown,
  Settings,
  Building2,
  CreditCard,
  Eye,
  EyeOff,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface PremiumConfig {
  currency: string;
  currency_symbol: string;
  payment_methods: string[];
  paypal_client_id?: string;
  paypal_client_secret?: string;
  paypal_mode?: string;
  manual_bank_name?: string;
  manual_account_holder?: string;
  manual_account_number?: string;
  manual_qr_image_id?: string;
  premium_payment_instructions?: string;
  premium_default_renewal_days: number;
  premium_renewal_channel_id?: string;
}

interface FormState {
  currency: string;
  currency_symbol: string;
  premium_default_renewal_days: number;
  premium_renewal_channel_id: string;
  // PayPal
  paypal_client_id: string;
  paypal_client_secret: string;
  paypal_mode: string;
  paypal_enabled: boolean;
  // Manual bank transfer
  manual_bank_name: string;
  manual_account_holder: string;
  manual_account_number: string;
  premium_payment_instructions: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: "VND", symbol: "₫", label: "VND — Vietnamese Dong" },
  { code: "USD", symbol: "$", label: "USD — US Dollar" },
  { code: "EUR", symbol: "€", label: "EUR — Euro" },
];

const CURRENCY_MAP = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.symbol])
);

// ── API ────────────────────────────────────────────────────────────────────

async function fetchConfig(): Promise<PremiumConfig> {
  const res = await apiFetch("/api/premium/config");
  if (!res.ok) throw new Error("Failed to load premium config");
  return res.json();
}

async function saveConfig(payload: Record<string, unknown>): Promise<void> {
  const res = await apiFetch("/api/premium/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save premium config");
}

// ── PayPal Secret Input ────────────────────────────────────────────────────

function PayPalSecretInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id="paypal-client-secret"
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="EXxx..."
        className="pr-10"
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function PremiumPaymentConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
    paypal: true,
    manual: false,
  });

  const configQuery = useQuery({
    queryKey: ["premium-config"],
    queryFn: fetchConfig,
  });

  useEffect(() => {
    if (configQuery.data && !form) {
      const d = configQuery.data;
      setForm({
        currency: d.currency || "USD",
        currency_symbol: d.currency_symbol || CURRENCY_MAP[d.currency] || "$",
        premium_default_renewal_days: d.premium_default_renewal_days || 30,
        premium_renewal_channel_id: d.premium_renewal_channel_id ?? "",
        paypal_client_id: d.paypal_client_id ?? "",
        paypal_client_secret: d.paypal_client_secret ?? "",
        paypal_mode: d.paypal_mode ?? "live",
        paypal_enabled: (d.payment_methods ?? []).includes("paypal"),
        manual_bank_name: d.manual_bank_name ?? "",
        manual_account_holder: d.manual_account_holder ?? "",
        manual_account_number: d.manual_account_number ?? "",
        premium_payment_instructions: d.premium_payment_instructions ?? "",
      });
      const hasMethods = d.payment_methods ?? [];
      setOpenSections((prev) => ({
        ...prev,
        paypal: hasMethods.includes("paypal"),
        manual: !!d.manual_bank_name,
      }));
    }
  }, [configQuery.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    []
  );

  const toggleSection = (key: string, open: boolean) => {
    setOpenSections((prev) => ({ ...prev, [key]: open }));
  };

  const handleCurrencyChange = (code: string) => {
    if (!form) return;
    updateField("currency", code);
    updateField("currency_symbol", CURRENCY_MAP[code] ?? "");
  };

  const saveMutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: () => {
      toast({ title: "Premium config saved" });
      qc.invalidateQueries({ queryKey: ["premium-config"] });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!form) return;
    const payment_methods: string[] = [];
    if (form.paypal_enabled) payment_methods.push("paypal");
    if (form.manual_bank_name) payment_methods.push("manual");
    saveMutation.mutate({
      currency: form.currency,
      currency_symbol: form.currency_symbol,
      premium_default_renewal_days: form.premium_default_renewal_days,
      premium_renewal_channel_id: form.premium_renewal_channel_id || null,
      payment_methods,
      paypal_client_id: form.paypal_client_id || null,
      paypal_client_secret: form.paypal_client_secret || null,
      paypal_mode: form.paypal_mode,
      manual_bank_name: form.manual_bank_name,
      manual_account_holder: form.manual_account_holder,
      manual_account_number: form.manual_account_number,
      premium_payment_instructions: form.premium_payment_instructions,
    });
  };

  // ── Loading ────────────────────────────────────────────────────────────

  if (configQuery.isLoading || !form) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <PageContainer size="sm">
      <PageHeader title="Premium Payment Config" description="Configure payment methods and renewal settings for Premium." icon={CreditCard} />

      {/* ── Section 1: General ─────────────────────────────────────────── */}
      <Collapsible
        open={openSections.general}
        onOpenChange={(open) => toggleSection("general", open)}
      >
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-3 text-left w-full"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Settings className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">General Settings</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Currency, renewal days, reminder channel
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                    openSections.general && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="premium-currency">Currency</Label>
                  <Select
                    value={form.currency}
                    onValueChange={handleCurrencyChange}
                  >
                    <SelectTrigger id="premium-currency">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="premium-currency-symbol">Symbol</Label>
                  <Input
                    id="premium-currency-symbol"
                    value={form.currency_symbol}
                    onChange={(e) =>
                      updateField("currency_symbol", e.target.value)
                    }
                    placeholder="$"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="premium-renewal-days">
                    Default renewal days
                  </Label>
                  <Input
                    id="premium-renewal-days"
                    type="number"
                    min={1}
                    value={form.premium_default_renewal_days}
                    onChange={(e) =>
                      updateField(
                        "premium_default_renewal_days",
                        Number(e.target.value) || 30
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="premium-renewal-channel">
                    Renewal reminder channel
                  </Label>
                  <ChannelSelect
                    value={form.premium_renewal_channel_id ?? ""}
                    onChange={(val) =>
                      updateField("premium_renewal_channel_id", val)
                    }
                    placeholder="Select channel"
                    filter="text"
                  />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ── Section 2: PayPal ───────────────────────────────────────────── */}
      <Collapsible
        open={openSections.paypal}
        onOpenChange={(open) => toggleSection("paypal", open)}
      >
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-3 text-left w-full"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">PayPal (Auto)</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automated payment via PayPal REST API
                  </p>
                </div>
                <div className="flex items-center gap-2 mr-2" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={form.paypal_enabled}
                    onCheckedChange={(v) => updateField("paypal_enabled", v)}
                  />
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                    openSections.paypal && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <Separator />
              {!form.paypal_enabled && (
                <p className="text-sm text-muted-foreground">
                  Enable PayPal above to configure credentials.
                </p>
              )}
              {form.paypal_enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="paypal-client-id">Client ID</Label>
                    <Input
                      id="paypal-client-id"
                      value={form.paypal_client_id}
                      onChange={(e) =>
                        updateField("paypal_client_id", e.target.value)
                      }
                      placeholder="AXxx..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paypal-client-secret">Client Secret</Label>
                    <PayPalSecretInput
                      value={form.paypal_client_secret}
                      onChange={(v) => updateField("paypal_client_secret", v)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paypal-mode">Mode</Label>
                    <Select
                      value={form.paypal_mode}
                      onValueChange={(v) => updateField("paypal_mode", v)}
                    >
                      <SelectTrigger id="paypal-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="live">Live</SelectItem>
                        <SelectItem value="sandbox">Sandbox (testing)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ── Section 3: Manual / Bank Transfer ───────────────────────────── */}
      <Collapsible
        open={openSections.manual}
        onOpenChange={(open) => toggleSection("manual", open)}
      >
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-3 text-left w-full"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
                  <Building2 className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">Bank Transfer (Manual)</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manual bank transfer payment details
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                    openSections.manual && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="premium-bank-name">Bank name</Label>
                  <Input
                    id="premium-bank-name"
                    value={form.manual_bank_name}
                    onChange={(e) =>
                      updateField("manual_bank_name", e.target.value)
                    }
                    placeholder="e.g. Chase, Wells Fargo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="premium-account-holder">
                    Account holder
                  </Label>
                  <Input
                    id="premium-account-holder"
                    value={form.manual_account_holder}
                    onChange={(e) =>
                      updateField("manual_account_holder", e.target.value)
                    }
                    placeholder="JOHN DOE"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="premium-account-number">Account number</Label>
                <Input
                  id="premium-account-number"
                  value={form.manual_account_number}
                  onChange={(e) =>
                    updateField("manual_account_number", e.target.value)
                  }
                  placeholder="1234567890"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="premium-payment-instructions">
                  Payment instructions
                </Label>
                <EmojiTextarea
                  id="premium-payment-instructions"
                  value={form.premium_payment_instructions}
                  onChange={(e) =>
                    updateField("premium_payment_instructions", e.target.value)
                  }
                  placeholder="Transfer with note: PREMIUM [Guild ID]..."
                  rows={4}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ── Save Button ─────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
          ) : (
            <Save className="h-4 w-4 sm:mr-2" />
          )}
          <span className="hidden sm:inline">Save config</span>
        </Button>
      </div>
    </PageContainer>
  );
}
