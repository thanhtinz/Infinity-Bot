import { useEffect } from "react";
import { Zap, Clock } from "lucide-react";
import { LandingNavbar, useLandingFonts } from "@/components/LandingNavbar";

export function PublicPricingPage() {
  useLandingFonts();
  useEffect(() => { document.title = "Pricing — Infinity Bot"; }, []);
  return (
    <div style={{ background: "#0d0f14", minHeight: "100vh", fontFamily: "'Syne', sans-serif" }}>
      <LandingNavbar />
      <div className="max-w-4xl mx-auto px-4 pt-28 pb-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#5865F2]/15 border border-[#5865F2]/20 mb-6">
          <Clock className="w-8 h-8 text-[#5865F2]" />
        </div>
        <h1 className="text-5xl font-extrabold text-white mb-4">Pricing</h1>
        <p className="text-white/40 text-lg mb-8">Coming soon — stay tuned!</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#00d4aa]/20 bg-[#00d4aa]/10 text-[#00d4aa] text-sm">
          <Zap className="w-3.5 h-3.5" /> Currently completely free
        </div>
      </div>
    </div>
  );
}
