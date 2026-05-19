import { Link } from "react-router-dom";
import { LandingNavbar } from "@/components/LandingNavbar";
import {
  Bot, ShoppingCart, Gift, Shield, Zap, MessageSquare, Crown,
  Users, Server, Terminal, ArrowRight, CheckCircle, Star,
} from "lucide-react";

const features = [
  { icon: ShoppingCart, title: "Shop System", desc: "Built-in product management, orders, coupons, flash sales, and PayOS integration." },
  { icon: Gift, title: "Giveaways", desc: "Create and manage giveaways with entries, winners, and fair random selection." },
  { icon: Shield, title: "Moderation", desc: "AutoMod, warnings, kicks, bans, timeout — with full case logging." },
  { icon: Zap, title: "Auto Responder", desc: "Custom triggers with regex, embeds, and conditional logic." },
  { icon: MessageSquare, title: "Custom Commands", desc: "Create slash commands with variables, embeds, and permission controls." },
  { icon: Crown, title: "Premium System", desc: "Sell subscriptions with plans, tiers, and payment management." },
];

const stats = [
  { icon: Server, value: "500+", label: "Servers" },
  { icon: Users, value: "50K+", label: "Users" },
  { icon: Terminal, value: "100+", label: "Commands" },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#1E1E2D] text-white">
      <LandingNavbar />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative pt-[72px] overflow-hidden">
        {/* Gradient bg */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1E1E2D] via-[#262932] to-[#1E1E2D]" />

        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#009DB5]/10 border border-[#009DB5]/20 mb-8">
            <Star className="w-3.5 h-3.5 text-[#009DB5]" />
            <span className="text-xs font-semibold text-[#009DB5]">All-in-one Discord Bot Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight">
            Build your perfect
            <br />
            <span className="bg-gradient-to-r from-[#009DB5] to-[#00d4f5] bg-clip-text text-transparent">
              Discord server
            </span>
          </h1>

          <p className="mt-6 text-lg text-[#9FA8C1] max-w-2xl mx-auto leading-relaxed">
            Shop, moderation, giveaways, custom commands, AI chat, and more — all managed from a beautiful dashboard.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#009DB5] text-white font-bold text-[15px] rounded-xl hover:bg-[#00b4cf] transition-all shadow-xl shadow-[#009DB5]/25 hover:shadow-[#009DB5]/40 hover:-translate-y-0.5"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/commands"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/[0.06] text-white/80 font-bold text-[15px] rounded-xl hover:bg-white/[0.1] hover:text-white transition-all border border-white/10"
            >
              View Commands
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <section className="relative -mt-16 z-10 max-w-4xl mx-auto px-6">
        <div className="grid grid-cols-3 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-[#262932] rounded-xl p-6 text-center border border-white/5 shadow-lg">
              <s.icon className="w-6 h-6 text-[#009DB5] mx-auto mb-3" />
              <p className="text-2xl sm:text-3xl font-black text-white">{s.value}</p>
              <p className="text-sm text-[#9FA8C1] mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-28">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Everything you need
          </h2>
          <p className="text-[#9FA8C1] mt-3 text-lg max-w-xl mx-auto">
            A complete suite of tools to manage, grow, and monetize your Discord community.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(f => (
            <div
              key={f.title}
              className="group bg-[#262932] rounded-xl p-6 border border-white/5 hover:border-[#009DB5]/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#009DB5]/5"
            >
              <div className="w-11 h-11 rounded-xl bg-[#009DB5]/10 flex items-center justify-center mb-4 group-hover:bg-[#009DB5]/20 transition-colors">
                <f.icon className="w-5 h-5 text-[#009DB5]" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-[#9FA8C1] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-28">
        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#009DB5] to-[#007a8f]" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-5" />
          <div className="relative px-8 py-16 sm:px-16 text-center">
            <h2 className="text-2xl sm:text-3xl font-black text-white">Ready to level up your server?</h2>
            <p className="text-white/80 mt-3 text-lg max-w-lg mx-auto">
              Join hundreds of communities using Infinity Bot. Free to start.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 mt-8 px-8 py-3.5 bg-white text-[#009DB5] font-bold text-[15px] rounded-xl hover:bg-white/90 transition-all shadow-xl"
            >
              <Bot className="w-5 h-5" />
              Add to Discord
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#1a1a27]">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="sm:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#009DB5] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <span className="font-extrabold text-white">Infinity Bot</span>
              </div>
              <p className="text-sm text-[#9FA8C1] leading-relaxed">
                All-in-one Discord bot with dashboard management.
              </p>
            </div>

            {/* Links */}
            {[
              { title: "Product", links: [{ to: "/commands", label: "Commands" }, { to: "/pricing", label: "Pricing" }, { to: "/status", label: "Status" }] },
              { title: "Resources", links: [{ to: "#", label: "Documentation" }, { to: "#", label: "Support" }, { to: "#", label: "Changelog" }] },
              { title: "Legal", links: [{ to: "#", label: "Privacy" }, { to: "#", label: "Terms" }, { to: "#", label: "Cookie Policy" }] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-white/40 mb-4">{col.title}</h4>
                <div className="space-y-2.5">
                  {col.links.map(link => (
                    <Link key={link.label} to={link.to} className="block text-sm text-[#9FA8C1] hover:text-[#009DB5] transition-colors">
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[#9FA8C1]/60">© 2025 Infinity Bot. All rights reserved.</p>
            <div className="flex items-center gap-1.5">
              {[CheckCircle].map((Icon, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-xs text-emerald-400/80">
                  <Icon className="w-3 h-3" /> All systems operational
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
