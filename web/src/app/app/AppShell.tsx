"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/app/chat", label: "Chat", icon: "\u{1F4AC}" },
  { href: "/app/code", label: "Code", icon: "\u{1F5A5}\u{FE0F}" },
  { href: "/app/settings", label: "Cài đặt", icon: "\u{2699}\u{FE0F}" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-accent text-accent-foreground"
                : "text-foreground hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserSummary({ label, sub }: { label: string; sub?: string }) {
  const initial = label.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex items-center gap-3 overflow-hidden">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
        {initial}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        {sub ? <p className="truncate text-xs text-muted">{sub}</p> : null}
      </div>
    </div>
  );
}

export default function AppShell({
  displayName,
  email,
  children,
}: {
  displayName: string;
  email: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  const subLabel = displayName !== email ? email : undefined;

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      {/* Mobile topbar */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <button
          type="button"
          aria-label="Mở menu điều hướng"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        >
          ☰
        </button>
        <Link href="/app" className="text-base font-semibold tracking-tight">
          Infinity
        </Link>
        <div className="h-10 w-10" aria-hidden="true" />
      </header>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 bg-surface p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold tracking-tight">Infinity</span>
              <button
                type="button"
                aria-label="Đóng menu"
                onClick={() => setDrawerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-black/5 dark:hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
              <UserSummary label={displayName} sub={subLabel} />
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/10"
              >
                {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-border bg-surface p-4 md:flex">
        <Link href="/app" className="px-1 text-lg font-semibold tracking-tight">
          Infinity
        </Link>
        <NavLinks pathname={pathname} />
        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
          <UserSummary label={displayName} sub={subLabel} />
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/10"
          >
            {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
