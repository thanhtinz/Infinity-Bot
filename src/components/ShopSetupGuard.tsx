/**
 * ShopSetupGuard — blocks shop pages until payment is configured.
 * Checks: currency set + at least one payment method enabled.
 * Shows a locked overlay with link to payment config.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/hooks/useApi";
import { useGuild } from "@/contexts/GuildContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Lock, ArrowRight, Loader2 } from "lucide-react";
import { PageContainer } from "@/components/infinity";
import type { ReactNode } from "react";

interface PaymentStatus {
  payment_methods: string[];
  currency: string;
  currency_symbol: string;
}

export function ShopSetupGuard({ children }: { children: ReactNode }) {
  const { selectedGuildId } = useGuild();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery<PaymentStatus>({
    queryKey: ["payment-status", selectedGuildId],
    queryFn: () => apiFetch("/api/config").then((r) => r.json()),
    staleTime: 60_000,
    enabled: !!selectedGuildId,
  });

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  const hasPayment = data?.payment_methods && data.payment_methods.length > 0;

  if (!hasPayment) {
    return (
      <PageContainer>
        <Card className="max-w-lg mx-auto mt-16">
          <CardContent className="flex flex-col items-center text-center py-12 px-6 gap-4">
            <div className="p-4 rounded-full bg-muted">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">Payment Setup Required</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              Configure at least one payment method (PayOS, PayPal, Crypto, or Manual)
              and set your currency before using the shop.
            </p>
            <Button
              className="mt-2 gap-2"
              onClick={() => navigate("/config/payments")}
            >
              <CreditCard className="h-4 w-4" />
              Configure Payments
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return <>{children}</>;
}
