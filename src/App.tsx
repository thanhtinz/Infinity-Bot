import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Bot, Settings, ShoppingCart, Menu, LogOut, Tag, Package, Users, Gift, MessageSquare, Trophy, ShieldAlert, Pin, ChevronDown, ChevronRight, Hash, CreditCard, Activity, Smile, UserPlus, ToggleLeft, Loader2, Shield, Clock, Terminal, Database, FileText, Bell, Crown, Gem, BarChart, BarChart3, AlertTriangle, CheckCircle, MousePointer, List, MessageCircle, Layout, UserCog, Lock, Zap, Warehouse } from "lucide-react";
import { useState, useMemo, useEffect, lazy, Suspense, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { GuildProvider, useGuild } from "@/contexts/GuildContext";
import { GuildSelector } from "@/components/GuildSelector";
import { I18nProvider, useT } from "@/i18n";

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
const SecurityConfig = lazy(() => import("./pages/SecurityConfig").then(m => ({ default: m.SecurityConfig })));
const FirewallLogs = lazy(() => import("./pages/firewall/FirewallLogs").then(m => ({ default: m.FirewallLogs })));
const AlertsConfig = lazy(() => import("./pages/AlertsConfig").then(m => ({ default: m.AlertsConfig })));
const VerificationPage = lazy(() => import("./pages/verification/VerificationPage"));
const VerifyMembersStandalonePage = lazy(() => import("./pages/verification/VerifyMembersPage").then(m => ({ default: m.VerifyMembersPage })));
const VerifyStatsPage = lazy(() => import("./pages/verification/VerifyStatsPage"));
const ModerationPage = lazy(() => import("./pages/moderation/ModerationPage"));
const LoggingPage = lazy(() => import("./pages/LoggingPage"));
const InvitesPage = lazy(() => import("./pages/invites/InvitesPage"));
const BackupPage = lazy(() => import("./pages/backup/BackupPage").then(m => ({ default: m.BackupPage })));
const VerifyPage = lazy(() => import("./pages/VerifyPage").then(m => ({ default: m.VerifyPage })));
const SelectGuildPage = lazy(() => import("./pages/SelectGuildPage").then(m => ({ default: m.SelectGuildPage })));
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const InitialSetup = lazy(() => import("./pages/InitialSetup").then(m => ({ default: m.InitialSetup })));
const BotStatus = lazy(() => import("./pages/BotStatus").then(m => ({ default: m.BotStatus })));
const LandingPage = lazy(() => import("./pages/LandingPage").then(m => ({ default: m.LandingPage })));
const PublicCommandsPage = lazy(() => import("./pages/PublicCommandsPage").then(m => ({ default: m.PublicCommandsPage })));
const PublicPricingPage = lazy(() => import("./pages/PublicPricingPage").then(m => ({ default: m.PublicPricingPage })));
const PublicStatusPage = lazy(() => import("./pages/PublicStatusPage").then(m => ({ default: m.PublicStatusPage })));
const ShopChannels = lazy(() => import("./pages/ShopChannels").then(m => ({ default: m.ShopChannels })));
const ShopStats = lazy(() => import("./pages/ShopStats").then(m => ({ default: m.ShopStats })));
const FlashSales = lazy(() => import("./pages/FlashSales").then(m => ({ default: m.FlashSales })));
const InventoryManager = lazy(() => import("./pages/InventoryManager").then(m => ({ default: m.InventoryManager })));
const SpendingMilestones = lazy(() => import("./pages/SpendingMilestones"));
const StaffPermissions = lazy(() => import("./pages/StaffPermissions").then(m => ({ default: m.StaffPermissions })));
const GuildBotConfig = lazy(() => import("./pages/GuildBotConfig").then(m => ({ default: m.GuildBotConfig })));
const PremiumPaymentConfig = lazy(() => import("./pages/PremiumPaymentConfig").then(m => ({ default: m.PremiumPaymentConfig })));
const PremiumPlans = lazy(() => import("./pages/PremiumPlans").then(m => ({ default: m.PremiumPlans })));
const PremiumManagement = lazy(() => import("./pages/PremiumManagement").then(m => ({ default: m.PremiumManagement })));
const MyPlan = lazy(() => import("./pages/MyPlan").then(m => ({ default: m.MyPlan })));
import { cn } from "./lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEntitlements } from "@/hooks/useEntitlements";

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
}

const navGroups: NavGroup[] = [
  {
    key: "shop",
    icon: Package,
    label: "Shop",
    feature: "shop",
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
    items: [
      { to: "/verification", icon: CheckCircle, label: "Verification" },
      { to: "/verification/members", icon: Users, label: "Verify Menber" },
      { to: "/verification/stats", icon: BarChart3, label: "Verify Stats" },
      { to: "/firewall/logs", icon: ShieldAlert, label: "Firewall Logs" },
      { to: "/alerts", icon: Bell, label: "Server Alerts" },
      { to: "/staff-permissions", icon: UserCog, label: "Staff Permissions" },
    ],
  },
  {
    key: "roles",
    icon: ToggleLeft,
    label: "Roles",
    items: [
      { to: "/button-roles", icon: MousePointer, label: "nav_panels" },
      { to: "/select-roles", icon: List, label: "Select Menu Roles" },
      { to: "/reaction-roles", icon: Smile, label: "nav_rr" },
    ],
  },
  {
    key: "utilities",
    icon: Terminal,
    label: "nav_utilities",
    items: [
      { to: "/sticky", icon: Pin, label: "nav_sticky", feature: "sticky" },
      { to: "/autoresponder", icon: MessageCircle, label: "nav_autoResponder", feature: "autoresponder" },
      { to: "/scheduled-messages", icon: Clock, label: "nav_scheduledMessages", feature: "scheduler" },
      { to: "/embeds", icon: Layout, label: "nav_embeds" },
      { to: "/emojis", icon: Smile, label: "nav_emojis" },
    ],
  },
  {
    key: "custom_commands",
    icon: Terminal,
    label: "Custom Commands",
    feature: "custom_commands",
    items: [
      { to: "/custom-commands", icon: Terminal, label: "nav_customCommands", feature: "custom_commands" },
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
      { to: "/security-config", icon: Lock, label: "Security Config" },
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

  const { hasFeature } = useEntitlements();

  const { data: features } = useQuery<{ key: string; enabled: boolean }[]>({
    queryKey: ["features"],
    queryFn: () => fetch("/api/features", { credentials: "include" }).then(r => r.ok ? r.json() : []),
    retry: false,
    staleTime: 30_000,
  });

  const { selectedGuildId } = useGuild();

  const disabledFeatures = useMemo(() => {
    if (!features) return new Set<string>();
    return new Set(features.filter(f => !f.enabled).map(f => f.key));
  }, [features]);

  // Filter navGroups based on enabled features
  const filteredGroups = useMemo(() => {
    return navGroups
      .filter(g => !g.feature || !disabledFeatures.has(g.feature))
      .filter(g => !g.ownerOnly)
      .map(g => ({
        ...g,
        items: g.items.filter(item => !item.feature || !disabledFeatures.has(item.feature)),
      }))
      .filter(g => g.items.length > 0);
  }, [disabledFeatures, user]);

  const ownerGroups = useMemo(() => {
    if (!user?.is_owner) return [];
    return navGroups.filter(g => g.ownerOnly);
  }, [user]);

  // Determine which groups should be open by default based on current path
  const defaultOpenGroups = useMemo(() => {
    const open = new Set<string>();
    for (const group of navGroups) {
      if (group.items.some((item) => item.to === location.pathname)) {
        open.add(group.key);
      }
    }
    return open;
  }, [location.pathname]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(defaultOpenGroups);

  // Auto-open the group containing the current route on navigation
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      for (const key of defaultOpenGroups) next.add(key);
      return next;
    });
  }, [defaultOpenGroups]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b flex items-center gap-2">
        <Bot className="w-6 h-6 text-primary" />
        <h1 className="font-bold text-lg">Infinity Bot</h1>
      </div>

      <GuildSelector />
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {!selectedGuildId ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Select a server to continue</p>
          </div>
        ) : (
        <>
        {/* Bot Settings — standalone top link */}
        <Link
          to="/bot-settings"
          onClick={onClose}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            location.pathname === "/bot-settings"
              ? "bg-primary text-primary-foreground"
              : "text-foreground/80 hover:bg-accent/40 hover:text-foreground"
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {t("nav_botSettings")}
        </Link>

        {/* Grouped nav */}
        {filteredGroups.map((group) => {
          const isOpen = openGroups.has(group.key);
          const isActive = group.items.some((item) => item.to === location.pathname);
          const GroupIcon = group.icon;

          // Single-item group → render as direct link (no collapsible)
          if (group.items.length === 1) {
            const item = group.items[0];
            const ItemIcon = item.icon;
            const isItemActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={group.key}
                to={item.to}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isItemActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-accent/40 hover:text-foreground"
                )}
              >
                <ItemIcon className="w-4 h-4 shrink-0" />
                {t(group.label as Parameters<typeof t>[0])}
              </Link>
            );
          }

          return (
            <div key={group.key}>
              <button
                onClick={() => toggleGroup(group.key)}
                className={cn(
                  "flex items-center justify-between w-full px-3 py-2 text-sm font-medium cursor-pointer rounded-md transition-colors",
                  isActive
                    ? "bg-accent/60 text-foreground"
                    : "text-foreground/80 hover:bg-accent/40 hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <GroupIcon className="w-4 h-4 shrink-0" />
                  {t(group.label as Parameters<typeof t>[0])}
                </span>
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                )}
              </button>
              {isOpen && (
                <div className="mt-0.5 ml-3 pl-3 border-l border-border space-y-0.5">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isItemActive = location.pathname === item.to;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                          isItemActive
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <ItemIcon className="w-3.5 h-3.5 shrink-0" />
                        {t(item.label as Parameters<typeof t>[0])}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Owner-only: Bot Management — always at bottom, visually separated */}
        {ownerGroups.length > 0 && (
          <div className="mt-4 pt-3 border-t-2 border-dashed border-amber-500/40">
            <div className="flex items-center gap-2 px-3 mb-2">
              <div className="h-px flex-1 bg-amber-500/30" />
              <span className="text-[10px] font-semibold tracking-widest uppercase text-amber-500/70 select-none">
                Owner
              </span>
              <div className="h-px flex-1 bg-amber-500/30" />
            </div>
          </div>
        )}
        {ownerGroups.map((group) => {
          const isOpen = openGroups.has(group.key);
          const isActive = group.items.some((item) => item.to === location.pathname);
          const GroupIcon = group.icon;
          return (
            <div key={group.key}>
              <button
                onClick={() => toggleGroup(group.key)}
                className={cn(
                  "flex items-center justify-between w-full px-3 py-2 text-sm font-medium cursor-pointer rounded-md transition-colors",
                  isActive
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "text-amber-700/70 dark:text-amber-400/60 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <GroupIcon className="w-4 h-4 shrink-0" />
                  {t(group.label as Parameters<typeof t>[0])}
                </span>
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                )}
              </button>
              {isOpen && (
                <div className="mt-0.5 ml-3 pl-3 border-l border-amber-500/30 space-y-0.5">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isItemActive = location.pathname === item.to;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                          isItemActive
                            ? "bg-amber-500 text-white font-medium"
                            : "text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
                        )}
                      >
                        <ItemIcon className="w-3.5 h-3.5 shrink-0" />
                        {t(item.label as Parameters<typeof t>[0])}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        </>
        )}
      </nav>

      {user && (
        <div className="p-4 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full rounded-lg px-2 py-2 hover:bg-accent transition-colors text-left">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} />
                  <AvatarFallback>{user.username?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="overflow-hidden flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.username}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.is_owner ? "Owner" : "Admin"}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
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
        </div>
      )}
    </div>
  );
}

function Sidebar() {
  return (
    <div className="w-64 border-r bg-card h-screen hidden md:flex flex-col fixed left-0 top-0">
      <SidebarContent />
    </div>
  );
}

function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden border-b bg-card p-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <Bot className="w-6 h-6 text-primary" />
        <h1 className="font-bold text-lg">Infinity Bot</h1>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="w-6 h-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 flex flex-col">
          <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
          <div className="flex flex-col h-full overflow-hidden">
            <SidebarContent onClose={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
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

  if (isLoading || guildLoading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (isError) return <Navigate to="/login" replace />;

  // Only redirect to /select-guild when on the root "/" path
  const isRootRedirect = location.pathname === "/";
  const needsGuild = !selectedGuildId && !isRootRedirect;

  // For root path with no guild, redirect to select-guild
  if (!selectedGuildId && isRootRedirect) {
    return <Navigate to="/select-guild" replace />;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground flex-col md:flex-row overflow-x-hidden">
      <MobileNav />
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-64 min-w-0 overflow-x-hidden">
        {needsGuild && (
          <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-400">
            <span>No server selected</span>
            <button
              onClick={() => navigate("/select-guild")}
              className="shrink-0 rounded-md bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600 transition-colors"
            >
              Select Server
            </button>
          </div>
        )}
        <main className={`flex-1 p-4 md:p-8 ${needsGuild ? "pointer-events-none opacity-60" : ""}`}>
          {children}
        </main>
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
        <Route path="/login" element={<Login />} />
        <Route path="/verify/:guildId" element={<VerifyPage />} />
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
    return { hasError: true, error: error instanceof Error ? error : new Error(String(error)) };
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (typeof (error as Promise<unknown>)?.then === "function") return;
    console.error("[PageErrorBoundary]", error, info);
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
        <Route path="/guild-bot" element={<GuildBotConfig />} />
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
        <Route path="/verification" element={<VerificationPage />} />
        <Route path="/verification/members" element={<VerifyMembersStandalonePage />} />
        <Route path="/verification/stats" element={<VerifyStatsPage />} />
        <Route path="/backup" element={<BackupPage />} />
        <Route path="/security-config" element={<OwnerRoute><SecurityConfig /></OwnerRoute>} />
        <Route path="/firewall/logs" element={<FirewallLogs />} />
        <Route path="/alerts" element={<AlertsConfig />} />
        <Route path="/staff-permissions" element={<StaffPermissions />} />
        {/* Utilities */}
        <Route path="/sticky" element={<StickyManager />} />
        <Route path="/sticky/new" element={<StickyEditPage />} />
        <Route path="/sticky/:id/edit" element={<StickyEditPage />} />
        <Route path="/custom-commands" element={<CustomCommands />} />
        <Route path="/custom-commands/new" element={<CustomCommandEditPage />} />
        <Route path="/custom-commands/:id/edit" element={<CustomCommandEditPage />} />
        <Route path="/autoresponder" element={<AutoResponder />} />
        <Route path="/autoresponder/new" element={<AutoResponderEditPage />} />
        <Route path="/autoresponder/:id/edit" element={<AutoResponderEditPage />} />
        <Route path="/scheduled-messages" element={<ScheduledMessages />} />
        <Route path="/scheduled-messages/new" element={<ScheduledMessagesEditPage />} />
        <Route path="/scheduled-messages/:id/edit" element={<ScheduledMessagesEditPage />} />
        <Route path="/embeds" element={<EmbedsManager />} />
        <Route path="/emojis" element={<EmojiManager />} />
        {/* Premium */}
        <Route path="/my-plan" element={<MyPlan />} />
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
