/**
 * Yuri Admin Theme — Shared Layout Components
 * 
 * Reusable building blocks for consistent Yuri-style pages.
 * Import these in every dashboard page for uniform look.
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════════
   PageContainer — wraps entire page content
   ═══════════════════════════════════════════════════════════════════════════════ */
interface PageContainerProps {
  children: ReactNode;
  /** max-w-3xl (forms), max-w-5xl (stats), max-w-7xl (tables), or "full" */
  size?: "sm" | "md" | "lg" | "full";
  className?: string;
}

export function PageContainer({ children, size = "lg", className }: PageContainerProps) {
  const maxW = {
    sm: "max-w-3xl",
    md: "max-w-5xl",
    lg: "max-w-7xl",
    full: "",
  }[size];

  return (
    <div className={cn("space-y-6", maxW, className)}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PageHeader — Yuri-style page header with optional actions
   ═══════════════════════════════════════════════════════════════════════════════ */
interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: ReactNode;       // right-side action buttons
  className?: string;
}

export function PageHeader({ title, description, icon: Icon, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-[18px] h-[18px] text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {children}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SectionCard — Yuri-style card with colored left accent (optional)
   ═══════════════════════════════════════════════════════════════════════════════ */
interface SectionCardProps {
  children: ReactNode;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  accent?: "primary" | "secondary" | "amber" | "emerald" | "destructive" | "none";
  actions?: ReactNode;        // top-right area of card header
  noPadding?: boolean;
  className?: string;
}

export function SectionCard({
  children,
  title,
  description,
  icon: Icon,
  accent = "none",
  actions,
  noPadding,
  className,
}: SectionCardProps) {
  const accentColors = {
    primary: "border-l-[3px] border-l-primary",
    secondary: "border-l-[3px] border-l-secondary",
    amber: "border-l-[3px] border-l-amber-500",
    emerald: "border-l-[3px] border-l-emerald-500",
    destructive: "border-l-[3px] border-l-destructive",
    none: "",
  };

  return (
    <div className={cn(
      "bg-card rounded-[10px] shadow-[var(--card-shadow)] transition-shadow duration-300 hover:shadow-[var(--card-shadow-hover)]",
      accentColors[accent],
      className,
    )}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && <Icon className="w-[18px] h-[18px] text-primary shrink-0" />}
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-card-foreground">{title}</h3>
              {description && (
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      )}
      <div className={cn(!noPadding && "px-5 py-5")}>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   StatCard — Yuri-style compact stat/KPI card
   ═══════════════════════════════════════════════════════════════════════════════ */
interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  color?: "primary" | "secondary" | "amber" | "emerald" | "purple";
  className?: string;
}

export function StatCard({ label, value, icon: Icon, trend, color = "primary", className }: StatCardProps) {
  const colorMap = {
    primary: { bg: "bg-primary/10", text: "text-primary", icon: "text-primary" },
    secondary: { bg: "bg-secondary/10", text: "text-secondary", icon: "text-secondary" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-500", icon: "text-amber-500" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500", icon: "text-emerald-500" },
    purple: { bg: "bg-purple-500/10", text: "text-purple-500", icon: "text-purple-500" },
  };
  const c = colorMap[color];

  return (
    <div className={cn(
      "bg-card rounded-[10px] shadow-[var(--card-shadow)] p-5 flex items-center gap-4 transition-shadow duration-300 hover:shadow-[var(--card-shadow-hover)]",
      className,
    )}>
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", c.bg)}>
        <Icon className={cn("w-6 h-6", c.icon)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted-foreground font-medium truncate">{label}</p>
        <p className="text-2xl font-bold text-card-foreground leading-tight">{value}</p>
        {trend && (
          <p className={cn(
            "text-xs font-medium mt-0.5",
            trend.positive ? "text-emerald-500" : "text-destructive"
          )}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   EmptyState — Yuri-style empty/zero state
   ═══════════════════════════════════════════════════════════════════════════════ */
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode;  // action buttons
}

export function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="bg-card rounded-[10px] shadow-[var(--card-shadow)] py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-card-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">{description}</p>
      )}
      {children && (
        <div className="mt-5 flex items-center justify-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ListItem — Yuri-style list item card (for manager pages)
   ═══════════════════════════════════════════════════════════════════════════════ */
interface ListItemProps {
  children: ReactNode;
  className?: string;
}

export function ListItem({ children, className }: ListItemProps) {
  return (
    <div className={cn(
      "bg-card rounded-[10px] shadow-[var(--card-shadow)] px-5 py-4 flex flex-wrap items-center gap-3 justify-between transition-shadow duration-300 hover:shadow-[var(--card-shadow-hover)]",
      className,
    )}>
      {children}
    </div>
  );
}
