import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { Bot, Settings, ShoppingCart, LayoutDashboard, Menu, LogOut, Tag, Package, Users, Gift, Link2, Palette, MessageSquare, Trophy, ShieldAlert, Pin, ShoppingBag, Ticket, Wrench, ChevronDown, ChevronRight, Hash, CreditCard, Mic, Activity, Smile, FileQuestion, UserCheck, Star, FileText, ClipboardList, Users2, UserCheck2, Hand, UserPlus, ToggleLeft, ListChecks, ScrollText, Loader2, Shield, Clock, Terminal, Database } from "lucide-react";
import { useState, useMemo, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";

// ── Lazy-loaded pages (code-split per route) ─────────────────────────────────
const DashboardHome = lazy(() => import("./pages/DashboardHome").then(m => ({ default: m.DashboardHome })));
const BotConfig = lazy(() => import("./pages/BotConfig").then(m => ({ default: m.BotConfig })));
const ConfigDiscord = lazy(() => import("./pages/ConfigDiscord").then(m => ({ default: m.ConfigDiscord })));
const ConfigPayOS = lazy(() => import("./pages/ConfigPayOS").then(m => ({ default: m.ConfigPayOS })));
const ConfigChannels = lazy(() => import("./pages/ConfigChannels").then(m => ({ default: m.ConfigChannels })));
const ConfigVoice = lazy(() => import("./pages/ConfigVoice").then(m => ({ default: m.ConfigVoice })));
const ProductsManager = lazy(() => import("./pages/ProductsManager").then(m => ({ default: m.ProductsManager })));
const OrdersManager = lazy(() => import("./pages/OrdersManager").then(m => ({ default: m.OrdersManager })));
const CouponsManager = lazy(() => import("./pages/CouponsManager").then(m => ({ default: m.CouponsManager })));
const EmbedsManager = lazy(() => import("./pages/EmbedsManager").then(m => ({ default: m.EmbedsManager })));
const EmojiManager = lazy(() => import("./pages/EmojiManager").then(m => ({ default: m.EmojiManager })));
const FeedbackManager = lazy(() => import("./pages/FeedbackManager").then(m => ({ default: m.FeedbackManager })));
const UsersManager = lazy(() => import("./pages/UsersManager").then(m => ({ default: m.UsersManager })));
const GiveawaysManager = lazy(() => import("./pages/GiveawaysManager").then(m => ({ default: m.GiveawaysManager })));
const InviteTracking = lazy(() => import("./pages/InviteTracking").then(m => ({ default: m.InviteTracking })));
const Leaderboard = lazy(() => import("./pages/Leaderboard").then(m => ({ default: m.Leaderboard })));
const WarningsManager = lazy(() => import("./pages/WarningsManager").then(m => ({ default: m.WarningsManager })));
const StickyManager = lazy(() => import("./pages/StickyManager").then(m => ({ default: m.StickyManager })));
const TicketsPage = lazy(() => import("./pages/TicketsPage").then(m => ({ default: m.TicketsPage })));
const TicketPanels = lazy(() => import("./pages/TicketPanels").then(m => ({ default: m.TicketPanels })));
const TicketConfig = lazy(() => import("./pages/TicketConfig").then(m => ({ default: m.TicketConfig })));
const TicketForms = lazy(() => import("./pages/TicketForms").then(m => ({ default: m.TicketForms })));
const TicketTeams = lazy(() => import("./pages/TicketTeams").then(m => ({ default: m.TicketTeams })));
const TicketFeedback = lazy(() => import("./pages/TicketFeedback").then(m => ({ default: m.TicketFeedback })));
const TicketTranscripts = lazy(() => import("./pages/TicketTranscripts").then(m => ({ default: m.TicketTranscripts })));
const TicketClaiming = lazy(() => import("./pages/TicketClaiming").then(m => ({ default: m.TicketClaiming })));
const WelcomeConfig = lazy(() => import("./pages/WelcomeConfig").then(m => ({ default: m.WelcomeConfig })));
const AutoRoleConfig = lazy(() => import("./pages/AutoRoleConfig").then(m => ({ default: m.AutoRoleConfig })));
const ButtonRoles = lazy(() => import("./pages/ButtonRoles").then(m => ({ default: m.ButtonRoles })));
const SelectMenuRoles = lazy(() => import("./pages/SelectMenuRoles").then(m => ({ default: m.SelectMenuRoles })));
const LoggingConfig = lazy(() => import("./pages/LoggingConfig").then(m => ({ default: m.LoggingConfig })));
const LogViewer = lazy(() => import("./pages/LogViewer").then(m => ({ default: m.LogViewer })));
const StarboardConfig = lazy(() => import("./pages/StarboardConfig").then(m => ({ default: m.StarboardConfig })));
const AutoModConfig = lazy(() => import("./pages/AutoModConfig").then(m => ({ default: m.AutoModConfig })));
const ReactionRoles = lazy(() => import("./pages/ReactionRoles").then(m => ({ default: m.ReactionRoles })));
const CustomCommands = lazy(() => import("./pages/CustomCommands").then(m => ({ default: m.CustomCommands })));
const ScheduledMessages = lazy(() => import("./pages/ScheduledMessages").then(m => ({ default: m.ScheduledMessages })));
const BackupRestore = lazy(() => import("./pages/BackupRestore").then(m => ({ default: m.BackupRestore })));
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const InitialSetup = lazy(() => import("./pages/InitialSetup").then(m => ({ default: m.InitialSetup })));
const BotStatus = lazy(() => import("./pages/BotStatus").then(m => ({ default: m.BotStatus })));
import { cn } from "./lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

interface NavGroup {
  key: string;
  icon: LucideIcon;
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    key: "shop",
    icon: ShoppingBag,
    label: "Shop",
    items: [
      { to: "/products", icon: Package, label: "Sản phẩm" },
      { to: "/orders", icon: ShoppingCart, label: "Đơn hàng" },
      { to: "/coupons", icon: Tag, label: "Coupon" },
      { to: "/users", icon: Users, label: "Người dùng" },
      { to: "/leaderboard", icon: Trophy, label: "Bảng xếp hạng" },
      { to: "/feedback", icon: MessageSquare, label: "Feedback" },
    ],
  },
  {
    key: "ticket",
    icon: Ticket,
    label: "Ticket",
    items: [
      { to: "/tickets", icon: Ticket, label: "Tickets" },
      { to: "/ticket-panels", icon: Palette, label: "Panels" },
      { to: "/ticket-forms", icon: ClipboardList, label: "Forms" },
      { to: "/ticket-teams", icon: Users2, label: "Teams" },
      { to: "/ticket-transcripts", icon: FileText, label: "Transcripts" },
      { to: "/ticket-claiming", icon: UserCheck2, label: "Claiming" },
      { to: "/ticket-feedback", icon: Star, label: "Feedback" },
      { to: "/ticket-config", icon: Settings, label: "Cấu hình" },
    ],
  },
  {
    key: "community",
    icon: Users,
    label: "Cộng đồng",
    items: [
      { to: "/giveaways", icon: Gift, label: "Giveaway" },
      { to: "/invites", icon: Link2, label: "Invite" },
      { to: "/warnings", icon: ShieldAlert, label: "Cảnh cáo" },
      { to: "/starboard", icon: Star, label: "Starboard" },
      { to: "/reaction-roles", icon: Smile, label: "Reaction Roles" },
    ],
  },
  {
    key: "welcome",
    icon: Hand,
    label: "Chào mừng",
    items: [
      { to: "/welcome", icon: MessageSquare, label: "Welcome & Goodbye" },
      { to: "/autorole", icon: UserPlus, label: "Auto Role" },
      { to: "/button-roles", icon: ToggleLeft, label: "Button Roles" },
      { to: "/select-roles", icon: ListChecks, label: "Select Menu Roles" },
    ],
  },
  {
    key: "moderation",
    icon: Shield,
    label: "Kiểm duyệt",
    items: [
      { to: "/automod", icon: Shield, label: "Auto Mod" },
      { to: "/logging", icon: ScrollText, label: "Cấu hình Log" },
      { to: "/logs", icon: Activity, label: "Nhật ký" },
    ],
  },
  {
    key: "utilities",
    icon: Wrench,
    label: "Tiện ích",
    items: [
      { to: "/sticky", icon: Pin, label: "Sticky" },
      { to: "/custom-commands", icon: Terminal, label: "Custom Commands" },
      { to: "/scheduled-messages", icon: Clock, label: "Tin nhắn hẹn giờ" },
      { to: "/embeds", icon: Palette, label: "Embeds" },
      { to: "/emojis", icon: Smile, label: "Emoji & Sticker" },
    ],
  },
  {
    key: "config",
    icon: Settings,
    label: "Cấu hình",
    items: [
      { to: "/config/discord", icon: Bot, label: "Discord Bot" },
      { to: "/config/payos", icon: CreditCard, label: "PayOS" },
      { to: "/config/channels", icon: Hash, label: "Kênh & Quyền" },
      { to: "/config/voice", icon: Mic, label: "Temp Voice" },
      { to: "/backup", icon: Database, label: "Sao lưu & Khôi phục" },
    ],
  },
];

const standaloneItems: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/bot-status", icon: Activity, label: "Trạng thái Bot" },
];

const queryClient = new QueryClient();

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const { data: user } = useQuery({
    queryKey: ["auth_me"],
    queryFn: () => fetch("/api/auth/me", { credentials: "include" }).then(res => {
      if (!res.ok) throw new Error("Not logged in");
      return res.json();
    }),
    retry: false
  });

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
        <h1 className="font-bold text-lg">Infinity Mall</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {/* Standalone: Dashboard */}
        {standaloneItems.slice(0, 1).map((item) => {
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
              {item.label}
            </Link>
          );
        })}

        {/* Grouped nav */}
        {navGroups.map((group) => {
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
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <GroupIcon className="w-4 h-4 shrink-0" />
                  {group.label}
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
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Standalone: Cấu hình Bot */}
        {standaloneItems.slice(1).map((item) => {
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
              {item.label}
            </Link>
          );
        })}
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
        <h1 className="font-bold text-lg">Infinity Mall</h1>
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
  const { isLoading, isError } = useQuery({
    queryKey: ["auth_me"],
    queryFn: () => fetch("/api/auth/me", { credentials: "include" }).then(res => {
      if (!res.ok) throw new Error("Not logged in");
      return res.json();
    }),
    retry: false
  });

  if (isLoading) return <div className="h-screen flex items-center justify-center">Đang tải...</div>;
  if (isError) return <Navigate to="/login" replace />;

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
    return <div className="h-screen flex items-center justify-center">Đang tải...</div>;
  }

  if (isError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-destructive font-medium">Không thể kết nối server</p>
        <p className="text-sm text-muted-foreground">Server đang khởi động hoặc gặp lỗi. Thử lại sau vài giây.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
        >
          Tải lại
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
        <Route path="/login" element={<Login />} />
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

function ProtectedAppRoutes() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/bot-status" element={<BotStatus />} />
        <Route path="/config" element={<BotConfig />} />
        <Route path="/config/discord" element={<ConfigDiscord />} />
        <Route path="/config/payos" element={<ConfigPayOS />} />
        <Route path="/config/channels" element={<ConfigChannels />} />
        <Route path="/config/voice" element={<ConfigVoice />} />
        <Route path="/products" element={<ProductsManager />} />
        <Route path="/orders" element={<OrdersManager />} />
        <Route path="/feedback" element={<FeedbackManager />} />
        <Route path="/coupons" element={<CouponsManager />} />
        <Route path="/users" element={<UsersManager />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/warnings" element={<WarningsManager />} />
        <Route path="/sticky" element={<StickyManager />} />
        <Route path="/giveaways" element={<GiveawaysManager />} />
        <Route path="/invites" element={<InviteTracking />} />
        <Route path="/embeds" element={<EmbedsManager />} />
        <Route path="/emojis" element={<EmojiManager />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/ticket-panels" element={<TicketPanels />} />
        <Route path="/ticket-config" element={<TicketConfig />} />
        <Route path="/ticket-forms" element={<TicketForms />} />
        <Route path="/ticket-teams" element={<TicketTeams />} />
        <Route path="/ticket-feedback" element={<TicketFeedback />} />
        <Route path="/ticket-transcripts" element={<TicketTranscripts />} />
        <Route path="/ticket-claiming" element={<TicketClaiming />} />
        <Route path="/welcome" element={<WelcomeConfig />} />
        <Route path="/autorole" element={<AutoRoleConfig />} />
        <Route path="/button-roles" element={<ButtonRoles />} />
        <Route path="/select-roles" element={<SelectMenuRoles />} />
        <Route path="/logging" element={<LoggingConfig />} />
        <Route path="/logs" element={<LogViewer />} />
        <Route path="/starboard" element={<StarboardConfig />} />
        <Route path="/automod" element={<AutoModConfig />} />
        <Route path="/reaction-roles" element={<ReactionRoles />} />
        <Route path="/custom-commands" element={<CustomCommands />} />
        <Route path="/scheduled-messages" element={<ScheduledMessages />} />
        <Route path="/backup" element={<BackupRestore />} />
      </Routes>
      </Suspense>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SetupGate />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
