import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bot, ArrowRight } from "lucide-react";

export function useLandingFonts() {
  useEffect(() => {
    if (document.getElementById("landing-fonts")) return;
    const link = document.createElement("link");
    link.id = "landing-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);
}

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const location = useLocation();

  useLandingFonts();

  useEffect(() => {
    fetch("/api/public/invite")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.invite_url) setInviteUrl(d.invite_url);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const navLinks = [
    { to: "/commands", label: "Commands" },
    { to: "/pricing", label: "Pricing" },
    { to: "/status", label: "Status" },
  ];

  const isActive = (to: string) => location.pathname === to;

  return (
    <nav
      style={{ fontFamily: "'Syne', sans-serif" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#1E1E2D]/80 backdrop-blur-xl border-b border-white/5 shadow-lg"
          : "bg-transparent backdrop-blur-sm"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 font-bold text-xl text-white hover:opacity-90 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          Infinity Bot
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-7 text-sm font-medium text-white/60">
          {navLinks.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`transition-colors hover:text-white ${
                isActive(l.to) ? "text-primary" : ""
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/dashboard"
            className="text-sm font-medium text-white/70 hover:text-white transition-colors px-4 py-2 rounded-lg border border-white/10 hover:border-white/20"
          >
            Login
          </Link>
          {inviteUrl && (
            <a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors"
            >
              Add to Discord <ArrowRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-white/70 hover:text-white p-2" onClick={() => setMenuOpen(v => !v)}>
          <div className="space-y-1.5">
            <span className={`block w-5 h-0.5 bg-current transition-all ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-5 h-0.5 bg-current transition-all ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-current transition-all ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#1E1E2D]/95 backdrop-blur-xl border-b border-white/10 px-4 pb-4 space-y-1">
          {[...navLinks, { to: "/dashboard", label: "Dashboard" }].map(l => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMenuOpen(false)}
              className={`block text-sm py-2 transition-colors ${
                isActive(l.to) ? "text-primary" : "text-white/70 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
