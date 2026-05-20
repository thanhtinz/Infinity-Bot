import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Bot, Settings, ShoppingCart, Menu, LogOut, Tag, Package, Users, Gift, MessageSquare, Trophy, ShieldAlert, Pin, ChevronDown, Hash, CreditCard, Activity, Smile, UserPlus, ToggleLeft, Loader2, Shield, Clock, Terminal, Database, FileText, Bell, Crown, Gem, BarChart, BarChart3, AlertTriangle, MousePointer, List, MessageCircle, Layout, Zap, Warehouse, BrainCircuit, Settings2, BookOpen, History, Image, ClipboardList, Rss, UserCheck, Search, User } from "lucide-react";
import { useState, useMemo, useEffect, lazy, Suspense, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { GuildProvider, useGuild } from "@/contexts/GuildContext";
import { GuildSelector } from "@/components/GuildSelector";
import { I18nProvider, useT } from "@/i18n";
import { apiFetch } from "@/hooks/useApi";

// ── Lazy-loaded pages (code-split per route) ─────────────────────────────────
const ConfigDiscord = lazy(() => import("./pages/ConfigDiscord").then(m => ({ default: m.ConfigDiscord })));
const PaymentConfig = lazy(() => import("./pages/PaymentConfig").then(m => ({ default: m.PaymentConfig })));
const BotSettings = lazy(() => import("./pages/BotSettings").then(m => ({ default: m.BotSettings })));
const ProductsManager = lazy(() => import("./pages/ProductsManager").then(m => ({ default: m.ProductsManager })));
const OrdersManager = lazy(() => import("./pages/OrdersManager").then(m => ({ default: m.OrdersManager })));
const CouponsManager = lazy(() => import("./pages/CouponsManager").then(m => ({ default: m.CouponsManager })));
const EmbedsManager = lazy(() => import("./pages/EmbedsManager").then(m => ({ default: m.EmbedsManager })));
const EmojiManager = lazy(() => import("./pages/EmojiManager").then(m => ({ default: m.EmojiManager })));
const FeedbackManager = lazy(() => import("./pages/FeedbackManager").then(m => ({ default: m.FeedbackManager })));
const UsersManager = lazy(() => import("./pages/UsersManager").then(m => ({ default: m.UsersManager })));
const GiveawaysManager = lazy(() => import("./pages/GiveawaysManager").then(m => ({ default: m.GiveawaysManager })));
const WarningsManager = lazy(() => import("./pages/WarningsManager").then(m => ({ default: m.WarningsManager })));
const StickyManager = lazy(() => import("./pages/StickyManager").then(m => ({ default: m.StickyManager })));
const StickyEditPage = lazy(() => import("./pages/sticky/StickyEditPage").then(m => ({ default: m.StickyEditPage })));
const CouponEditPage = lazy(() => import("./pages/coupons/CouponEditPage").then(m => ({ default: m.CouponEditPage })));
const ProductEditPage = lazy(() => import("./pages/products/ProductEditPage").then(m => ({ default: m.ProductEditPage })));
const ButtonRoles = lazy(() => import("./pages/ButtonRoles").then(m => ({ default: m.ButtonRoles })));
const SelectMenuRoles = lazy(() => import("./pages/SelectMenuRoles").then(m => ({ default: m.SelectMenuRoles })));
const AutoModConfig = lazy(() => import("./pages/AutoModConfig").then(m => ({ default: m.AutoModConfig })));
const ReactionRoles = lazy(() => import("./pages/ReactionRoles").then(m => ({ default: m.ReactionRoles })));
const CustomCommands = lazy(() => import("./pages/CustomCommands").then(m => ({ default: m.CustomCommands })));
const CustomCommandEditPage = lazy(() => import("./pages/custom-commands/CustomCommandEditPage").then(m => ({ default: m.CustomCommandEditPage })));
const ScheduledMessages = lazy(() => import("./pages/ScheduledMessages").then(m => ({ default: m.ScheduledMessages })));
const ScheduledMessagesEditPage = lazy(() => import("./pages/scheduled-messages/ScheduledMessagesEditPage").then(m => ({ default: m.ScheduledMessagesEditPage })));
const ButtonRoleEditPage = lazy(() => import("./pages/button-roles/ButtonRoleEditPage").then(m => ({ default: m.ButtonRoleEditPage })));
const ReactionRoleEditPage = lazy(() => import("./pages/reaction-roles/ReactionRoleEditPage").then(m => ({ default: m.ReactionRoleEditPage })));
const SelectMenuRoleEditPage = lazy(() => import("./pages/select-roles/SelectMenuRoleEditPage").then(m => ({ default: m.SelectMenuRoleEditPage })));
const AutoResponder = lazy(() => import("./pages/AutoResponder").then(m => ({ default: m.AutoResponder })));
const AutoResponderEditPage = lazy(() => import("./pages/auto-responder/AutoResponderEditPage").then(m => ({ default: m.AutoResponderEditPage })));

const FirewallLogs = lazy(() => import("./pages/firewall/FirewallLogs").then(m => ({ default: m.FirewallLogs })));
const AlertsConfig = lazy(() => import("./pages/AlertsConfig").then(m => ({ default: m.AlertsConfig })));
const ModerationPage = lazy(() => import("./pages/moderation/ModerationPage"));
const LoggingPage = lazy(() => import("./pages/LoggingPage"));
const InvitesPage = lazy(() => import("./pages/invites/InvitesPage"));
const BackupPage = lazy(() => import("./pages/backup/BackupPage").then(m => ({ default: m.BackupPage })));
const SelectGuildPage = lazy(() => import("./pages/SelectGuildPage").then(m => ({ default: m.SelectGuildPage })));
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const InitialSetup = lazy(() => import("./pages/InitialSetup").then(m => ({ default: m.InitialSetup })));
const BotStatus = lazy(() => import("./pages/BotStatus").then(m => ({ default: m.BotStatus })));
const LandingPage = lazy(() => import("./pages/LandingPage").then(m => ({ default: m.LandingPage })));
const PublicCommandsPage = lazy(() => import("./pages/PublicCommandsPage").then(m => ({ default: m.PublicCommandsPage })));
const PublicPricingPage = lazy(() => import("./pages/PublicPricingPage").then(m => ({ default: m.PublicPricingPage })));
const PublicStatusPage = lazy(() => import("./pages/PublicStatusPage").then(m => ({ default: m.PublicStatusPage })));
const TermsPage = lazy(() => import("./pages/TermsPage").then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage").then(m => ({ default: m.PrivacyPage })));
const RefundPage = lazy(() => import("./pages/RefundPage").then(m => ({ default: m.RefundPage })));
const ShopChannels = lazy(() => import("./pages/ShopChannels").then(m => ({ default: m.ShopChannels })));
const ShopStats = lazy(() => import("./pages/ShopStats").then(m => ({ default: m.ShopStats })));
const FlashSales = lazy(() => import("./pages/FlashSales").then(m => ({ default: m.FlashSales })));
const InventoryManager = lazy(() => import("./pages/InventoryManager").then(m => ({ default: m.InventoryManager })));
const SpendingMilestones = lazy(() => import("./pages/SpendingMilestones"));

const PremiumPaymentConfig = lazy(() => import("./pages/PremiumPaymentConfig").then(m => ({ default: m.PremiumPaymentConfig })));
const PremiumPlans = lazy(() => import("./pages/PremiumPlans").then(m => ({ default: m.PremiumPlans })));
const PremiumManagement = lazy(() => import("./pages/PremiumManagement").then(m => ({ default: m.PremiumManagement })));
const MyPlan = lazy(() => import("./pages/MyPlan").then(m => ({ default: m.MyPlan })));
const AIConfigPage = lazy(() => import("./pages/ai-chat/AIConfigPage").then(m => ({ default: m.AIConfigPage })));
const AITrainingPage = lazy(() => import("./pages/ai-chat/AITrainingPage").then(m => ({ default: m.AITrainingPage })));
const AIHistoryPage = lazy(() => import("./pages/ai-chat/AIHistoryPage").then(m => ({ default: m.AIHistoryPage })));
const AIImageGenPage = lazy(() => import("./pages/ai-chat/AIImageGenPage").then(m => ({ default: m.AIImageGenPage })));
const AutoRolePage = lazy(() => import("./pages/AutoRolePage").then(m => ({ default: m.AutoRolePage })));
const FormsPage = lazy(() => import("./pages/FormsPage").then(m => ({ default: m.FormsPage })));
const RemindersPage = lazy(() => import("./pages/RemindersPage").then(m => ({ default: m.RemindersPage })));
const PollsPage = lazy(() => import("./pages/PollsPage").then(m => ({ default: m.PollsPage })));
const SocialFeedsPage = lazy(() => import("./pages/SocialFeedsPage").then(m => ({ default: m.SocialFeedsPage })));
const StatsChannelsPage = lazy(() => import("./pages/StatsChannelsPage").then(m => ({ default: m.StatsChannelsPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then(m => ({ default: m.ProfilePage })));
import { cn } from "./lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useStaffAccess } from "@/hooks/useStaffAccess";

import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  feature?: string;  // feature key — item hidden when this feature is disabled
}

interface NavGroup {
  key: string;
  icon: LucideIcon;
  label: string;
  items: NavItem[];
  feature?: string;  // if set, entire group hidden when disabled
  ownerOnly?: boolean; // if true, only visible to bot owner
  staffPerm?: string;  // if set, non-owner must have this perm to see group
}

const navGroups: NavGroup[] = [
  {
    key: "shop",
    icon: Package,
    label: "Shop",
    feature: "shop",
    staffPerm: "can_shop",
    items: [
      { to: "/products", icon: Package, label: "nav_products" },
      { to: "/orders", icon: ShoppingCart, label: "nav_orders" },
      { to: "/coupons", icon: Tag, label: "nav_coupons" },
      { to: "/users", icon: Users, label: "nav_users" },
      { to: "/shop-stats", icon: BarChart, label: "nav_shopStats" },
      { to: "/milestones", icon: Trophy, label: "Spending Milestones" },
      { to: "/flash-sales", icon: Zap, label: "Flash Sales" },
      { to: "/inventory", icon: Warehouse, label: "Inventory" },
      { to: "/feedback", icon: MessageSquare, label: "nav_feedback" },
      { to: "/config/shop-channels", icon: Hash, label: "nav_shopChannels", feature: "shop" },
      { to: "/config/payments", icon: CreditCard, label: "Payments" },
    ],
  },
  {
    key: "community",
    icon: Users,
    label: "nav_community",
    staffPerm: "can_community",
    items: [
      { to: "/giveaways", icon: Gift, label: "nav_giveaway", feature: "giveaway" },
      { to: "/invites", icon: UserPlus, label: "Invites", feature: "invite_tracking" },
      { to: "/warnings", icon: AlertTriangle, label: "nav_warnings", feature: "moderation" },
    ],
  },
  {
    key: "moderation",
    icon: Shield,
    label: "nav_moderation",
    feature: "moderation",
    staffPerm: "can_moderation",
    items: [
      { to: "/moderation", icon: Shield, label: "Moderation" },
      { to: "/automod", icon: Bot, label: "nav_automod" },
      { to: "/logging", icon: FileText, label: "Logging" },
    ],
  },
  {
    key: "security",
    icon: ShieldAlert,
    label: "nav_security",
    staffPerm: "can_moderation",
    items: [
      { to: "/firewall/logs", icon: ShieldAlert, label: "Firewall Logs" },
      { to: "/alerts", icon: Bell, label: "Server Alerts" },
    ],
  },
  {
    key: "roles",
    icon: ToggleLeft,
    label: "Roles",
    staffPerm: "can_roles",
    items: [
      { to: "/button-roles", icon: MousePointer, label: "nav_panels" },
      { to: "/select-roles", icon: List, label: "Select Menu Roles" },
      { to: "/reaction-roles", icon: Smile, label: "nav_rr" },
      { to: "/autorole", icon: UserCheck, label: "Auto Role", feature: "autorole" },
    ],
  },
  {
    key: "utilities",
    icon: Terminal,
    label: "nav_utilities",
    staffPerm: "can_utilities",
    items: [
      { to: "/sticky", icon: Pin, label: "nav_sticky", feature: "sticky" },
      { to: "/autoresponder", icon: MessageCircle, label: "nav_autoResponder", feature: "autoresponder" },
      { to: "/scheduled-messages", icon: Clock, label: "nav_scheduledMessages", feature: "scheduler" },
      { to: "/embeds", icon: Layout, label: "nav_embeds" },
      { to: "/emojis", icon: Smile, label: "nav_emojis" },
      { to: "/forms", icon: ClipboardList, label: "Forms", feature: "forms" },
      { to: "/reminders", icon: Bell, label: "Reminders", feature: "reminders" },
      { to: "/polls", icon: BarChart3, label: "Polls", feature: "polls" },
      { to: "/social-feeds", icon: Rss, label: "Social Feeds", feature: "social_feeds" },
      { to: "/stats-channels", icon: Activity, label: "Stats Channels", feature: "stats_channels" },
    ],
  },
  {
    key: "custom_commands",
    icon: Terminal,
    label: "Custom Commands",
    feature: "custom_commands",
    staffPerm: "can_utilities",
    items: [
      { to: "/custom-commands", icon: Terminal, label: "nav_customCommands", feature: "custom_commands" },
    ],
  },
  {
    key: "ai_chat",
    icon: BrainCircuit,
    label: "AI Chat",
    feature: "ai_chat",
    staffPerm: "can_ai",
    items: [
      { to: "/ai-chat/config", icon: Settings2, label: "AI Config" },
      { to: "/ai-chat/training", icon: BookOpen, label: "Training" },
      { to: "/ai-chat/history", icon: History, label: "History" },
      { to: "/ai-chat/images", icon: Image, label: "Image Gen" },
    ],
  },
  {
    key: "bot_owner",
    icon: Activity,
    label: "nav_botOwner",
    ownerOnly: true,
    items: [
      { to: "/bot-status", icon: Activity, label: "nav_botStatus" },
      { to: "/config/discord", icon: Bot, label: "nav_discordBot" },
      { to: "/premium/plans", icon: Gem, label: "Premium Plans" },
      { to: "/premium/management", icon: Crown, label: "Premium Management" },
      { to: "/premium/config", icon: CreditCard, label: "Premium Payments" },
    ],
  },
];

const queryClient = new QueryClient();

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const { t } = useT();
  const { data: user } = useQuery({
    queryKey: ["auth_me"],
    queryFn: () => fetch("/api/auth/me", { credentials: "include" }).then(res => {
      if (!res.ok) throw new Error("Not logged in");
      return res.json();
    }),
    retry: false
  });

  const { selectedGuildId } = useGuild();

  const { data: features } = useQuery<{ key: string; enabled: boolean }[]>({
    queryKey: ["features", selectedGuildId],
    queryFn: () => apiFetch("/api/features").then(r => r.ok ? r.json() : []),
    enabled: !!selectedGuildId,
    retry: false,
    staleTime: 30_000,
  });
  const { perms, memberRoles } = useStaffAccess();

  useEffect(() => {
    if (memberRoles.length > 0) {
      localStorage.setItem("member_roles", memberRoles.join(","));
    }
  }, [memberRoles]);

  const disabledFeatures = useMemo(() => {
    if (!features) return new Set<string>();
    return new Set(features.filter(f => !f.enabled).map(f => f.key));
  }, [features]);

  const filteredGroups = useMemo(() => {
    return navGroups
      .filter(g => !g.feature || !disabledFeatures.has(g.feature))
      .filter(g => !g.ownerOnly)
      .filter(g => !g.staffPerm || perms[g.staffPerm as keyof typeof perms])
      .map(g => ({
        ...g,
        items: g.items.filter(item => !item.feature || !disabledFeatures.has(item.feature)),
      }))
      .filter(g => g.items.length > 0);
  }, [disabledFeatures, perms]);

  const ownerGroups = useMemo(() => {
    if (!user?.is_owner) return [];
    return navGroups.filter(g => g.ownerOnly);
  }, [user]);

  const NavLink = ({ to, icon: Icon, label, amber }: { to: string; icon: LucideIcon; label: string; amber?: boolean }) => {
    const isActive = location.pathname === to || location.pathname.startsWith(to + "/");
    return (
      <Link
        to={to}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 px-4 py-[9px] rounded-xl text-[13.5px] font-medium transition-all",
          amber
            ? isActive
              ? "text-amber-500 bg-amber-500/10"
              : "text-gray-500 hover:text-amber-500 hover:bg-amber-50"
            : isActive
              ? "text-[#6C5CE7] bg-[#6C5CE7]/10"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
        )}
      >
        <Icon className="w-[18px] h-[18px] shrink-0 opacity-80" />
        {label}
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* ── Logo area ── */}
      <div className="h-16 px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#6C5CE7] flex items-center justify-center">
            <Bot className="w-[18px] h-[18px] text-white" />
          </div>
          <h1 className="font-bold text-[15px] text-gray-900 tracking-tight">Infinity Bot</h1>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-gray-400 hover:text-gray-600 transition-colors p-1 -mr-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* ── Guild selector ── */}
      <div className="px-3 pb-3">
        <GuildSelector />
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll pb-4">
        {!selectedGuildId ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">Select a server to continue</p>
          </div>
        ) : (
        <div className="px-3 space-y-[2px]">
          {/* ── General ── */}
          <div className="sidebar-section-title">General</div>
          <NavLink to="/bot-settings" icon={Settings} label={t("nav_botSettings")} />

          {/* ── Dynamic groups (flat) ── */}
          {filteredGroups.map((group) => (
            <div key={group.key}>
              <div className="sidebar-section-title mt-1">{t(group.label as Parameters<typeof t>[0])}</div>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} icon={item.icon} label={t(item.label as Parameters<typeof t>[0])} />
              ))}
            </div>
          ))}

          {/* ── Owner section ── */}
          {ownerGroups.length > 0 && (
            <>
              <div className="sidebar-section-title mt-1">
                <span className="text-amber-500/70">Owner Only</span>
              </div>
              {ownerGroups.flatMap((g) =>
                g.items.map((item) => (
                  <NavLink key={item.to} to={item.to} icon={item.icon} label={t(item.label as Parameters<typeof t>[0])} amber />
                ))
              )}
            </>
          )}
        </div>
        )}
      </nav>

      {/* ── User profile at bottom ── */}
      {user && (
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <img
                src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`}
                alt=""
                className="w-9 h-9 rounded-full"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.username}</p>
              <p className="text-[11px] text-gray-400">{user.is_owner ? "Bot Owner" : "Staff"}</p>
            </div>
            <button
              onClick={() => {
                fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => {
                  window.location.href = "/login";
                });
              }}
              className="text-gray-300 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-gray-50"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Header ──────────────────────────────────────────────────────────────────── */

function useBreadcrumb() {
  const location = useLocation();
  const { t } = useT();
  return useMemo(() => {
    const path = location.pathname;
    // Find matching group + item
    for (const group of navGroups) {
      for (const item of group.items) {
        if (path === item.to || path.startsWith(item.to + "/")) {
          return {
            group: t(group.label as Parameters<typeof t>[0]),
            page: t(item.label as Parameters<typeof t>[0]),
          };
        }
      }
    }
    // Standalone pages
    if (path === "/bot-settings") return { group: null, page: t("nav_botSettings") };
    if (path === "/profile") return { group: null, page: "Profile" };
    if (path === "/my-plan") return { group: null, page: "My Plan" };
    if (path === "/select-guild") return { group: null, page: "Select Server" };
    if (path === "/backup") return { group: null, page: "Backup" };
    if (path === "/guild-bot") return { group: null, page: "Custom Bot" };
    return { group: null, page: "Dashboard" };
  }, [location.pathname, t]);
}

function Header() {
  const breadcrumb = useBreadcrumb();
  const { hasFeature } = useEntitlements();

  const { data: user } = useQuery({
    queryKey: ["auth_me"],
    queryFn: () => fetch("/api/auth/me", { credentials: "include" }).then(res => {
      if (!res.ok) throw new Error("Not logged in");
      return res.json();
    }),
    retry: false
  });

  return (
    <header className="sticky top-0 z-40 h-[76px] border-b bg-white text-gray-900 backdrop-blur-sm flex items-center justify-between px-6 gap-4">
      {/* Left: Page title + Breadcrumb (Yuri layout) */}
      <div className="flex items-center gap-6 min-w-0">
        <div className="page-title-section">
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{breadcrumb.page}</h2>
          <nav className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-gray-500">Dashboard</span>
            {breadcrumb.group && (
              <>
                <span className="text-xs text-gray-400">/</span>
                <span className="text-xs text-gray-500">{breadcrumb.group}</span>
              </>
            )}
            <span className="text-xs text-gray-400">/</span>
            <span className="text-xs text-primary font-medium">{breadcrumb.page}</span>
          </nav>
        </div>
      </div>

      {/* Right: Search + Theme + Notifications + User */}
      <div className="flex items-center gap-1.5">
        {/* Search */}
        <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-2 text-gray-500 hover:text-gray-900 h-9 px-3 rounded-lg">
          <Search className="w-4 h-4" />
          <span className="text-xs">Search...</span>
          <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg relative text-gray-600 hover:text-gray-900 hover:bg-gray-100">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F94C8E] rounded-full" />
        </Button>

        {/* User dropdown */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-gray-100 transition-colors ml-1">
                <Avatar className="h-8 w-8 ring-2 ring-primary/10">
                  <AvatarImage src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{user.username?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold leading-tight max-w-[100px] truncate text-gray-900">{user.username}</p>
                  <p className="text-[11px] text-gray-500 leading-tight">{user.is_owner ? "Owner" : "Staff"}</p>
                </div>
                <ChevronDown className="h-3 w-3 text-gray-400 hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/my-plan" className="flex items-center gap-2 cursor-pointer">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  My Plan
                </Link>
              </DropdownMenuItem>
              {hasFeature("custom_bot") && (
                <DropdownMenuItem asChild>
                  <Link to="/guild-bot" className="flex items-center gap-2 cursor-pointer">
                    <Bot className="h-4 w-4 text-primary" />
                    Custom Bot
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to="/backup" className="flex items-center gap-2 cursor-pointer">
                  <Database className="h-4 w-4" />
                  Backup
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => {
                  fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => {
                    window.location.href = "/login";
                  });
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────────────── */

function DashboardFooter() {
  return (
    <footer className="border-t py-5 text-center text-xs text-gray-400">
      <div className="flex items-center justify-center gap-6 mb-2">
        <a href="/terms" className="hover:text-primary transition-colors">Terms</a>
        <a href="/privacy" className="hover:text-primary transition-colors">Privacy</a>
        <a href="/refund" className="hover:text-primary transition-colors">Refund</a>
      </div>
      <p>© 2025 Infinity Bot. All rights reserved.</p>
    </footer>
  );
}

/* ── Layout containers ───────────────────────────────────────────────────────── */

function Sidebar() {
  return (
    <div className="w-[265px] h-screen hidden md:flex flex-col fixed left-0 top-0 z-50">
      <SidebarContent />
    </div>
  );
}

function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden border-b bg-white text-gray-900 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[265px] flex flex-col border-0">
            <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
            <div className="flex flex-col h-full overflow-hidden">
              <SidebarContent onClose={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-[#6C5CE7]" />
          <h1 className="font-bold text-base">Infinity Bot</h1>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-600 hover:text-gray-900 hover:bg-gray-100" asChild>
          <Link to="/profile"><User className="w-4 h-4" /></Link>
        </Button>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoading, isError } = useQuery({
    queryKey: ["auth_me"],
    queryFn: () => fetch("/api/auth/me", { credentials: "include" }).then(res => {
      if (!res.ok) throw new Error("Not logged in");
      return res.json();
    }),
    retry: false
  });

  const { selectedGuildId, isLoading: guildLoading } = useGuild();

  if (isLoading || guildLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (isError) return <Navigate to="/login" replace />;

  const isRootRedirect = location.pathname === "/";
  const needsGuild = !selectedGuildId && !isRootRedirect;

  if (!selectedGuildId && isRootRedirect) {
    return <Navigate to="/select-guild" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Desktop sidebar — fixed left */}
      <Sidebar />
      {/* Content wrapper */}
      <div className="flex flex-col md:ml-[265px] min-h-screen min-w-0 overflow-x-hidden">
        {/* Mobile header */}
        <MobileNav />
        {/* Desktop header */}
        <div className="hidden md:block">
          <Header />
        </div>
        {needsGuild && (
          <div className="sticky top-14 md:top-[76px] z-30 flex items-center justify-between gap-3 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-400">
            <span>No server selected</span>
            <button
              onClick={() => navigate("/select-guild")}
              className="shrink-0 rounded-md bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600 transition-colors"
            >
              Select Server
            </button>
          </div>
        )}
        <main className={cn(
          "flex-1 px-[13px] py-4 md:px-6 md:py-5",
          needsGuild && "pointer-events-none opacity-60"
        )}>
          {children}
        </main>
        <DashboardFooter />
      </div>
    </div>
  );
}

function OwnerRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ["auth_me"],
    queryFn: () => fetch("/api/auth/me", { credentials: "include" }).then(res => {
      if (!res.ok) throw new Error("Not logged in");
      return res.json();
    }),
    retry: false,
  });
  if (isLoading) return null;
  if (!user?.is_owner) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function SetupGate() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["setup_status"],
    queryFn: () => fetch("/api/setup/status", { credentials: "include" }).then((res) => {
      if (!res.ok) throw new Error("Failed to load setup status");
      return res.json();
    }),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center">Loading...</div>;
  }

  if (isError || !data) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-destructive font-medium">Cannot connect to server</p>
        <p className="text-sm text-muted-foreground">Server is starting or encountered an error. Try again in a few seconds.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
        >
          Reload
        </button>
      </div>
    );
  }

  if (!data.oauth_configured) {
    return <Suspense fallback={<PageLoader />}><InitialSetup /></Suspense>;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ── Public routes (không cần auth) ── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/commands" element={<PublicCommandsPage />} />
        <Route path="/pricing" element={<PublicPricingPage />} />
        <Route path="/status" element={<PublicStatusPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/refund" element={<RefundPage />} />
        <Route path="/login" element={<Login />} />
        {/* ── Dashboard (cần auth) ── */}
        <Route path="/dashboard" element={<ProtectedAppRoutes root />} />
        <Route path="/*" element={<ProtectedAppRoutes />} />
      </Routes>
    </Suspense>
  );
}

function PageLoader() {
  return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function RouteLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

interface EBState { hasError: boolean; error?: Error }
class PageErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(error: unknown): EBState {
    // Promises thrown by Suspense should NOT be caught here — ignore them
    if (typeof (error as Promise<unknown>)?.then === "function") return { hasError: false };
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    return { hasError: true, error: error instanceof Error ? error : new Error(msg) };
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (typeof (error as Promise<unknown>)?.then === "function") return;
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : "";
    console.error("[PageErrorBoundary]", msg, stack, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <AlertTriangle className="w-8 h-8 text-destructive" />
          <p className="font-semibold text-foreground">Page crashed</p>
          <p className="text-xs text-muted-foreground max-w-xs">{this.state.error?.message}</p>
          <button
            className="text-xs underline text-primary mt-1"
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
          >Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedAppRoutes({ root }: { root?: boolean }) {
  if (root) {
    // /dashboard → redirect sang bot-settings
    return (
      <ProtectedRoute>
        <Navigate to="/bot-settings" replace />
      </ProtectedRoute>
    );
  }
  return (
    <ProtectedRoute>
      <PageErrorBoundary>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
        <Route path="/select-guild" element={<SelectGuildPage />} />
        <Route path="/" element={<Navigate to="/bot-settings" replace />} />
        <Route path="/bot-status" element={<OwnerRoute><BotStatus /></OwnerRoute>} />
        <Route path="/config" element={<Navigate to="/config/discord" replace />} />
        <Route path="/config/prefix" element={<Navigate to="/bot-settings" replace />} />
        <Route path="/config/channels" element={<Navigate to="/bot-settings" replace />} />
        <Route path="/config/voice" element={<Navigate to="/bot-settings" replace />} />
        <Route path="/bot-settings" element={<BotSettings />} />

        <Route path="/config/discord" element={<OwnerRoute><ConfigDiscord /></OwnerRoute>} />
        <Route path="/config/payments" element={<PaymentConfig />} />
        {/* Shop */}
        <Route path="/products" element={<ProductsManager />} />
        <Route path="/products/new" element={<ProductEditPage />} />
        <Route path="/products/:id/edit" element={<ProductEditPage />} />
        <Route path="/orders" element={<OrdersManager />} />
        <Route path="/feedback" element={<FeedbackManager />} />
        <Route path="/coupons" element={<CouponsManager />} />
        <Route path="/coupons/new" element={<CouponEditPage />} />
        <Route path="/coupons/:id/edit" element={<CouponEditPage />} />
        <Route path="/users" element={<UsersManager />} />
        <Route path="/config/shop-channels" element={<ShopChannels />} />
        <Route path="/shop-stats" element={<ShopStats />} />
        <Route path="/milestones" element={<SpendingMilestones />} />
        <Route path="/flash-sales" element={<FlashSales />} />
        <Route path="/inventory" element={<InventoryManager />} />
        {/* Community */}
        <Route path="/warnings" element={<WarningsManager />} />
        <Route path="/moderation" element={<ModerationPage />} />
        <Route path="/giveaways" element={<GiveawaysManager />} />
        <Route path="/invites" element={<InvitesPage />} />
        {/* Roles */}
        <Route path="/button-roles" element={<ButtonRoles />} />
        <Route path="/button-roles/new" element={<ButtonRoleEditPage />} />
        <Route path="/button-roles/:id/edit" element={<ButtonRoleEditPage />} />
        <Route path="/select-roles" element={<SelectMenuRoles />} />
        <Route path="/select-roles/new" element={<SelectMenuRoleEditPage />} />
        <Route path="/select-roles/:id/edit" element={<SelectMenuRoleEditPage />} />
        <Route path="/reaction-roles" element={<ReactionRoles />} />
        <Route path="/reaction-roles/new" element={<ReactionRoleEditPage />} />
        <Route path="/reaction-roles/:id/edit" element={<ReactionRoleEditPage />} />
        {/* Moderation */}
        <Route path="/automod" element={<AutoModConfig />} />
        <Route path="/logging" element={<LoggingPage />} />
        {/* Security */}
        <Route path="/backup" element={<BackupPage />} />

        <Route path="/firewall/logs" element={<FirewallLogs />} />
        <Route path="/alerts" element={<AlertsConfig />} />
        {/* Utilities */}
        <Route path="/sticky" element={<StickyManager />} />
        <Route path="/sticky/new" element={<StickyEditPage />} />
        <Route path="/sticky/:id/edit" element={<StickyEditPage />} />
        <Route path="/custom-commands" element={<CustomCommands />} />
        <Route path="/custom-commands/new" element={<CustomCommandEditPage />} />
        <Route path="/custom-commands/:id/edit" element={<CustomCommandEditPage />} />
        <Route path="/ai-chat/config" element={<AIConfigPage />} />
        <Route path="/ai-chat/training" element={<AITrainingPage />} />
        <Route path="/ai-chat/history" element={<AIHistoryPage />} />
        <Route path="/ai-chat/images" element={<AIImageGenPage />} />
        <Route path="/autoresponder" element={<AutoResponder />} />
        <Route path="/autoresponder/new" element={<AutoResponderEditPage />} />
        <Route path="/autoresponder/:id/edit" element={<AutoResponderEditPage />} />
        <Route path="/scheduled-messages" element={<ScheduledMessages />} />
        <Route path="/scheduled-messages/new" element={<ScheduledMessagesEditPage />} />
        <Route path="/scheduled-messages/:id/edit" element={<ScheduledMessagesEditPage />} />
        <Route path="/embeds" element={<EmbedsManager />} />
        <Route path="/emojis" element={<EmojiManager />} />
        {/* Auto Role, Forms, Reminders, Polls, Social Feeds, Stats Channels */}
        <Route path="/autorole" element={<AutoRolePage />} />
        <Route path="/forms" element={<FormsPage />} />
        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="/polls" element={<PollsPage />} />
        <Route path="/social-feeds" element={<SocialFeedsPage />} />
        <Route path="/stats-channels" element={<StatsChannelsPage />} />
        {/* Premium */}
        <Route path="/my-plan" element={<MyPlan />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/premium/config" element={<OwnerRoute><PremiumPaymentConfig /></OwnerRoute>} />
        <Route path="/premium/plans" element={<OwnerRoute><PremiumPlans /></OwnerRoute>} />
        <Route path="/premium/management" element={<OwnerRoute><PremiumManagement /></OwnerRoute>} />
        {/* Owner */}
      </Routes>
      </Suspense>
      </PageErrorBoundary>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <I18nProvider>
          <GuildProvider>
            <SetupGate />
            <Toaster />
          </GuildProvider>
        </I18nProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
