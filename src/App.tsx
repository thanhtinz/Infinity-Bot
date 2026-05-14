import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { Bot, Settings, ShoppingCart, LayoutDashboard, Menu, LogOut, Tag, Package, Users, Gift, Link2, Palette, MessageSquare, Trophy, ShieldAlert, Pin, ShoppingBag, Ticket, Wrench, ChevronDown, ChevronRight, Hash, CreditCard, Mic, Activity, Smile, FileQuestion, UserCheck, Star, FileText, ClipboardList, Users2, UserCheck2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";

import { DashboardHome } from "./pages/DashboardHome";
import { BotConfig } from "./pages/BotConfig";
import { ConfigDiscord } from "./pages/ConfigDiscord";
import { ConfigPayOS } from "./pages/ConfigPayOS";
import { ConfigChannels } from "./pages/ConfigChannels";
import { ConfigVoice } from "./pages/ConfigVoice";
import { ProductsManager } from "./pages/ProductsManager";
import { OrdersManager } from "./pages/OrdersManager";
import { CouponsManager } from "./pages/CouponsManager";
import { EmbedsManager } from "./pages/EmbedsManager";
import { EmojiManager } from "./pages/EmojiManager";
import { FeedbackManager } from "./pages/FeedbackManager";
import { UsersManager } from "./pages/UsersManager";
import { GiveawaysManager } from "./pages/GiveawaysManager";
import { InviteTracking } from "./pages/InviteTracking";
import { Leaderboard } from "./pages/Leaderboard";
import { WarningsManager } from "./pages/WarningsManager";
import { StickyManager } from "./pages/StickyManager";
import { TicketsPage } from "./pages/TicketsPage";
import { TicketPanels } from "./pages/TicketPanels";
import { TicketConfig } from "./pages/TicketConfig";
import { TicketForms } from "./pages/TicketForms";
import { TicketTeams } from "./pages/TicketTeams";
import { TicketFeedback } from "./pages/TicketFeedback";
import { TicketTranscripts } from "./pages/TicketTranscripts";
import { TicketClaiming } from "./pages/TicketClaiming";
import { Login } from "./pages/Login";
import { InitialSetup } from "./pages/InitialSetup";
import { BotStatus } from "./pages/BotStatus";
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
    ],
  },
  {
    key: "utilities",
    icon: Wrench,
    label: "Tiện ích",
    items: [
      { to: "/sticky", icon: Pin, label: "Sticky" },
      { to: "/embeds", icon: Palette, label: "Embeds" },
      { to: "/emojis", icon: Smile, label: "Emoji" },
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
    retry: false,
  });

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center">Đang tải...</div>;
  }

  if (isError) {
    return <InitialSetup />;
  }

  if (!data.oauth_configured) {
    return <InitialSetup />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<ProtectedAppRoutes />} />
    </Routes>
  );
}

function ProtectedAppRoutes() {
  return (
    <ProtectedRoute>
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
      </Routes>
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
