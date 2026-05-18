import { useState, useEffect, useCallback } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  Save,
  Loader2,
  ChevronDown,
  Settings,
  Building2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface PremiumConfig {
  currency: string;
  currency_symbol: string;
  payment_methods: string[];
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

const _EMPTY_FORM: FormState = {
  currency: "VND",
  currency_symbol: "₫",
  premium_default_renewal_days: 30,
  premium_renewal_channel_id: "",
  manual_bank_name: "",
  manual_account_holder: "",
  manual_account_number: "",
  premium_payment_instructions: "",
};

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

// ── Main Component ─────────────────────────────────────────────────────────

export function PremiumPaymentConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    general: true,
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
        currency: d.currency || "VND",
        currency_symbol: d.currency_symbol || CURRENCY_MAP[d.currency] || "₫",
        premium_default_renewal_days: d.premium_default_renewal_days || 30,
        premium_renewal_channel_id: d.premium_renewal_channel_id ?? "",
        manual_bank_name: d.manual_bank_name ?? "",
        manual_account_holder: d.manual_account_holder ?? "",
        manual_account_number: d.manual_account_number ?? "",
        premium_payment_instructions: d.premium_payment_instructions ?? "",
      });
      if (d.manual_bank_name) {
        setOpenSections((prev) => ({ ...prev, manual: true }));
      }
    }
  }, [configQuery.data, form]);

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
      toast({ title: "Đã lưu cấu hình Premium" });
      qc.invalidateQueries({ queryKey: ["premium-config"] });
    },
    onError: () => {
      toast({ title: "Lưu thất bại", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!form) return;
    saveMutation.mutate({
      currency: form.currency,
      currency_symbol: form.currency_symbol,
      premium_default_renewal_days: form.premium_default_renewal_days,
      premium_renewal_channel_id: form.premium_renewal_channel_id || null,
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
    <div className="space-y-6 max-w-3xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Cấu hình Premium
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cấu hình thanh toán và gia hạn cho gói Premium.
        </p>
      </div>

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
                  <CardTitle className="text-base">Cài đặt chung</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tiền tệ, ngày gia hạn, kênh nhắc nhở
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
                  <Label htmlFor="premium-currency">Tiền tệ</Label>
                  <Select
                    value={form.currency}
                    onValueChange={handleCurrencyChange}
                  >
                    <SelectTrigger id="premium-currency">
                      <SelectValue placeholder="Chọn tiền tệ" />
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
                  <Label htmlFor="premium-currency-symbol">Ký hiệu</Label>
                  <Input
                    id="premium-currency-symbol"
                    value={form.currency_symbol}
                    onChange={(e) =>
                      updateField("currency_symbol", e.target.value)
                    }
                    placeholder="₫"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="premium-renewal-days">
                    Số ngày gia hạn mặc định
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
                    Kênh nhắc nhở gia hạn
                  </Label>
                  <Input
                    id="premium-renewal-channel"
                    value={form.premium_renewal_channel_id}
                    onChange={(e) =>
                      updateField("premium_renewal_channel_id", e.target.value)
                    }
                    placeholder="Channel ID"
                  />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ── Section 2: Manual / Bank Transfer ───────────────────────────── */}
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
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                  <Building2 className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">
                    Chuyển khoản / Bank Transfer
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Thông tin tài khoản nhận thanh toán
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
                  <Label htmlFor="premium-bank-name">Tên ngân hàng</Label>
                  <Input
                    id="premium-bank-name"
                    value={form.manual_bank_name}
                    onChange={(e) =>
                      updateField("manual_bank_name", e.target.value)
                    }
                    placeholder="Vietcombank"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="premium-account-holder">
                    Chủ tài khoản
                  </Label>
                  <Input
                    id="premium-account-holder"
                    value={form.manual_account_holder}
                    onChange={(e) =>
                      updateField("manual_account_holder", e.target.value)
                    }
                    placeholder="NGUYEN VAN A"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="premium-account-number">Số tài khoản</Label>
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
                  Hướng dẫn thanh toán
                </Label>
                <Textarea
                  id="premium-payment-instructions"
                  value={form.premium_payment_instructions}
                  onChange={(e) =>
                    updateField("premium_payment_instructions", e.target.value)
                  }
                  placeholder="Chuyển khoản với nội dung: PREMIUM [Guild ID]..."
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
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Lưu cấu hình
        </Button>
      </div>
    </div>
  );
}
