import { useState, useEffect } from "react";
import { useT } from "@/i18n";
import {
  Gavel,
  Ban,
  UserX,
  Volume2,
  ShieldCheck,
  AlertTriangle,
  Clock,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ModCase {
  id: number;
  case_number: number;
  action: string;
  target_id: string;
  target_name: string;
  moderator_id: string;
  moderator_name: string;
  reason: string;
  duration: string | null;
  active: boolean;
  role_id: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ModNote {
  id: number;
  target_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface ModStats {
  total_cases: number;
  active_moderations: number;
  total_notes: number;
  by_action: Record<string, number>;
}

export interface ModerationConfig {
  mute_role_id: string;
  mod_log_channel_id: string;
  lockdown_channels: string;
  ignored_users: string;
  ignored_roles: string;
  ignored_channels: string;
  dm_on_action: boolean;
  show_mod_in_dm: boolean;
  auto_dehoist: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export const ACTION_BADGE: Record<string, { cls: string; icon: React.ReactNode }> = {
  warn: {
    cls: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  ban: {
    cls: "bg-red-500/15 text-red-600 border-red-500/30",
    icon: <Ban className="h-3 w-3" />,
  },
  softban: {
    cls: "bg-red-500/15 text-red-600 border-red-500/30",
    icon: <Ban className="h-3 w-3" />,
  },
  kick: {
    cls: "bg-orange-500/15 text-orange-600 border-orange-500/30",
    icon: <UserX className="h-3 w-3" />,
  },
  mute: {
    cls: "bg-primary/15 text-primary border-primary/30",
    icon: <Volume2 className="h-3 w-3" />,
  },
  timeout: {
    cls: "bg-primary/15 text-primary border-primary/30",
    icon: <Clock className="h-3 w-3" />,
  },
  unban: {
    cls: "bg-green-500/15 text-green-600 border-green-500/30",
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  unmute: {
    cls: "bg-green-500/15 text-green-600 border-green-500/30",
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  deafen: {
    cls: "bg-secondary/15 text-secondary border-purple-500/30",
    icon: <Volume2 className="h-3 w-3" />,
  },
};

const DEFAULT_BADGE = {
  cls: "bg-gray-500/15 text-gray-600 border-gray-500/30",
  icon: <Gavel className="h-3 w-3" />,
};

export function actionBadge(action: string) {
  return ACTION_BADGE[action.toLowerCase()] ?? DEFAULT_BADGE;
}

export function formatDate(s: string) {
  return new Date(s).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncate(s: string, len = 50) {
  if (!s) return "—";
  return s.length > len ? s.slice(0, len) + "…" : s;
}

export function Countdown({ expiresAt }: { expiresAt: string }) {
  const { t } = useT();
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function calc() {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining(t("orders_expired"));
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setRemaining(
        h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`
      );
    }
    calc();
    const id = setInterval(calc, 1_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return <span className="font-mono text-sm">{remaining}</span>;
}
