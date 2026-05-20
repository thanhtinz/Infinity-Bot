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
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-200",
        scrolled
          ? "bg-white/95 border-b border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          : "bg-white"
      )}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-[#6C5CE7] flex items-center justify-center">
            <Bot className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">
            Infinity Bot
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
                location.pathname === l.to
                  ? "text-[#6C5CE7] bg-[#6C5CE7]/8"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/login"
            className="ml-3 px-5 py-2 rounded-lg bg-[#6C5CE7] text-white text-sm font-bold hover:bg-[#5B4BD6] transition-colors"
          >
            Dashboard
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-gray-600 p-2 -mr-2"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-3 space-y-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "block px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                location.pathname === l.to
                  ? "text-[#6C5CE7] bg-[#6C5CE7]/8"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/login"
            className="block px-4 py-2.5 rounded-lg bg-[#6C5CE7] text-white text-sm font-bold text-center mt-2 hover:bg-[#5B4BD6] transition-colors"
          >
            Dashboard
          </Link>
        </div>
      )}
    </nav>
  );
}
