import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { Bot, Settings, ShoppingCart, Menu, LogOut, Tag, Package, Users, Gift, Link2, Palette, MessageSquare, Trophy, ShieldAlert, Pin, ShoppingBag, Wrench, ChevronDown, ChevronRight, Hash, CreditCard, Activity, Smile, Star, UserCheck2, UserPlus, ToggleLeft, ListChecks, ScrollText, Loader2, Shield, Clock, Terminal, Database, ToggleRight, MessageCircleReply } from "lucide-react";
import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { GuildProvider, useGuild } from "@/contexts/GuildContext";
import { GuildSelector } from "@/components/GuildSelector";
import { I18nProvider, useT } from "@/i18n";

// ── Lazy-loaded pages (code-split per route) ─────────────────────────────────
const ConfigDiscord = lazy(() => import("./pages/ConfigDiscord").then(m => ({ default: m.ConfigDiscord })));
const ConfigPayOS = lazy(() => import("./pages/ConfigPayOS").then(m => ({ default: m.ConfigPayOS })));
const ConfigChannels = lazy(() => import("./pages/ConfigChannels").then(m => ({ default: m.ConfigChannels })));
const BotSettings = lazy(() => import("./pages/BotSettings").then(m => ({ default: m.BotSettings })));
const ProductsManager = lazy(() => import("./pages/ProductsManager").then(m => ({ default: m.ProductsManager })));
const OrdersManager = lazy(() => import("./pages/OrdersManager").then(m => ({ default: m.OrdersManager })));
const CouponsManager = lazy(() => import("./pages/CouponsManager").then(m => ({ default: m.CouponsManager })));
const EmbedsManager = lazy(() => import("./pages/EmbedsManager").then(m => ({ default: m.EmbedsManager })));
const EmojiManager = lazy(() => import("./pages/EmojiManager").then(m => ({ default: m.EmojiManager })));
const FeedbackManager = lazy(() => import("./pages/FeedbackManager").then(m => ({ default: m.FeedbackManager })));
const UsersManager = lazy(() => import("./pages/UsersManager").then(m => ({ default: m.UsersManager })));
const GiveawaysManager = lazy(() => import("./pages/GiveawaysManager").then(m => ({ default: m.GiveawaysManager })));
const InviteTracking = lazy(() => import("./pages/InviteTracking").then(m => ({ default: m.InviteTracking })));
const WarningsManager = lazy(() => import("./pages/WarningsManager").then(m => ({ default: m.WarningsManager })));
const ModerationManager = lazy(() => import("./pages/ModerationManager").then(m => ({ default: m.ModerationManager })));
const StickyManager = lazy(() => import("./pages/StickyManager").then(m => ({ default: m.StickyManager })));
const StickyEditPage = lazy(() => import("./pages/sticky/StickyEditPage").then(m => ({ default: m.StickyEditPage })));
const CouponEditPage = lazy(() => import("./pages/coupons/CouponEditPage").then(m => ({ default: m.CouponEditPage })));
const ProductEditPage = lazy(() => import("./pages/products/ProductEditPage").then(m => ({ default: m.ProductEditPage })));
const AutoRoleConfig = lazy(() => import("./pages/AutoRoleConfig").then(m => ({ default: m.AutoRoleConfig })));
const ButtonRoles = lazy(() => import("./pages/ButtonRoles").then(m => ({ default: m.ButtonRoles })));
const SelectMenuRoles = lazy(() => import("./pages/SelectMenuRoles").then(m => ({ default: m.SelectMenuRoles })));
const LoggingConfig = lazy(() => import("./pages/LoggingConfig").then(m => ({ default: m.LoggingConfig })));
const LogViewer = lazy(() => import("./pages/LogViewer").then(m => ({ default: m.LogViewer })));
const StarboardConfig = lazy(() => import("./pages/StarboardConfig").then(m => ({ default: m.StarboardConfig })));
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
const BackupRestore = lazy(() => import("./pages/BackupRestore").then(m => ({ default: m.BackupRestore })));
const ServerBackup = lazy(() => import("./pages/ServerBackup").then(m => ({ default: m.ServerBackup })));
const VerificationManager = lazy(() => import("./pages/VerificationManager").then(m => ({ default: m.VerificationManager })));
const SecurityConfig = lazy(() => import("./pages/SecurityConfig").then(m => ({ default: m.SecurityConfig })));
const VerifyPage = lazy(() => import("./pages/VerifyPage").then(m => ({ default: m.VerifyPage })));
const SelectGuildPage = lazy(() => import("./pages/SelectGuildPage").then(m => ({ default: m.SelectGuildPage })));
const Features = lazy(() => import("./pages/Features"));
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const InitialSetup = lazy(() => import("./pages/InitialSetup").then(m => ({ default: m.InitialSetup })));
const BotStatus = lazy(() => import("./pages/BotStatus").then(m => ({ default: m.BotStatus })));
const LandingPage = lazy(() => import("./pages/LandingPage").then(m => ({ default: m.LandingPage })));
const PublicCommandsPage = lazy(() => import("./pages/PublicCommandsPage").then(m => ({ default: m.PublicCommandsPage })));
const PublicPricingPage = lazy(() => import("./pages/PublicPricingPage").then(m => ({ default: m.PublicPricingPage })));
const PublicStatusPage = lazy(() => import("./pages/PublicStatusPage").then(m => ({ default: m.PublicStatusPage })));
const ShopChannels = lazy(() => import("./pages/ShopChannels").then(m => ({ default: m.ShopChannels })));
const ShopStats = lazy(() => import("./pages/ShopStats").then(m => ({ default: m.ShopStats })));
import { cn } from "./lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
    icon: ShoppingBag,
    label: "Shop",
    feature: "shop",
    items: [
      { to: "/products", icon: Package, label: "nav_products" },
      { to: "/orders", icon: ShoppingCart, label: "nav_orders" },
      { to: "/coupons", icon: Tag, label: "nav_coupons" },
      { to: "/users", icon: Users, label: "nav_users" },
      { to: "/shop-stats", icon: Activity, label: "nav_shopStats" },
      { to: "/feedback", icon: MessageSquare, label: "nav_feedback" },
      { to: "/config/shop-channels", icon: Hash, label: "nav_shopChannels", feature: "shop" },
    ],
  },
  {
    key: "ticket",
    icon: Users,
    label: "Roles",
    items: [
      { to: "/autorole", icon: UserPlus, label: "Auto Role" },
      { to: "/button-roles", icon: ToggleLeft, label: "nav_panels" },
      { to: "/select-roles", icon: ListChecks, label: "Select Menu Roles" },
      { to: "/reaction-roles", icon: Smile, label: "nav_rr" },
    ],
  },
  {
    key: "community",
    icon: Users,
    label: "nav_community",
    items: [
      { to: "/giveaways", icon: Gift, label: "nav_giveaway", feature: "giveaway" },
      { to: "/invites", icon: Link2, label: "nav_invite", feature: "invite_tracking" },
      { to: "/warnings", icon: ShieldAlert, label: "nav_warnings", feature: "moderation" },
      { to: "/starboard", icon: Star, label: "nav_starboard", feature: "starboard" },
    ],
  },
  {
    key: "moderation",
    icon: Shield,
    label: "nav_moderation",
    feature: "moderation",
    items: [
      { to: "/moderation", icon: Shield, label: "nav_modCases" },
      { to: "/automod", icon: Shield, label: "nav_automod" },
      { to: "/logging", icon: ScrollText, label: "nav_loggingConfig" },
      { to: "/logs", icon: Activity, label: "nav_logging" },
    ],
  },
  {
    key: "security",
    icon: ShieldAlert,
    label: "nav_security",
    items: [
      { to: "/verification", icon: UserCheck2, label: "nav_verification" },
      { to: "/server-backup", icon: Database, label: "nav_serverBackup" },
      { to: "/security-config", icon: Shield, label: "nav_securityConfig" },
    ],
  },
  {
    key: "utilities",
    icon: Wrench,
    label: "nav_utilities",
    items: [
      { to: "/sticky", icon: Pin, label: "nav_sticky", feature: "sticky" },
      { to: "/custom-commands", icon: Terminal, label: "nav_customCommands", feature: "custom_commands" },
      { to: "/autoresponder", icon: MessageCircleReply, label: "nav_autoResponder", feature: "autoresponder" },
      { to: "/scheduled-messages", icon: Clock, label: "nav_scheduledMessages", feature: "scheduler" },
      { to: "/embeds", icon: Palette, label: "nav_embeds" },
      { to: "/emojis", icon: Smile, label: "nav_emojis" },
    ],
  },
  {
    key: "config",
    icon: Settings,
    label: "nav_botSettings",
    items: [
      { to: "/bot-settings", icon: Settings, label: "nav_botSettings" },
      { to: "/config/payos", icon: CreditCard, label: "nav_payos", feature: "shop" },
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
      { to: "/backup", icon: Database, label: "nav_backup" },
    ],
  },
];

const standaloneItems = [
  { to: "/features", icon: ToggleRight, label: "nav_features" as const },
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
        {/* Grouped nav */}
        {filteredGroups.map((group) => {
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

        {/* Standalone: Features */}
        {standaloneItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors",
                location.pathname === item.to && "bg-accent text-accent-foreground font-medium"
              )}
            >
              <Icon className="w-4 h-4" />
              {t(item.label)}
            </Link>
          );
        })}

        {/* Owner-only: Bot Management — always at bottom */}
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
        </>
        )}
      </nav>

      {user && (
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-4">
            <Avatar>
              <AvatarImage src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} />
              <AvatarFallback>{user.username?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user.is_owner ? "Owner" : "Admin"}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-destructive" onClick={() => {
            fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => {
              window.location.href = "/login";
            });
          }}>
            <LogOut className="w-4 h-4 mr-2" />
            Đăng xuất
          </Button>
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

  // Một số route owner không cần guild
  const guildFreeRoutes = ["/bot-status", "/backup", "/config/discord", "/server-backup", "/security-config"];
  if (!selectedGuildId && !guildFreeRoutes.includes(location.pathname)) {
    return <Navigate to="/select-guild" replace />;
  }
  const isFullscreenEditor = location.pathname === "/leveling/rank-card-editor";
  if (isFullscreenEditor) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground flex-col md:flex-row overflow-x-hidden">
      <MobileNav />
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8 min-w-0 overflow-x-hidden">
        {children}
      </main>
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
      <Suspense fallback={<RouteLoader />}>
        <Routes>
        <Route path="/select-guild" element={<SelectGuildPage />} />
        <Route path="/" element={<Navigate to="/bot-settings" replace />} />
        <Route path="/bot-status" element={<OwnerRoute><BotStatus /></OwnerRoute>} />
        <Route path="/features" element={<Features />} />
        <Route path="/config" element={<Navigate to="/config/discord" replace />} />
        <Route path="/config/prefix" element={<Navigate to="/bot-settings" replace />} />
        <Route path="/config/channels" element={<Navigate to="/bot-settings" replace />} />
        <Route path="/config/voice" element={<Navigate to="/bot-settings" replace />} />
        <Route path="/bot-settings" element={<BotSettings />} />
        <Route path="/config/discord" element={<OwnerRoute><ConfigDiscord /></OwnerRoute>} />
        <Route path="/config/payos" element={<ConfigPayOS />} />
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
        {/* Community */}
        <Route path="/warnings" element={<WarningsManager />} />
        <Route path="/moderation" element={<ModerationManager />} />
        <Route path="/giveaways" element={<GiveawaysManager />} />
        <Route path="/invites" element={<InviteTracking />} />
        <Route path="/starboard" element={<StarboardConfig />} />
        {/* Roles */}
        <Route path="/autorole" element={<AutoRoleConfig />} />
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
        <Route path="/logging" element={<LoggingConfig />} />
        <Route path="/logs" element={<LogViewer />} />
        {/* Security */}
        <Route path="/verification" element={<VerificationManager />} />
        <Route path="/server-backup" element={<OwnerRoute><ServerBackup /></OwnerRoute>} />
        <Route path="/security-config" element={<OwnerRoute><SecurityConfig /></OwnerRoute>} />
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
        {/* Owner */}
        <Route path="/backup" element={<OwnerRoute><BackupRestore /></OwnerRoute>} />
      </Routes>
      </Suspense>
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
