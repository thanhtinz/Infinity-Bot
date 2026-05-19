import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./useApi";

interface CurrencyConfig {
  currency: string;
  currency_symbol: string;
}

const NO_DECIMAL = new Set(["VND", "JPY", "KRW"]);

export function useCurrency() {
  const { data } = useQuery<CurrencyConfig>({
    queryKey: ["currency-config"],
    queryFn: () => apiFetch("/api/config").then((r) => r.json()),
    staleTime: 60_000,
    select: (d: Record<string, unknown>) => ({
      currency: (d.currency as string) || "VND",
      currency_symbol: (d.currency_symbol as string) || "₫",
    }),
  });

  const symbol = data?.currency_symbol ?? "₫";
  const currency = data?.currency ?? "VND";
  const noDecimal = NO_DECIMAL.has(currency);

  /** Format full price: ₫299.000 or $29.99 */
  function formatPrice(amount: number): string {
    if (noDecimal) {
      return symbol + amount.toLocaleString("vi-VN");
    }
    return symbol + amount.toFixed(2);
  }

  /** Format compact: 1.2M₫ / 300K₫ / $1.2M */
  function formatPriceCompact(amount: number): string {
    if (amount >= 1_000_000) {
      return `${(amount / 1_000_000).toFixed(1)}M ${symbol}`;
    }
    if (amount >= 1_000) {
      return `${(amount / 1_000).toFixed(0)}K ${symbol}`;
    }
    return formatPrice(amount);
  }

  return { formatPrice, formatPriceCompact, symbol, currency, noDecimal };
}
