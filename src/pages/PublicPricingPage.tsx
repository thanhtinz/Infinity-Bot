import { Link } from "react-router-dom";
import { ArrowLeft, Zap, Clock } from "lucide-react";
import { useEffect } from "react";

export function PublicPricingPage() {
  useEffect(() => { document.title = "Bảng giá — Infinity Bot"; }, []);
  return (
    <div style={{ background: "#0d0f14", minHeight: "100vh", fontFamily: "'Syne', sans-serif" }}>
      <div className="border-b border-white/5 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Infinity Bot
          </Link>
          <Link to="/dashboard" className="text-sm text-[#5865F2] hover:text-[#818cf8] transition-colors font-medium">Dashboard →</Link>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#5865F2]/15 border border-[#5865F2]/20 mb-6">
          <Clock className="w-8 h-8 text-[#5865F2]" />
        </div>
        <h1 className="text-5xl font-extrabold text-white mb-4">Bảng giá</h1>
        <p className="text-white/40 text-lg mb-8">Đang chuẩn bị — sắp ra mắt!</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#00d4aa]/20 bg-[#00d4aa]/10 text-[#00d4aa] text-sm">
          <Zap className="w-3.5 h-3.5" /> Hiện tại hoàn toàn miễn phí
        </div>
      </div>
    </div>
  );
}
