import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { Bot, Settings, ShoppingCart, LayoutDashboard, Menu, LogOut, Tag, Package, Users, Gift, Link2, Palette, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";

import { DashboardHome } from "./pages/DashboardHome";
import { BotConfig } from "./pages/BotConfig";
import { ProductsManager } from "./pages/ProductsManager";
import { OrdersManager } from "./pages/OrdersManager";
import { CouponsManager } from "./pages/CouponsManager";
import { EmbedsManager } from "./pages/EmbedsManager";
import { FeedbackManager } from "./pages/FeedbackManager";
import { UsersManager } from "./pages/UsersManager";
import { GiveawaysManager } from "./pages/GiveawaysManager";
import { InviteTracking } from "./pages/InviteTracking";
import { Login } from "./pages/Login";
import { InitialSetup } from "./pages/InitialSetup";
import { cn } from "./lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/config", icon: Settings, label: "Cấu hình Bot" },
    { to: "/products", icon: Package, label: "Sản phẩm" },
    { to: "/orders", icon: ShoppingCart, label: "Đơn hàng" },
    { to: "/feedback", icon: MessageSquare, label: "Feedback" },
    { to: "/coupons", icon: Tag, label: "Coupon" },
    { to: "/users", icon: Users, label: "Người dùng" },
    { to: "/giveaways", icon: Gift, label: "Giveaway" },
    { to: "/invites", icon: Link2, label: "Invite" },
    { to: "/embeds", icon: Palette, label: "Embeds" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b flex items-center gap-2">
        <Bot className="w-6 h-6 text-primary" />
        <h1 className="font-bold text-lg">Infinity Mall</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors",
              location.pathname === item.to && "bg-accent text-accent-foreground font-medium"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        ))}
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
    <div className="flex min-h-screen bg-background text-foreground flex-col md:flex-row">
      <MobileNav />
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8">
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
        <Route path="/config" element={<BotConfig />} />
        <Route path="/products" element={<ProductsManager />} />
        <Route path="/orders" element={<OrdersManager />} />
        <Route path="/feedback" element={<FeedbackManager />} />
        <Route path="/coupons" element={<CouponsManager />} />
        <Route path="/users" element={<UsersManager />} />
        <Route path="/giveaways" element={<GiveawaysManager />} />
        <Route path="/invites" element={<InviteTracking />} />
        <Route path="/embeds" element={<EmbedsManager />} />
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
