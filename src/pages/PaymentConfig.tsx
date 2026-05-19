import { useState, useEffect, useCallback } from "react";
import type { ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import {
  CreditCard,
  Globe,
  Coins,
  HandCoins,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  ChevronDown,
  Upload,
  X,
  Zap,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface PaymentConfigData {
  currency: string;
  currency_symbol: string;
  payment_methods: string[];
  payos_client_id?: string;
  has_payos_api_key: boolean;
  has_payos_checksum_key: boolean;
  has_paypal_client_id: boolean;
  has_paypal_client_secret: boolean;
  paypal_mode: string;
  has_crypto_api_key: boolean;
  crypto_provider: string;
  manual_qr_image_id?: string;
  manual_bank_name?: string;
  manual_account_holder?: string;
  manual_account_number?: string;
  manual_instructions?: string;
}

interface FormState {
  currency: string;
  currency_symbol: string;
  payos_enabled: boolean;
  payos_client_id: string;
  payos_api_key: string;
  payos_checksum_key: string;
  paypal_enabled: boolean;
  paypal_client_id: string;
  paypal_client_secret: string;
  paypal_mode: string;
  crypto_enabled: boolean;
  crypto_api_key: string;
  crypto_provider: string;
  manual_enabled: boolean;
  manual_qr_image_id: string;
  manual_bank_name: string;
  manual_account_holder: string;
  manual_account_number: string;
  manual_instructions: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: "VND", symbol: "₫", label: "VND — Vietnamese Dong" },
  { code: "USD", symbol: "$", label: "USD — US Dollar" },
  { code: "EUR", symbol: "€", label: "EUR — Euro" },
  { code: "GBP", symbol: "£", label: "GBP — British Pound" },
  { code: "JPY", symbol: "¥", label: "JPY — Japanese Yen" },
  { code: "KRW", symbol: "₩", label: "KRW — South Korean Won" },
  { code: "THB", symbol: "฿", label: "THB — Thai Baht" },
  { code: "custom", symbol: "", label: "Custom" },
];

const CURRENCY_MAP = Object.fromEntries(
  CURRENCIES.filter((c) => c.code !== "custom").map((c) => [c.code, c.symbol])
);

// No-decimal currencies
const NO_DECIMAL_CURRENCIES = new Set(["VND", "JPY", "KRW"]);

function formatPreview(currency: string, symbol: string): string {
  const noDecimal = NO_DECIMAL_CURRENCIES.has(currency);
  if (noDecimal) {
    return `${symbol}${(299000).toLocaleString("vi-VN")}`;
  }
  return `${symbol}29.99`;
}

// ── API ────────────────────────────────────────────────────────────────────

async function fetchConfig(): Promise<PaymentConfigData> {
  const res = await apiFetch("/api/config");
  if (!res.ok) throw new Error("Failed to load config");
  return res.json();
}

async function saveConfig(payload: Record<string, unknown>): Promise<void> {
  const res = await apiFetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save config");
}

async function uploadQRImage(file: File): Promise<{ id: string; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await apiFetch("/api/files/upload", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error("Failed to upload image");
  return res.json();
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusIcon({ configured }: { configured: boolean | null }) {
  if (configured === null) return null;
  if (configured)
    return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
}

function SecretInput({
  value,
  onChange,
  hasExisting,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  hasExisting: boolean;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          hasExisting && !value ? "••••••••  (configured)" : placeholder
        }
        className="pr-9"
        autoComplete="new-password"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
        onClick={() => setVisible(!visible)}
      >
        {visible ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </Button>
      {hasExisting && !value && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Already configured
        </p>
      )}
    </div>
  );
}

// ── TestConnectionButton ───────────────────────────────────────────────────

function TestConnectionButton({ endpoint, label }: { endpoint: string; label: string }) {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await apiFetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast({ title: data.message || `${label} connection successful` });
      } else {
        toast({ title: data.detail || `${label} test failed`, variant: "destructive" });
      }
    } catch {
      toast({ title: "Connection error", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" disabled={testing} onClick={handleTest}>
      {testing ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Zap className="mr-1.5 h-3.5 w-3.5" />
      )}
      {testing ? "Testing..." : label}
    </Button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function PaymentConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [uploadingQR, setUploadingQR] = useState(false);
  const [savingCard, setSavingCard] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: ["payment-config"],
    queryFn: fetchConfig,
  });

  useEffect(() => {
    if (configQuery.data && !form) {
      const d = configQuery.data;
      const methods = d.payment_methods ?? [];
      setForm({
        currency: d.currency || "USD",
        currency_symbol: d.currency_symbol || CURRENCY_MAP[d.currency] || "$",
        payos_enabled: methods.includes("payos"),
        payos_client_id: d.payos_client_id ?? "",
        payos_api_key: "",
        payos_checksum_key: "",
        paypal_enabled: methods.includes("paypal"),
        paypal_client_id: "",
        paypal_client_secret: "",
        paypal_mode: d.paypal_mode || "sandbox",
        crypto_enabled: methods.includes("crypto"),
        crypto_api_key: "",
        crypto_provider: d.crypto_provider || "nowpayments",
        manual_enabled: methods.includes("manual"),
        manual_qr_image_id: d.manual_qr_image_id ?? "",
        manual_bank_name: d.manual_bank_name ?? "",
        manual_account_holder: d.manual_account_holder ?? "",
        manual_account_number: d.manual_account_number ?? "",
        manual_instructions: d.manual_instructions ?? "",
      });
      if (d.manual_qr_image_id) {
        setQrPreviewUrl(`/api/files/${d.manual_qr_image_id}`);
      }
      // Open sections for enabled methods
      const open: Record<string, boolean> = {};
      if (methods.includes("payos")) open.payos = true;
      if (methods.includes("paypal")) open.paypal = true;
      if (methods.includes("crypto")) open.crypto = true;
      if (methods.includes("manual")) open.manual = true;
      setOpenSections(open);
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
    if (code === "custom") {
      updateField("currency", "custom");
      updateField("currency_symbol", form.currency_symbol || "");
    } else {
      updateField("currency", code);
      updateField("currency_symbol", CURRENCY_MAP[code] ?? "");
    }
  };

  const handleQRUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQR(true);
    try {
      const result = await uploadQRImage(file);
      updateField("manual_qr_image_id", result.id);
      setQrPreviewUrl(`/api/files/${result.id}`);
      toast({ title: "QR image uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploadingQR(false);
    }
  };

  const handleRemoveQR = () => {
    updateField("manual_qr_image_id", "");
    setQrPreviewUrl(null);
  };

  const buildMethods = (f: FormState) => {
    const methods: string[] = [];
    if (f.payos_enabled) methods.push("payos");
    if (f.paypal_enabled) methods.push("paypal");
    if (f.crypto_enabled) methods.push("crypto");
    if (f.manual_enabled) methods.push("manual");
    return methods;
  };

  const saveCard = async (cardId: string, payload: Record<string, unknown>) => {
    setSavingCard(cardId);
    try {
      await saveConfig(payload);
      toast({ title: "Saved" });
      qc.invalidateQueries({ queryKey: ["payment-config"] });
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["currency-config"] });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSavingCard(null);
    }
  };

  const handleSaveCurrency = () => {
    if (!form) return;
    saveCard("currency", {
      currency: form.currency,
      currency_symbol: form.currency_symbol,
    });
  };

  const handleSavePayOS = () => {
    if (!form) return;
    const payload: Record<string, unknown> = {
      payment_methods: buildMethods(form),
    };
    if (form.payos_client_id) payload.payos_client_id = form.payos_client_id;
    if (form.payos_api_key) payload.payos_api_key = form.payos_api_key;
    if (form.payos_checksum_key) payload.payos_checksum_key = form.payos_checksum_key;
    saveCard("payos", payload);
  };

  const handleSavePayPal = () => {
    if (!form) return;
    const payload: Record<string, unknown> = {
      payment_methods: buildMethods(form),
      paypal_mode: form.paypal_mode,
    };
    if (form.paypal_client_id) payload.paypal_client_id = form.paypal_client_id;
    if (form.paypal_client_secret) payload.paypal_client_secret = form.paypal_client_secret;
    saveCard("paypal", payload);
  };

  const handleSaveCrypto = () => {
    if (!form) return;
    const payload: Record<string, unknown> = {
      payment_methods: buildMethods(form),
      crypto_provider: form.crypto_provider,
    };
    if (form.crypto_api_key) payload.crypto_api_key = form.crypto_api_key;
    saveCard("crypto", payload);
  };

  const handleSaveManual = () => {
    if (!form) return;
    saveCard("manual", {
      payment_methods: buildMethods(form),
      manual_qr_image_id: form.manual_qr_image_id,
      manual_bank_name: form.manual_bank_name,
      manual_account_holder: form.manual_account_holder,
      manual_account_number: form.manual_account_number,
      manual_instructions: form.manual_instructions,
    });
  };

  // ── Loading ────────────────────────────────────────────────────────────

  if (configQuery.isLoading || !form) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        {[1, 2, 3].map((i) => (
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

  // ── Status helpers ─────────────────────────────────────────────────────

  const payosConfigured =
    (configQuery.data?.has_payos_api_key &&
    configQuery.data?.has_payos_checksum_key) ?? null;
  const paypalConfigured =
    (configQuery.data?.has_paypal_client_id &&
    configQuery.data?.has_paypal_client_secret) ?? null;
  const cryptoConfigured = configQuery.data?.has_crypto_api_key ?? false;

  const previewSymbol = form.currency_symbol || "?";
  const previewPrice = formatPreview(form.currency, previewSymbol);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Payment Configuration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure currency and payment methods for your shop.
        </p>
      </div>

      {/* ── Section 1: Currency Settings ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Currency Settings</CardTitle>
          <CardDescription>
            Set the default currency and symbol for product prices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={form.currency === "custom" ? "custom" : form.currency}
                onValueChange={handleCurrencyChange}
              >
                <SelectTrigger id="currency">
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
              <Label htmlFor="currency-symbol">Symbol</Label>
              <Input
                id="currency-symbol"
                value={form.currency_symbol}
                onChange={(e) => updateField("currency_symbol", e.target.value)}
                placeholder="$"
                className="w-full"
              />
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-lg border bg-muted/40 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Prices will display as:{" "}
              <span className="font-semibold text-foreground">
                {previewPrice}
              </span>
            </p>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4 flex justify-end">
          <Button size="sm" onClick={handleSaveCurrency} disabled={savingCard === "currency"}>
            {savingCard === "currency" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
            Save
          </Button>
        </CardFooter>
      </Card>

      {/* ── Section 2: Payment Methods ────────────────────────────────── */}

      {/* PayOS */}
      <Collapsible
        open={openSections.payos}
        onOpenChange={(open) => toggleSection("payos", open)}
      >
        <Card
          className={cn(
            "transition-all",
            form.payos_enabled && "border-l-4 border-l-blue-500"
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-3 text-left flex-1"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                    <CreditCard className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">PayOS</CardTitle>
                      <StatusIcon configured={payosConfigured} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Vietnamese bank transfer
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                      openSections.payos && "rotate-180"
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <Switch
                checked={form.payos_enabled}
                onCheckedChange={(v) => {
                  updateField("payos_enabled", v);
                  if (v) toggleSection("payos", true);
                }}
                className="ml-3 shrink-0"
              />
            </div>
          </CardHeader>
          {form.payos_enabled && (
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="payos-client-id">Client ID</Label>
                    <Input
                      id="payos-client-id"
                      value={form.payos_client_id}
                      onChange={(e) =>
                        updateField("payos_client_id", e.target.value)
                      }
                      placeholder={
                        configQuery.data?.payos_client_id
                          ? `${String(configQuery.data.payos_client_id).slice(0, 8)}...`
                          : "Enter Client ID"
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <SecretInput
                      value={form.payos_api_key}
                      onChange={(v) => updateField("payos_api_key", v)}
                      hasExisting={configQuery.data?.has_payos_api_key ?? false}
                      placeholder="Enter API Key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Checksum Key</Label>
                    <SecretInput
                      value={form.payos_checksum_key}
                      onChange={(v) => updateField("payos_checksum_key", v)}
                      hasExisting={
                        configQuery.data?.has_payos_checksum_key ?? false
                      }
                      placeholder="Enter Checksum Key"
                    />
                  </div>
                  <TestConnectionButton endpoint="/api/payos/test" label="Test PayOS" />
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-end">
                <Button size="sm" onClick={handleSavePayOS} disabled={savingCard === "payos"}>
                  {savingCard === "payos" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                  Save
                </Button>
              </CardFooter>
            </CollapsibleContent>
          )}
        </Card>
      </Collapsible>

      {/* PayPal */}
      <Collapsible
        open={openSections.paypal}
        onOpenChange={(open) => toggleSection("paypal", open)}
      >
        <Card
          className={cn(
            "transition-all",
            form.paypal_enabled && "border-l-4 border-l-indigo-500"
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-3 text-left flex-1"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10">
                    <Globe className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">PayPal</CardTitle>
                      <StatusIcon configured={paypalConfigured} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      International payments
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                      openSections.paypal && "rotate-180"
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <Switch
                checked={form.paypal_enabled}
                onCheckedChange={(v) => {
                  updateField("paypal_enabled", v);
                  if (v) toggleSection("paypal", true);
                }}
                className="ml-3 shrink-0"
              />
            </div>
          </CardHeader>
          {form.paypal_enabled && (
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="paypal-client-id">Client ID</Label>
                    <Input
                      id="paypal-client-id"
                      value={form.paypal_client_id}
                      onChange={(e) =>
                        updateField("paypal_client_id", e.target.value)
                      }
                      placeholder={
                        configQuery.data?.has_paypal_client_id
                          ? "••••••••  (configured)"
                          : "Enter Client ID"
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Secret</Label>
                    <SecretInput
                      value={form.paypal_client_secret}
                      onChange={(v) => updateField("paypal_client_secret", v)}
                      hasExisting={
                        configQuery.data?.has_paypal_client_secret ?? false
                      }
                      placeholder="Enter Client Secret"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mode</Label>
                    <Select
                      value={form.paypal_mode}
                      onValueChange={(v) => updateField("paypal_mode", v)}
                    >
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox</SelectItem>
                        <SelectItem value="live">Live</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Use Sandbox for testing, Live for production.
                    </p>
                  </div>
                  <TestConnectionButton endpoint="/api/paypal/test" label="Test PayPal" />
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-end">
                <Button size="sm" onClick={handleSavePayPal} disabled={savingCard === "paypal"}>
                  {savingCard === "paypal" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                  Save
                </Button>
              </CardFooter>
            </CollapsibleContent>
          )}
        </Card>
      </Collapsible>

      {/* Crypto */}
      <Collapsible
        open={openSections.crypto}
        onOpenChange={(open) => toggleSection("crypto", open)}
      >
        <Card
          className={cn(
            "transition-all",
            form.crypto_enabled && "border-l-4 border-l-amber-500"
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-3 text-left flex-1"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                    <Coins className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">Crypto</CardTitle>
                      <StatusIcon configured={cryptoConfigured} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cryptocurrency payments
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                      openSections.crypto && "rotate-180"
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <Switch
                checked={form.crypto_enabled}
                onCheckedChange={(v) => {
                  updateField("crypto_enabled", v);
                  if (v) toggleSection("crypto", true);
                }}
                className="ml-3 shrink-0"
              />
            </div>
          </CardHeader>
          {form.crypto_enabled && (
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <SecretInput
                      value={form.crypto_api_key}
                      onChange={(v) => updateField("crypto_api_key", v)}
                      hasExisting={configQuery.data?.has_crypto_api_key ?? false}
                      placeholder="Enter API Key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                      value={form.crypto_provider}
                      onValueChange={(v) => updateField("crypto_provider", v)}
                    >
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nowpayments">
                          NOWPayments
                        </SelectItem>
                        <SelectItem value="coingate">CoinGate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-end">
                <Button size="sm" onClick={handleSaveCrypto} disabled={savingCard === "crypto"}>
                  {savingCard === "crypto" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                  Save
                </Button>
              </CardFooter>
            </CollapsibleContent>
          )}
        </Card>
      </Collapsible>

      {/* Manual / QR */}
      <Collapsible
        open={openSections.manual}
        onOpenChange={(open) => toggleSection("manual", open)}
      >
        <Card
          className={cn(
            "transition-all",
            form.manual_enabled && "border-l-4 border-l-emerald-500"
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-3 text-left flex-1"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                    <HandCoins className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">Manual / QR</CardTitle>
                      {form.manual_enabled && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upload QR code, manually confirm payments
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
              <Switch
                checked={form.manual_enabled}
                onCheckedChange={(v) => {
                  updateField("manual_enabled", v);
                  if (v) toggleSection("manual", true);
                }}
                className="ml-3 shrink-0"
              />
            </div>
          </CardHeader>
          {form.manual_enabled && (
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                <Separator />
                <div className="space-y-4">
                  {/* QR Image Upload */}
                  <div className="space-y-2">
                    <Label>QR Code Image</Label>
                    <div className="flex items-start gap-4">
                      {qrPreviewUrl ? (
                        <div className="relative group">
                          <img
                            src={qrPreviewUrl}
                            alt="QR code preview"
                            className="h-32 w-32 rounded-lg border object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={handleRemoveQR}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <label className="flex h-32 w-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleQRUpload}
                            disabled={uploadingQR}
                          />
                          <div className="text-center">
                            {uploadingQR ? (
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                            ) : (
                              <Upload className="h-6 w-6 text-muted-foreground mx-auto" />
                            )}
                            <span className="text-xs text-muted-foreground mt-1 block">
                              Upload
                            </span>
                          </div>
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="manual-bank-name">Bank Name</Label>
                      <Input
                        id="manual-bank-name"
                        value={form.manual_bank_name}
                        onChange={(e) =>
                          updateField("manual_bank_name", e.target.value)
                        }
                        placeholder="e.g. Vietcombank"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-account-holder">
                        Account Holder
                      </Label>
                      <Input
                        id="manual-account-holder"
                        value={form.manual_account_holder}
                        onChange={(e) =>
                          updateField("manual_account_holder", e.target.value)
                        }
                        placeholder="Full name on account"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manual-account-number">Account Number</Label>
                    <Input
                      id="manual-account-number"
                      value={form.manual_account_number}
                      onChange={(e) =>
                        updateField("manual_account_number", e.target.value)
                      }
                      placeholder="Bank account number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manual-instructions">
                      Payment Instructions
                    </Label>
                    <Textarea
                      id="manual-instructions"
                      value={form.manual_instructions}
                      onChange={(e) =>
                        updateField("manual_instructions", e.target.value)
                      }
                      placeholder="Instructions shown to customers after purchase..."
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-end">
                <Button size="sm" onClick={handleSaveManual} disabled={savingCard === "manual"}>
                  {savingCard === "manual" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                  Save
                </Button>
              </CardFooter>
            </CollapsibleContent>
          )}
        </Card>
      </Collapsible>
    </div>
  );
}
