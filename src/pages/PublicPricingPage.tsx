import { useEffect } from "react";
import { Link } from "react-router-dom";
import { LandingNavbar } from "@/components/LandingNavbar";
import { CheckCircle, Zap, Crown, Gem, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Free",
    price: "0",
    desc: "Perfect for getting started",
    icon: Zap,
    features: ["Basic commands", "Shop system", "Moderation tools", "5 custom commands", "Community support"],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Premium",
    price: "4.99",
    desc: "For growing communities",
    icon: Crown,
    features: ["Everything in Free", "Unlimited custom commands", "AI Chat integration", "Custom bot branding", "Priority support", "Advanced analytics"],
    cta: "Upgrade Now",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "14.99",
    desc: "For large servers",
    icon: Gem,
    features: ["Everything in Premium", "Dedicated bot instance", "Custom features", "SLA guarantee", "Direct developer support", "White-label options"],
    cta: "Contact Us",
    popular: false,
  },
];

export function PublicPricingPage() {
  useEffect(() => { document.title = "Pricing — Infinity Bot"; }, []);

  return (
    <div className="min-h-screen bg-[#1E1E2D] text-white">
      <LandingNavbar />
      <div className="pt-[120px] pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#009DB5]/10 border border-[#009DB5]/20 text-[#009DB5] text-sm font-semibold mb-6">
              <Zap className="w-4 h-4" /> Simple Pricing
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">Choose Your Plan</h1>
            <p className="text-white/50 max-w-xl mx-auto">Start free, upgrade when you need more power.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map(plan => (
              <div
                key={plan.name}
                className={cn(
                  "relative p-8 rounded-2xl border transition-all",
                  plan.popular
                    ? "bg-[#262932] border-[#009DB5]/40 shadow-xl shadow-[#009DB5]/10"
                    : "bg-[#262932] border-white/5 hover:border-white/10"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#009DB5] text-white text-xs font-bold">
                    Most Popular
                  </div>
                )}
                <div className="w-12 h-12 rounded-xl bg-[#009DB5]/10 flex items-center justify-center mb-4">
                  <plan.icon className="w-6 h-6 text-[#009DB5]" />
                </div>
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-white/40 mb-4">{plan.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold">${plan.price}</span>
                  <span className="text-white/40 text-sm">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-white/60">
                      <CheckCircle className="w-4 h-4 text-[#009DB5] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  className={cn(
                    "block w-full py-3 rounded-xl text-center text-sm font-bold transition-all",
                    plan.popular
                      ? "bg-[#009DB5] text-white hover:bg-[#00B4D0] shadow-lg shadow-[#009DB5]/25"
                      : "bg-white/5 text-white/80 hover:bg-white/10 border border-white/10"
                  )}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
