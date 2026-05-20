import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { LandingNavbar } from "@/components/LandingNavbar";
import {
  ShoppingCart,
  Gift,
  Shield,
  Zap,
  MessageSquare,
  Users,
  Server,
  Terminal,
  ArrowRight,
  Star,
} from "lucide-react";

const features = [
  {
    icon: ShoppingCart,
    title: "Shop System",
    desc: "Built-in product management, orders, coupons, flash sales, and PayOS integration.",
  },
  {
    icon: Gift,
    title: "Giveaways",
    desc: "Create and manage giveaways with entries, winners, and fair random selection.",
  },
  {
    icon: Shield,
    title: "Moderation",
    desc: "AutoMod, warnings, kicks, bans, timeout — with full case logging.",
  },
  {
    icon: Zap,
    title: "Auto Responder",
    desc: "Custom triggers with regex, embeds, and conditional logic.",
  },
  {
    icon: MessageSquare,
    title: "Custom Commands",
    desc: "Create slash commands with variables, embeds, and permission controls.",
  },
];

export function LandingPage() {
  const [stats, setStats] = useState({ servers: "—", users: "—", commands: "—" });

  useEffect(() => {
    Promise.all([
      fetch("/api/public/status").then(r => r.json()).catch(() => null),
      fetch("/api/public/commands").then(r => r.json()).catch(() => null),
    ]).then(([status, cmds]) => {
      const s = status?.guild_count;
      const u = status?.member_count;
      const c = Array.isArray(cmds) ? cmds.reduce((sum: number, cat: any) => sum + (cat.commands?.length || 0), 0) : null;
      setStats({
        servers: s ? s.toLocaleString() : "—",
        users: u ? (u >= 1000 ? `${(u / 1000).toFixed(1).replace(/\.0$/, "")}K+` : String(u)) : "—",
        commands: c ? String(c) + "+" : "—",
      });
    });
  }, []);

  const statItems = [
    { icon: Server, value: stats.servers, label: "Servers" },
    { icon: Users, value: stats.users, label: "Users" },
    { icon: Terminal, value: stats.commands, label: "Commands" },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <LandingNavbar />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative pt-16 overflow-hidden">
        {/* Subtle top gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#F8F7FF] via-white to-white" />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#6C5CE7]/8 border border-[#6C5CE7]/15 mb-8">
            <Star className="w-3.5 h-3.5 text-[#6C5CE7]" />
            <span className="text-xs font-bold text-[#6C5CE7]">
              All-in-one Discord Bot Platform
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-gray-900">
            Build your perfect
            <br />
            <span className="text-[#6C5CE7]">Discord server</span>
          </h1>

          <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            The all-in-one bot for shop management, giveaways, moderation, and
            more. Set up in minutes and let Infinity Bot handle the rest.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#6C5CE7] text-white text-sm font-bold hover:bg-[#5B4BD6] transition-colors shadow-sm"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/commands"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-bold hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              View Commands
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 flex items-center justify-center gap-10 sm:gap-20">
            {statItems.map((s) => (
              <div key={s.label} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#6C5CE7]/8 flex items-center justify-center mx-auto mb-3">
                  <s.icon className="w-7 h-7 text-[#6C5CE7]" />
                </div>
                <div className="text-3xl sm:text-4xl font-black text-gray-900">{s.value}</div>
                <div className="text-sm font-semibold text-gray-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className="bg-[#F9FAFB] py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
              Everything you need
            </h2>
            <p className="mt-4 text-gray-500 max-w-xl mx-auto">
              Powerful features to manage, grow, and monetize your Discord
              community — all in one bot.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group bg-white rounded-2xl p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(108,92,231,0.1)] transition-shadow duration-200"
              >
                <div className="w-11 h-11 rounded-xl bg-[#6C5CE7]/8 flex items-center justify-center mb-5 group-hover:bg-[#6C5CE7]/15 transition-colors">
                  <f.icon className="w-5 h-5 text-[#6C5CE7]" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="relative rounded-2xl bg-gradient-to-br from-[#6C5CE7] to-[#8B7CF0] px-8 py-16 text-center overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/5" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-white/5" />

            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Ready to level up your server?
              </h2>
              <p className="mt-4 text-white/70 max-w-lg mx-auto">
                Join thousands of servers already using Infinity Bot. Set up in
                under 2 minutes.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 mt-8 px-8 py-3.5 rounded-xl bg-white text-[#6C5CE7] text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white py-8 text-center text-xs text-gray-400">
        <div className="flex items-center justify-center gap-6 mb-3">
          <Link to="/terms" className="hover:text-[#6C5CE7] transition-colors">Terms</Link>
          <Link to="/privacy" className="hover:text-[#6C5CE7] transition-colors">Privacy</Link>
          <Link to="/refund" className="hover:text-[#6C5CE7] transition-colors">Refund</Link>
        </div>
        <p>© 2025 Infinity Bot. All rights reserved.</p>
      </footer>
    </div>
  );
}
