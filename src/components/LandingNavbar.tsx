import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bot, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { to: "/commands", label: "Commands" },
  { to: "/pricing", label: "Pricing" },
  { to: "/status", label: "Status" },
];

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      scrolled ? "bg-[#262932]/95 backdrop-blur-md shadow-lg" : "bg-transparent"
    )}>
      <div className="max-w-6xl mx-auto px-6 h-[72px] flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-[#009DB5] flex items-center justify-center shadow-lg shadow-[#009DB5]/25 group-hover:shadow-[#009DB5]/40 transition-shadow">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Infinity Bot</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === l.to
                  ? "text-[#009DB5] bg-[#009DB5]/10"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              )}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/login"
            className="ml-4 px-5 py-2.5 rounded-lg bg-[#009DB5] text-white text-sm font-bold hover:bg-[#00B4D0] transition-colors shadow-lg shadow-[#009DB5]/25"
          >
            Dashboard
          </Link>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-white p-2" onClick={() => setMobileOpen(v => !v)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#262932] border-t border-white/10 px-6 py-4 space-y-1">
          {NAV_LINKS.map(l => (
            <Link key={l.to} to={l.to} className="block px-4 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5">
              {l.label}
            </Link>
          ))}
          <Link to="/login" className="block px-4 py-2.5 rounded-lg bg-[#009DB5] text-white text-sm font-bold text-center mt-2">
            Dashboard
          </Link>
        </div>
      )}
    </nav>
  );
}
