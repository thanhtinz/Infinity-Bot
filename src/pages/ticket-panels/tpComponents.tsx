import { useState } from "react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  Hash,
  CheckCircle2,
  Calendar,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import type { TicketButton, TicketPanel, PanelForm } from "./tpTypes";
import {
  DISCORD_BG,
  DISCORD_EMBED_BG,
  DISCORD_TEXT,
  DISCORD_MUTED,
  DEFAULT_COLOR,
  BUTTON_STYLES,
  STYLE_RING,
  STYLE_CHECK,
  getButtonStyle,
  formatDate,
} from "./tpConstants";

// ─── Discord Live Preview ────────────────────────────────────────────────────

export function DiscordPreview({
  form,
  buttons,
}: {
  form: PanelForm;
  buttons: TicketButton[];
}) {
  const { t } = useT();
  return (
    <div
      className="rounded-md overflow-hidden text-sm"
      style={{ backgroundColor: DISCORD_BG }}
    >
      {/* Channel header mock */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        <Hash className="h-3.5 w-3.5" style={{ color: DISCORD_MUTED }} />
        <span
          className="text-xs font-semibold"
          style={{ color: DISCORD_TEXT }}
        >
          ticket-panel
        </span>
      </div>

      {/* Message area */}
      <div className="px-3 pb-3 pt-1">
        <div className="flex items-start gap-2.5">
          <div
            className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: DEFAULT_COLOR, color: "#fff" }}
          >
            TB
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-semibold text-xs"
                style={{ color: DEFAULT_COLOR }}
              >
                TicketBot
              </span>
              <span className="text-[10px]" style={{ color: DISCORD_MUTED }}>
                Today at 12:00
              </span>
            </div>

            {/* Embed */}
            <div
              className="mt-1.5 rounded overflow-hidden max-w-[360px]"
              style={{ backgroundColor: DISCORD_EMBED_BG }}
            >
              <div className="flex">
                <div
                  className="w-1 shrink-0 rounded-l"
                  style={{ backgroundColor: form.color || DEFAULT_COLOR }}
                />
                <div className="p-2.5 flex-1 min-w-0">
                  {form.title && (
                    <p
                      className="font-semibold text-[13px] leading-tight"
                      style={{ color: DISCORD_TEXT }}
                    >
                      {form.title}
                    </p>
                  )}
                  {form.description && (
                    <p
                      className="text-xs mt-1 whitespace-pre-wrap leading-relaxed"
                      style={{ color: DISCORD_MUTED }}
                    >
                      {form.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Buttons row */}
            {buttons.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {buttons.map((btn, idx) => {
                  const s = getButtonStyle(btn.style);
                  return (
                    <div
                      key={btn.id ?? idx}
                      className="inline-flex items-center gap-1.5 rounded-[3px] px-4 py-1.5 text-xs font-medium cursor-default"
                      style={{ backgroundColor: s.bg, color: s.text }}
                    >
                      {btn.emoji && <span>{btn.emoji}</span>}
                      {btn.label || t("ticketPanels_button")}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Button Style Picker ─────────────────────────────────────────────────────

export function ButtonStylePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {BUTTON_STYLES.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onChange(s.key)}
          className={cn(
            "relative flex items-center gap-2 rounded-lg border-2 p-3 transition-all",
            value === s.key
              ? cn(
                  "border-foreground",
                  STYLE_RING[s.key],
                  "ring-2 ring-offset-1 ring-offset-background"
                )
              : "border-transparent bg-muted/30 hover:bg-muted/50"
          )}
        >
          <div
            className="h-5 w-5 rounded-full shrink-0"
            style={{ backgroundColor: s.bg }}
          />
          <div className="text-left">
            <p className="text-xs font-medium">{s.label}</p>
          </div>
          {value === s.key && (
            <div className="absolute top-1.5 right-1.5">
              <CheckCircle2 className={cn("h-4 w-4", STYLE_CHECK[s.key])} />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Panel Card ──────────────────────────────────────────────────────────────

export function PanelCard({
  panel,
  groupName,
  groupColor,
  onEdit,
  onDelete,
}: {
  panel: TicketPanel;
  groupName?: string;
  groupColor?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useT();
  const isSent = !!panel.message_id;
  const btns = panel.buttons ?? [];

  return (
    <Card className="overflow-hidden group transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        {/* Top: name + id + status */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold truncate text-sm">{panel.name}</span>
            <Badge
              variant="outline"
              className="text-[10px] font-mono shrink-0 px-1.5"
            >
              #{panel.id}
            </Badge>
            {groupName && (
              <Badge
                className="text-[10px] px-1.5 shrink-0"
                style={{
                  backgroundColor: (groupColor || DEFAULT_COLOR) + "20",
                  color: groupColor || DEFAULT_COLOR,
                  borderColor: (groupColor || DEFAULT_COLOR) + "40",
                }}
              >
                <Users className="h-3 w-3 mr-0.5" />
                {groupName}
              </Badge>
            )}
          </div>
          {isSent ? (
            <Badge className="bg-green-500/15 text-green-600 border border-green-500/30 shrink-0 text-[10px] px-1.5">
              <CheckCircle2 className="h-3 w-3 mr-0.5" />
              {t("ticketPanels_sent")}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-muted-foreground shrink-0 text-[10px] px-1.5"
            >
              {t("ticketPanels_notSent")}
            </Badge>
          )}
        </div>

        {/* Discord-style embed preview */}
        <div className="mx-4 mb-3 rounded overflow-hidden border border-border/50">
          <div className="flex">
            <div
              className="w-1 shrink-0"
              style={{ backgroundColor: panel.color || DEFAULT_COLOR }}
            />
            <div className="p-2.5 flex-1 min-w-0 bg-muted/30">
              <p className="font-semibold text-xs leading-tight">
                {panel.title || t("ticketPanels_title")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                {panel.description || t("ticketPanels_descriptionPlaceholder")}
              </p>
            </div>
          </div>
        </div>

        {/* Button chips row */}
        <div className="mx-4 mb-3 flex flex-wrap gap-1.5">
          {btns.map((btn, idx) => {
            const s = getButtonStyle(btn.style);
            return (
              <span
                key={btn.id ?? idx}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium"
                style={{ backgroundColor: s.bg, color: s.text }}
              >
                {btn.emoji && <span>{btn.emoji}</span>}
                {btn.label || t("ticketPanels_button")}
              </span>
            );
          })}
          {btns.length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              {t("ticketPanels_zeroButtons")}
            </span>
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
            {btns.length} {t("ticketPanels_buttons")}
          </Badge>
        </div>

        {/* Channel */}
        <div className="mx-4 mb-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Hash className="h-3 w-3 shrink-0" />
          {panel.channel_id ? (
            <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">
              {panel.channel_id}
            </code>
          ) : (
            <span>{t("ticketPanels_notSent")}</span>
          )}
        </div>

        <Separator />

        {/* Footer: date + actions */}
        <div className="flex items-center justify-between px-4 py-2.5">
          {panel.created_at ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(panel.created_at)}
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              {t("edit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {t("delete")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Collapsible Section ─────────────────────────────────────────────────────

export function CollapsibleSection({
  title,
  hasContent,
  children,
}: {
  title: string;
  hasContent: boolean;
  children: ReactNode;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(hasContent);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border p-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {hasContent && (
            <Badge variant="secondary" className="text-[10px] px-1.5">
              {t("ticketPanels_customize")}
            </Badge>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-0">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
