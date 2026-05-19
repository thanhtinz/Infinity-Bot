import { useEffect } from "react";
import { Link } from "react-router-dom";
import { LandingNavbar } from "@/components/LandingNavbar";
import { Check, X, Zap, Crown, Gem, ArrowRight, Star } from "lucide-react";
import { useT } from "@/i18n";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "",
    description: "Get started with essential bot features",
    icon: Zap,
    features: [
      { text: "Basic commands", included: true },
      { text: "Auto-moderation", included: true },
      { text: "5 custom commands", included: true },
      { text: "Reaction roles (3)", included: true },
      { text: "Shop system", included: false },
      { text: "AI chat", included: false },
      { text: "Priority support", included: false },
    ],
    cta: "Get Started",
    ctaStyle: "outline" as const,
    popular: false,
  },
  {
    name: "Pro",
    price: "$4.99",
    period: "/mo",
    description: "Everything you need for a thriving community",
    icon: Crown,
    features: [
      { text: "All Free features", included: true },
      { text: "Unlimited custom commands", included: true },
      { text: "Advanced auto-mod", included: true },
      { text: "Shop & economy system", included: true },
      { text: "AI chat integration", included: true },
      { text: "Scheduled messages", included: true },
      { text: "Priority support", included: false },
    ],
    cta: "Upgrade",
    ctaStyle: "filled" as const,
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$14.99",
    period: "/mo",
    description: "For large communities that need everything",
    icon: Gem,
    features: [
      { text: "All Pro features", included: true },
      { text: "Unlimited reaction roles", included: true },
      { text: "Custom embeds & forms", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Multi-server management", included: true },
      { text: "Dedicated support channel", included: true },
      { text: "Priority support", included: true },
    ],
    cta: "Contact Us",
    ctaStyle: "outline" as const,
    popular: false,
  },
];

export function PublicPricingPage() {
  const { t } = useT();
  useEffect(() => { document.title = t("publicPricing_title"); }, []);

  return (
    <div className="min-h-screen bg-[#1E1E2D] animate-fade-in">
      <LandingNavbar />

      <div className="max-w-5xl mx-auto px-4 pt-28 pb-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#009DB5]/20 bg-[#009DB5]/5 text-[#009DB5] text-[12px] font-semibold mb-5">
            <Star className="w-3.5 h-3.5" /> Pricing
          </div>
          <h1 className="text-[36px] md:text-[44px] font-bold text-white tracking-tight mb-3">
            {t("publicPricing_pricing")}
          </h1>
          <p className="text-[14px] text-[#9FA8C1] max-w-md mx-auto">
            Choose the plan that fits your community
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`relative rounded-[10px] bg-[#262932] p-6 shadow-[0px_7.8px_17.3px_rgba(0,157,181,0.07)] transition-all ${
                plan.popular
                  ? "ring-2 ring-[#009DB5] scale-[1.02]"
                  : "hover:ring-1 hover:ring-[#009DB5]/20"
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-[8px] bg-[#009DB5] text-white text-[11px] font-bold uppercase tracking-wider">
                  Popular
                </div>
              )}

              <div className="w-10 h-10 rounded-[8px] bg-[#009DB5]/10 flex items-center justify-center mb-4">
                <plan.icon className="w-5 h-5 text-[#009DB5]" />
              </div>

              <div className="mb-5">
                <h3 className="text-[18px] font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-[13px] text-[#9FA8C1]">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-[36px] font-bold text-white">{plan.price}</span>
                {plan.period && <span className="text-[14px] text-[#9FA8C1]">{plan.period}</span>}
              </div>

              {/* Features list */}
              <ul className="space-y-3 mb-8">
                {plan.features.map(f => (
                  <li key={f.text} className="flex items-center gap-2.5">
                    {f.included ? (
                      <Check className="w-4 h-4 text-[#009DB5] shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-[#9FA8C1]/30 shrink-0" />
                    )}
                    <span className={`text-[13px] ${f.included ? "text-[#9FA8C1]" : "text-[#9FA8C1]/40"}`}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA button */}
              {plan.ctaStyle === "filled" ? (
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-[8px] bg-[#009DB5] hover:bg-[#00B4D0] text-white font-semibold text-[14px] transition-colors"
                >
                  {plan.cta} <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-[8px] border-2 border-[#009DB5]/30 text-[#009DB5] hover:bg-[#009DB5]/10 font-semibold text-[14px] transition-colors"
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Feature comparison */}
        <div className="rounded-[10px] bg-[#262932] p-6 shadow-[0px_7.8px_17.3px_rgba(0,157,181,0.07)] mb-12">
          <h2 className="text-[18px] font-bold text-white mb-6">Feature Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-3 pr-4 text-[#9FA8C1] font-semibold">Feature</th>
                  <th className="text-center py-3 px-4 text-[#9FA8C1] font-semibold">Free</th>
                  <th className="text-center py-3 px-4 text-[#009DB5] font-semibold">Pro</th>
                  <th className="text-center py-3 px-4 text-[#9FA8C1] font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Custom Commands", free: "5", pro: "Unlimited", enterprise: "Unlimited" },
                  { feature: "Auto-Moderation", free: "Basic", pro: "Advanced", enterprise: "Advanced" },
                  { feature: "Reaction Roles", free: "3", pro: "25", enterprise: "Unlimited" },
                  { feature: "Shop System", free: "—", pro: "✓", enterprise: "✓" },
                  { feature: "AI Chat", free: "—", pro: "✓", enterprise: "✓" },
                  { feature: "Scheduled Messages", free: "—", pro: "✓", enterprise: "✓" },
                  { feature: "Analytics", free: "—", pro: "Basic", enterprise: "Advanced" },
                  { feature: "Support", free: "Community", pro: "Email", enterprise: "Priority" },
                ].map(row => (
                  <tr key={row.feature} className="border-b border-white/[0.03]">
                    <td className="py-3 pr-4 text-white">{row.feature}</td>
                    <td className="text-center py-3 px-4 text-[#9FA8C1]/60">{row.free}</td>
                    <td className="text-center py-3 px-4 text-[#009DB5] font-semibold">{row.pro}</td>
                    <td className="text-center py-3 px-4 text-[#9FA8C1]">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA section */}
        <div className="text-center rounded-[10px] bg-gradient-to-r from-[#009DB5]/10 to-[#F94C8E]/10 p-8 shadow-[0px_7.8px_17.3px_rgba(0,157,181,0.07)]">
          <h2 className="text-[22px] font-bold text-white mb-2">Ready to get started?</h2>
          <p className="text-[14px] text-[#9FA8C1] mb-6">
            {t("publicPricing_currentlyFree")}
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-[8px] bg-[#009DB5] hover:bg-[#00B4D0] text-white font-semibold text-[14px] transition-colors"
          >
            <Zap className="w-4 h-4" /> Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
