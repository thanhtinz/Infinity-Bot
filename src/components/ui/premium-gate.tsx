/**
 * PremiumBadge — small inline badge shown next to premium-only features.
 * PremiumGate  — wraps content; if guild lacks the feature, renders a
 *                locked overlay + upgrade dialog instead of the real content.
 */
import { useState } from "react";
import { Crown, Lock, Gem, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

// ── PremiumBadge ─────────────────────────────────────────────────────────────

interface PremiumBadgeProps {
  className?: string;
  size?: "sm" | "xs";
}

export function PremiumBadge({ className, size = "sm" }: PremiumBadgeProps) {
  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1 font-semibold select-none pointer-events-none",
        "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
        size === "xs" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5",
        className
      )}
    >
      <Crown className={cn("shrink-0", size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3")} />
      Premium
    </Badge>
  );
}

// ── PremiumGate ───────────────────────────────────────────────────────────────

interface PremiumGateProps {
  /** Feature key, e.g. "custom_bot" — must match keys in PremiumPlan.features */
  feature: string;
  /** Human-readable name shown in the dialog */
  featureLabel?: string;
  /** Whether access is granted (pass result of hasFeature() here) */
  hasAccess: boolean;
  /** Whether entitlements are still loading */
  isLoading?: boolean;
  children: React.ReactNode;
  /** Optional: render mode. "block" = lock entire section. "inline" = show children but disabled + click to open dialog */
  mode?: "block" | "inline";
}

export function PremiumGate({
  feature: _feature,
  featureLabel,
  hasAccess,
  isLoading = false,
  children,
  mode = "block",
}: PremiumGateProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  // Owner / premium guild — render normally
  if (isLoading || hasAccess) return <>{children}</>;

  const label = featureLabel ?? "this feature";

  if (mode === "inline") {
    return (
      <>
        {/* Children rendered but pointer-events blocked, click opens dialog */}
        <div
          className="relative cursor-pointer"
          onClick={() => setDialogOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setDialogOpen(true)}
        >
          <div className="pointer-events-none opacity-60 select-none">{children}</div>
          <div className="absolute inset-0 flex items-center justify-center bg-background/30 rounded-lg">
            <div className="flex items-center gap-1.5 bg-background/90 border rounded-full px-3 py-1 shadow text-xs font-medium text-amber-700 dark:text-amber-400">
              <Lock className="h-3 w-3" />
              Premium
            </div>
          </div>
        </div>
        <UpgradeDialog open={dialogOpen} onClose={() => setDialogOpen(false)} label={label} navigate={navigate} />
      </>
    );
  }

  // mode === "block": replace children entirely with upgrade card
  return (
    <>
      <div
        className="rounded-xl border-2 border-dashed border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-8 flex flex-col items-center justify-center gap-4 text-center cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
        onClick={() => setDialogOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setDialogOpen(true)}
      >
        <div className="rounded-full bg-amber-100 dark:bg-amber-900/40 p-4">
          <Crown className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="font-semibold text-amber-800 dark:text-amber-300 text-base">
            Premium Feature
          </p>
          <p className="text-sm text-amber-700/80 dark:text-amber-400/70 mt-1 max-w-sm">
            <span className="font-medium capitalize">{label}</span> is only available for servers with a Premium plan.
            Upgrade to unlock.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 text-white border-0"
          onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
        >
          <Gem className="h-4 w-4 mr-1.5" />
          View Premium Plans
        </Button>
      </div>
      <UpgradeDialog open={dialogOpen} onClose={() => setDialogOpen(false)} label={label} navigate={navigate} />
    </>
  );
}

// ── UpgradeDialog ─────────────────────────────────────────────────────────────

function UpgradeDialog({
  open,
  onClose,
  label,
  navigate,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Premium Required
          </DialogTitle>
          <DialogDescription className="pt-1">
            <span className="font-medium capitalize">{label}</span> is a Premium feature. Your server needs a Premium plan to use it.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 space-y-1">
          <p className="font-medium">Premium plan includes:</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-700 dark:text-amber-400 text-xs">
            <li>Custom Bot for your server</li>
            <li>Advanced Captcha</li>
            <li>Automatic backup & long-term storage</li>
            <li>And many more features…</li>
          </ul>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white border-0"
            onClick={() => { onClose(); navigate("/my-plan"); }}
          >
            <ArrowRight className="h-4 w-4 mr-1.5" />
            View Premium Plans
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
