import { useState, useEffect, useMemo } from "react";
import type { ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Settings2,
  Sliders,
  Clock,
  Save,
  AlertTriangle,
} from "lucide-react";
import { ChannelSelect } from "@/components/ChannelSelect";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";
// ─── Types ───────────────────────────────────────────────────────────────────

interface TicketConfigData {
  id?: number;
  guild_id?: string;
  category_id?: string;
  log_channel_id?: string;
  support_role_ids?: string[];
  ticket_limit?: number;
  cooldown_minutes?: number;
  auto_close_hours?: number;
}

interface ConfigForm {
  log_channel_id: string;
  category_id: string;
  support_role_ids: string;
  ticket_limit: number;
  cooldown_minutes: number;
  auto_close_hours: number;
  auto_close_enabled: boolean;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULTS: ConfigForm = {
  log_channel_id: "",
  category_id: "",
  support_role_ids: "",
  ticket_limit: 1,
  cooldown_minutes: 0,
  auto_close_hours: 0,
  auto_close_enabled: false,
};

function configToForm(cfg: TicketConfigData | null): ConfigForm {
  if (!cfg) return { ...DEFAULTS };
  return {
    log_channel_id: cfg.log_channel_id ?? "",
    category_id: cfg.category_id ?? "",
    support_role_ids: (cfg.support_role_ids ?? []).join(", "),
    ticket_limit: cfg.ticket_limit ?? 1,
    cooldown_minutes: cfg.cooldown_minutes ?? 0,
    auto_close_hours: cfg.auto_close_hours ?? 0,
    auto_close_enabled: (cfg.auto_close_hours ?? 0) > 0,
  };
}

function formToPayload(form: ConfigForm): TicketConfigData {
  return {
    log_channel_id: form.log_channel_id || undefined,
    category_id: form.category_id || undefined,
    support_role_ids: form.support_role_ids
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    ticket_limit: form.ticket_limit,
    cooldown_minutes: form.cooldown_minutes,
    auto_close_hours: form.auto_close_enabled ? form.auto_close_hours : 0,
  };
}

// ─── Section Card ────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-4">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            {i < 3 && <Skeleton className="h-10 w-full" />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function TicketConfig() {
  const { t } = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<ConfigForm>({ ...DEFAULTS });
  const [loadedForm, setLoadedForm] = useState<ConfigForm>({ ...DEFAULTS });

  // ─── Fetch config ──────────────────────────────────────────────────────

  const { data: config, isLoading } = useQuery<TicketConfigData | null>({
    queryKey: ["ticket-config"],
    queryFn: async () => {
      const res = await apiFetch("/api/ticket-config", {
        credentials: "include",
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Could not load ticket configuration");
      return res.json();
    },
  });

  // ─── Populate form when config loads ───────────────────────────────────

  useEffect(() => {
    const initial = configToForm(config ?? null);
    setForm(initial);
    setLoadedForm(initial);
  }, [config]);

  // ─── Dirty check ───────────────────────────────────────────────────────

  const isDirty = useMemo(() => {
    return (
      form.log_channel_id !== loadedForm.log_channel_id ||
      form.category_id !== loadedForm.category_id ||
      form.support_role_ids !== loadedForm.support_role_ids ||
      form.ticket_limit !== loadedForm.ticket_limit ||
      form.cooldown_minutes !== loadedForm.cooldown_minutes ||
      form.auto_close_enabled !== loadedForm.auto_close_enabled ||
      form.auto_close_hours !== loadedForm.auto_close_hours
    );
  }, [form, loadedForm]);

  // ─── Save mutation ─────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (data: ConfigForm) => {
      const payload = formToPayload(data);
      const res = await apiFetch("/api/ticket-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("toast_ticketSaved") });
      qc.invalidateQueries({ queryKey: ["ticket-config"] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: t("toast_saveFailed"),
        description: t("tryAgain"),
      });
    },
  });

  // ─── Field setter ──────────────────────────────────────────────────────

  const set = <K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleNumberInput = (
    key: keyof ConfigForm,
    e: ChangeEvent<HTMLInputElement>,
    min: number,
    max: number,
  ) => {
    const raw = parseInt(e.target.value);
    if (isNaN(raw)) {
      set(key, min as never);
      return;
    }
    set(key, Math.min(max, Math.max(min, raw)) as never);
  };

  // ─── Render ────────────────────────────────────────────────────────────

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("ticketConfig_title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("ticketConfig_desc")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <Badge variant="secondary" className="text-xs">
              {t("ticketConfig_unsavedChanges")}
            </Badge>
          )}
          <Button
            size="sm"
            disabled={!isDirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate(form)}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saveMutation.isPending ? t("saving") : t("ticketConfig_save")}
          </Button>
        </div>
      </div>

      {/* ── Section 1: Channels & Roles ── */}
      <SectionCard
        icon={Settings2}
        title={t("ticketConfig_channelRole")}
        description={t("ticketConfig_channelRoleDesc")}
      >
        <div className="space-y-2">
          <Label htmlFor="log-channel">{t("ticketConfig_logChannelId")}</Label>
          <ChannelSelect
            filter="text"
            value={form.log_channel_id}
            onChange={(v) => set("log_channel_id", v === "__clear__" ? "" : v)}
            placeholder={t("ticketConfig_selectLogChannel")}
          />
          <p className="text-xs text-muted-foreground">
            {t("ticketConfig_logChannelDesc")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category-id">{t("ticketConfig_defaultCategoryId")}</Label>
          <ChannelSelect
            filter="category"
            value={form.category_id}
            onChange={(v) => set("category_id", v === "__clear__" ? "" : v)}
            placeholder={t("ticketConfig_selectCategory")}
          />
          <p className="text-xs text-muted-foreground">
            {t("ticketConfig_categoryDesc")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="support-roles">{t("ticketConfig_supportRoleIds")}</Label>
          <MultiRoleSelect
            value={form.support_role_ids
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)}
            onChange={(v) => set("support_role_ids", v.join(", "))}
            placeholder={t("ticketConfig_selectSupportRoles")}
          />
          <p className="text-xs text-muted-foreground">
            {t("ticketConfig_supportRoleDesc")}
          </p>
        </div>
      </SectionCard>

      {/* ── Section 2: Limits & Cooldown ── */}
      <SectionCard
        icon={Sliders}
        title={t("ticketConfig_limitsCooldown")}
        description={t("ticketConfig_limitsCooldownDesc")}
      >
        <div className="space-y-2">
          <Label>{t("ticketConfig_ticketLimitPerUser")}</Label>
          <div className="flex items-center gap-4">
            <Slider
              value={[form.ticket_limit]}
              onValueChange={([v]) => set("ticket_limit", v)}
              min={1}
              max={10}
              step={1}
              className="flex-1"
            />
            <span className="text-sm font-semibold tabular-nums w-6 text-center">
              {form.ticket_limit}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("ticketConfig_maxOpenDesc")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cooldown">{t("ticketConfig_cooldownMinutes")}</Label>
          <Input
            id="cooldown"
            type="number"
            min={0}
            placeholder="0"
            value={form.cooldown_minutes}
            onChange={(e) =>
              handleNumberInput("cooldown_minutes", e, 0, 10080)
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("ticketConfig_cooldownDesc")}
          </p>
        </div>
      </SectionCard>

      {/* ── Section 3: Auto-close ── */}
      <SectionCard
        icon={Clock}
        title={t("ticketConfig_autoClose")}
        description={t("ticketConfig_autoCloseDesc")}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label>{t("ticketConfig_enableAutoClose")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("ticketConfig_autoCloseWhenInactive")}
            </p>
          </div>
          <Switch
            checked={form.auto_close_enabled}
            onCheckedChange={(checked) => {
              set("auto_close_enabled", checked);
              if (!checked) set("auto_close_hours", 0);
              else if (form.auto_close_hours === 0) set("auto_close_hours", 24);
            }}
          />
        </div>

        {form.auto_close_enabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="auto-close-hours">{t("ticketConfig_closeAfterHours")}</Label>
              <Input
                id="auto-close-hours"
                type="number"
                min={1}
                max={720}
                value={form.auto_close_hours}
                onChange={(e) =>
                  handleNumberInput("auto_close_hours", e, 1, 720)
                }
              />
            </div>
            {form.auto_close_hours > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t("ticketConfig_autoCloseWarning").replace("{hours}", String(form.auto_close_hours))}
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </SectionCard>


    </div>
  );
}
