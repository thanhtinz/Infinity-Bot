import type { AutoResponderRule } from "./arTypes";
import { TRIGGER_TYPE_CONFIG, DEFAULT_COLOR, formatDate } from "./arConstants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Type,
  Layout,
  Smile,
  Calendar,
  Pencil,
  Trash2,
  Reply,
  Mail,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Rule Card ───────────────────────────────────────────────────────────────

export function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
  togglePending,
}: {
  rule: AutoResponderRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  togglePending: boolean;
}) {
  const triggerCfg = TRIGGER_TYPE_CONFIG[rule.trigger_type];
  const TriggerIcon = triggerCfg.icon;
  const showText = rule.response_type.includes("text");
  const showEmbed = rule.response_type.includes("embed");
  const showReact = rule.response_type === "react" || rule.response_type.includes("+react");

  return (
    <Card className="overflow-hidden group transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        {/* Top: name + badges */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className="font-semibold text-sm truncate max-w-[180px]">
              {rule.name || "Untitled"}
            </span>
            <Badge className={cn("border shrink-0 text-[11px] px-2", triggerCfg.color)}>
              <TriggerIcon className="h-3 w-3 mr-0.5" />
              {triggerCfg.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
              {showText && <><Type className="h-3 w-3 mr-0.5" />Text</>}
              {showEmbed && <><Layout className="h-3 w-3 mr-0.5" />Embed</>}
              {showReact && <><Smile className="h-3 w-3 mr-0.5" />React</>}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={rule.enabled}
              onCheckedChange={onToggle}
              disabled={togglePending}
              className="scale-75"
            />
          </div>
        </div>

        {/* Trigger text preview */}
        <div className="px-4 pb-2">
          <div className="rounded bg-muted/30 p-2 border border-border/50">
            <p className="text-xs font-mono text-muted-foreground line-clamp-2 break-all">
              {rule.trigger_text || "—"}
            </p>
          </div>
        </div>

        {/* Response preview */}
        {showText && rule.response_text && (
          <div className="mx-4 mb-3 rounded bg-muted/30 p-2.5 border border-border/50">
            <p className="text-[11px] text-muted-foreground line-clamp-2">
              {rule.response_text}
            </p>
          </div>
        )}
        {showEmbed && rule.response_embed && (
          <div className="mx-4 mb-3 rounded overflow-hidden border border-border/50">
            <div className="flex">
              <div
                className="w-1 shrink-0"
                style={{ backgroundColor: rule.response_embed.color || DEFAULT_COLOR }}
              />
              <div className="p-2.5 flex-1 min-w-0 bg-muted/30">
                <p className="font-semibold text-xs leading-tight">
                  {rule.response_embed.title || "Title"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                  {rule.response_embed.description || "Description..."}
                </p>
              </div>
            </div>
          </div>
        )}
        {showReact && rule.reaction_emojis?.length > 0 && (
          <div className="mx-4 mb-3 flex items-center gap-1">
            <Smile className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex gap-0.5">
              {rule.reaction_emojis.slice(0, 5).map((emoji, i) => (
                <span key={i} className="text-sm">{emoji}</span>
              ))}
              {rule.reaction_emojis.length > 5 && (
                <span className="text-[11px] text-muted-foreground">+{rule.reaction_emojis.length - 5}</span>
              )}
            </div>
          </div>
        )}

        {/* Meta row */}
        <div className="mx-4 mb-2 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          {rule.ignore_case && (
            <span className="text-blue-600">Aa</span>
          )}
          {(rule.cooldown ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              ⏱️ {rule.cooldown}s
            </span>
          )}
          {(rule.allowed_channels?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-blue-600">
              📌 {rule.allowed_channels.length} channel
            </span>
          )}
          {(rule.blocked_channels?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              🚫 {rule.blocked_channels.length} channel
            </span>
          )}
          {(rule.allowed_roles?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              🛡️ {rule.allowed_roles.length} role
            </span>
          )}
          {(rule.blocked_roles?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              🚫 {rule.blocked_roles.length} role
            </span>
          )}
          {(rule.priority ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-purple-600">
              ⬆️ P{rule.priority}
            </span>
          )}
          {rule.reply_to_message && (
            <span className="flex items-center gap-1">
              <Reply className="h-3 w-3" />
              Reply
            </span>
          )}
          {rule.delete_trigger && (
            <span className="text-rose-600">Delete original message</span>
          )}
          {rule.send_dm && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              DM
            </span>
          )}
          {rule.ignore_bots && (
            <span className="flex items-center gap-1">
              <Bot className="h-3 w-3" />
              Ignore bots
            </span>
          )}
        </div>

        <Separator />

        {/* Footer: date + actions */}
        <div className="flex items-center justify-between px-4 py-2.5">
          {rule.created_at ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(rule.created_at)}
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
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
