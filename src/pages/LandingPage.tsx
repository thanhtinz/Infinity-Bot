import { Link } from "react-router-dom";
import { LandingNavbar } from "@/components/LandingNavbar";
import {
  Bot,
  ShoppingCart,
  Gift,
  Shield,
  Zap,
  MessageSquare,
  Crown,
  Users,
  Server,
  Terminal,
  ArrowRight,
  CheckCircle,
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

const stats = [
  { icon: Server, value: "500+", label: "Servers" },
  { icon: Users, value: "50K+", label: "Users" },
  { icon: Terminal, value: "100+", label: "Commands" },
];

export function LandingPage() {
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
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
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
          <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#6C5CE7]/8 flex items-center justify-center">
                  <s.icon className="w-5 h-5 text-[#6C5CE7]" />
                </div>
                <div className="text-left">
                  <div className="text-xl font-extrabold text-gray-900">
                    {s.value}
                  </div>
                  <div className="text-xs font-semibold text-gray-400">
                    {s.label}
                  </div>
                </div>
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
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="sm:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#6C5CE7] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <span className="font-extrabold text-gray-900">
                  Infinity Bot
                </span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                All-in-one Discord bot with dashboard management.
              </p>
            </div>

            {/* Links */}
            {[
              {
                title: "Product",
                links: [
                  { to: "/commands", label: "Commands" },
                  { to: "/pricing", label: "Pricing" },
                  { to: "/status", label: "Status" },
                ],
              },
              {
                title: "Resources",
                links: [
                  { to: "#", label: "Documentation" },
                  { to: "#", label: "Support" },
                  { to: "#", label: "Changelog" },
                ],
              },
              {
                title: "Legal",
                links: [
                  { to: "#", label: "Privacy" },
                  { to: "#", label: "Terms" },
                  { to: "#", label: "Cookie Policy" },
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-gray-300 mb-4">
                  {col.title}
                </h4>
                <div className="space-y-2.5">
                  {col.links.map((link) => (
                    <Link
                      key={link.label}
                      to={link.to}
                      className="block text-sm text-gray-400 hover:text-[#6C5CE7] transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-300">
              © 2025 Infinity Bot. All rights reserved.
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500 font-semibold">
              <CheckCircle className="w-3 h-3" /> All systems operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
