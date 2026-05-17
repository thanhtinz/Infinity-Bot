import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

import type { AutoResponderRule, RuleForm } from "./arTypes";
import { TRIGGER_TYPE_CONFIG } from "./arConstants";

interface TriggerSectionProps {
  form: RuleForm;
  setForm: React.Dispatch<React.SetStateAction<RuleForm>>;
}

export function TriggerSection({ form, setForm }: TriggerSectionProps) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5" />
        {t("ar_triggerCondition")}
      </p>

      {/* Name */}
      <div className="space-y-2">
        <Label>{t("ar_nameRule")}</Label>
        <Input
          value={form.name}
          onChange={(e) =>
            setForm((p) => ({ ...p, name: e.target.value }))
          }
          placeholder={t("ar_namePlaceholder")}
        />
      </div>

      {/* Trigger type */}
      <div className="space-y-2">
        <Label>{t("ar_conditionType")}</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TRIGGER_TYPE_CONFIG) as AutoResponderRule["trigger_type"][]).map((type) => {
            const cfg = TRIGGER_TYPE_CONFIG[type];
            const Icon = cfg.icon;
            return (
              <button
                key={type}
                type="button"
                onClick={() =>
                  setForm((p) => ({ ...p, trigger_type: type }))
                }
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 transition-all text-xs",
                  form.trigger_type === type
                    ? "border-foreground bg-foreground/5"
                    : "border-transparent bg-muted/30 hover:bg-muted/50"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trigger text */}
      <div className="space-y-2">
        <Label>{t("ar_conditionContent")}</Label>
        <Input
          value={form.trigger_text}
          onChange={(e) =>
            setForm((p) => ({ ...p, trigger_text: e.target.value }))
          }
          placeholder={
            form.trigger_type === "regex"
              ? t("ar_placeholderRegex")
              : form.trigger_type === "wildcard"
                ? t("ar_placeholderWildcard")
                : form.trigger_type === "exact"
                  ? t("ar_placeholderExact")
                  : t("ar_placeholderContains")
          }
        />
        <p className="text-[11px] text-muted-foreground">
          {TRIGGER_TYPE_CONFIG[form.trigger_type].helper}
        </p>
      </div>

      {/* Ignore case */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>{t("ar_caseInsensitive")}</Label>
          <p className="text-[11px] text-muted-foreground">
            {t("ar_ignoreCaseHint")}
          </p>
        </div>
        <Switch
          checked={form.ignore_case}
          onCheckedChange={(checked) =>
            setForm((p) => ({ ...p, ignore_case: checked }))
          }
        />
      </div>
    </div>
  );
}
