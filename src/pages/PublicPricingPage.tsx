import { useT } from "@/i18n";
import { useEffect } from "react";
import { Zap, Clock } from "lucide-react";
import { LandingNavbar, useLandingFonts } from "@/components/LandingNavbar";

export function PublicPricingPage() {
  const { t } = useT();
  useLandingFonts();
  useEffect(() => { document.title = t("publicPricing_title"); }, []);
  return (
    <div style={{ background: "#1E1E2D", minHeight: "100vh", fontFamily: "'Syne', sans-serif" }}>
      <LandingNavbar />
      <div className="max-w-4xl mx-auto px-4 pt-28 pb-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 border border-primary/20 mb-6">
          <Clock className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-5xl font-extrabold text-white mb-4">{t("publicPricing_pricing")}</h1>
        <p className="text-white/40 text-lg mb-8">{t("comingSoon")}</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/10 text-primary text-sm">
          <Zap className="w-3.5 h-3.5" /> {t("publicPricing_currentlyFree")}
        </div>
      </div>
    </div>
  );
}
