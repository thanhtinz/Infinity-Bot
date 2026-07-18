import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import AppShell from "./AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already redirects unauthenticated requests away from /app/*, so this
  // is a defense-in-depth fallback (e.g. if the session cookie expired between
  // the proxy check and this render).
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/app");
  }

  const displayName = user.name?.trim() || user.email;

  return (
    <AppShell displayName={displayName} email={user.email}>
      {children}
    </AppShell>
  );
}
