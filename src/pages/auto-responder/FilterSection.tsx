import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { ChannelSelect } from "@/components/ChannelSelect";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Trash2,
  X,
  Hash,
  ChevronDown,
  ChevronRight,
  Reply,
  Mail,
  Ban,
  Bot,
  Clock,
  ArrowUpRight,
  Settings2,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

import type { RuleForm } from "./arTypes";

interface FilterSectionProps {
  form: RuleForm;
  setForm: React.Dispatch<React.SetStateAction<RuleForm>>;
  settingsOpen: boolean;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  restrictionsOpen: boolean;
  setRestrictionsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  addAllowedChannel: (chId: string) => void;
  removeAllowedChannel: (chId: string) => void;
  addBlockedChannel: (chId: string) => void;
  removeBlockedChannel: (chId: string) => void;
}

export function FilterSection({
  form,
  setForm,
  settingsOpen,
  setSettingsOpen,
  restrictionsOpen,
  setRestrictionsOpen,
  addAllowedChannel,
  removeAllowedChannel,
  addBlockedChannel,
  removeBlockedChannel,
}: FilterSectionProps) {
  const { t } = useT();
  return (
    <>
      {/* ═══════ Section 3: Settings (Collapsible) ═══════ */}
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {settingsOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <Settings2 className="h-3.5 w-3.5" />
            {t("ar_settings")}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          {/* Reply to message */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-1.5">
                <Reply className="h-3.5 w-3.5" />
                {t("ar_replyToMessage")}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t("ar_replyToMessageDesc")}
              </p>
            </div>
            <Switch
              checked={form.reply_to_message}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, reply_to_message: checked }))
              }
            />
          </div>

          {/* Delete trigger */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                {t("ar_deleteOriginal")}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t("ar_deleteOriginalDesc")}
              </p>
            </div>
            <Switch
              checked={form.delete_trigger}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, delete_trigger: checked }))
              }
            />
          </div>

          {/* Send DM */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {t("ar_sendDm")}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t("ar_sendDmDesc")}
              </p>
            </div>
            <Switch
              checked={form.send_dm}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, send_dm: checked }))
              }
            />
          </div>

          <Separator />

          {/* Cooldown */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {t("ar_cooldown")}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={form.cooldown}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    cooldown: Math.max(0, parseInt(e.target.value) || 0),
                  }))
                }
                placeholder={t("ar_unlimited")}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">{t("ar_seconds")}</span>
            </div>
            <div className="flex gap-2 mt-1">
              {(["per_user", "per_channel", "global"] as const).map((ct) => (
                <button
                  key={ct}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, cooldown_type: ct }))}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs transition-all",
                    form.cooldown_type === ct
                      ? "border-foreground bg-foreground/5"
                      : "border-transparent bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  {ct === "per_user" ? t("ar_perUser") : ct === "per_channel" ? t("ar_perChannel") : t("ar_global")}
                  </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5" />
              {t("ar_priority")}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={form.priority}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    priority: Math.max(0, parseInt(e.target.value) || 0),
                  }))
                }
                placeholder="0"
                className="w-28"
              />
              <span className="text-[11px] text-muted-foreground">
                {t("ar_priorityHint")}
              </span>
            </div>
          </div>

          {/* Enabled */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("ar_activate")}</Label>
              <p className="text-[11px] text-muted-foreground">
                {t("ar_activateDesc")}
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, enabled: checked }))
              }
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* ═══════ Section 4: Limits (Collapsible) ═══════ */}
      <Collapsible open={restrictionsOpen} onOpenChange={setRestrictionsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {restrictionsOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <Filter className="h-3.5 w-3.5" />
            {t("ar_limits")}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          {/* Allowed channels */}
          <div className="space-y-2">
            <Label>{t("ar_allowedChannels")}</Label>
            {form.allowed_channels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.allowed_channels.map((chId) => (
                  <Badge
                    key={chId}
                    variant="secondary"
                    className="gap-1 text-xs"
                  >
                    <Hash className="h-2.5 w-2.5" />
                    {chId}
                    <button
                      type="button"
                      onClick={() => removeAllowedChannel(chId)}
                      className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <ChannelSelect
              filter="text"
              value=""
              onChange={addAllowedChannel}
              placeholder={t("ar_selectAllowedChannels")}
            />
            <p className="text-[11px] text-muted-foreground">
              {t("ar_leaveEmptyAllChannels")}
            </p>
          </div>

          {/* Blocked channels */}
          <div className="space-y-2">
            <Label>{t("ar_blockedChannels")}</Label>
            {form.blocked_channels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.blocked_channels.map((chId) => (
                  <Badge
                    key={chId}
                    variant="secondary"
                    className="gap-1 text-xs"
                  >
                    <Ban className="h-2.5 w-2.5" />
                    {chId}
                    <button
                      type="button"
                      onClick={() => removeBlockedChannel(chId)}
                      className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <ChannelSelect
              filter="text"
              value=""
              onChange={addBlockedChannel}
              placeholder={t("ar_selectBlockedChannels")}
            />
          </div>

          <Separator />

          {/* Allowed roles */}
          <div className="space-y-2">
            <Label>{t("ar_allowedRoles")}</Label>
            <MultiRoleSelect
              value={form.allowed_roles}
              onChange={(roles) =>
                setForm((p) => ({ ...p, allowed_roles: roles }))
              }
              placeholder={t("ar_selectAllowedRoles")}
            />
          </div>

          {/* Blocked roles */}
          <div className="space-y-2">
            <Label>{t("ar_blockedRoles")}</Label>
            <MultiRoleSelect
              value={form.blocked_roles}
              onChange={(roles) =>
                setForm((p) => ({ ...p, blocked_roles: roles }))
              }
              placeholder={t("ar_selectBlockedRoles")}
            />
          </div>

          <Separator />

          {/* Ignore bots */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" />
                {t("ar_ignoreBots")}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t("ar_ignoreBotsDesc")}
              </p>
            </div>
            <Switch
              checked={form.ignore_bots}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, ignore_bots: checked }))
              }
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
