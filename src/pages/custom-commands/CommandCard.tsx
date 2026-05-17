import type { CustomCommand } from "./ccTypes";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Type,
  Layout,
  Calendar,
  Pencil,
  Trash2,
  Smile,
} from "lucide-react";
import { DEFAULT_COLOR, formatDate } from "./ccConstants";
import { useT } from "@/i18n";

export function CommandCard({
  command,
  onEdit,
  onDelete,
  onToggle,
  togglePending,
}: {
  command: CustomCommand;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  togglePending: boolean;
}) {
  const { t } = useT();
  return (
    <Card className="overflow-hidden group transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        {/* Top: name + badges */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <Badge className="bg-indigo-500/15 text-indigo-600 border border-indigo-500/30 shrink-0 text-[11px] font-mono px-2">
              !{command.name}
            </Badge>
            {command.aliases?.map((alias) => (
              <Badge
                key={alias}
                variant="outline"
                className="text-[10px] px-1.5 shrink-0 font-mono text-muted-foreground"
              >
                !{alias}
              </Badge>
            ))}
            {command.response_type === "text" ? (
              <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
                <Type className="h-3 w-3 mr-0.5" />
                {t("cc_text")}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
                <Layout className="h-3 w-3 mr-0.5" />
                {t("cc_embed")}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={command.enabled}
              onCheckedChange={onToggle}
              disabled={togglePending}
              className="scale-75"
            />
          </div>
        </div>

        {/* Description */}
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground line-clamp-2">
            {command.description || t("cc_noDescription")}
          </p>
        </div>

        {/* Response preview */}
        {command.response_type === "embed" && command.response_embed && (
          <div className="mx-4 mb-3 rounded overflow-hidden border border-border/50">
            <div className="flex">
              <div
                className="w-1 shrink-0"
                style={{ backgroundColor: command.response_embed.color || DEFAULT_COLOR }}
              />
              <div className="p-2.5 flex-1 min-w-0 bg-muted/30">
                <p className="font-semibold text-xs leading-tight">
                  {command.response_embed.title || "Title"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                  {command.response_embed.description || "Description..."}
                </p>
              </div>
            </div>
          </div>
        )}

        {command.response_type === "text" && command.response_text && (
          <div className="mx-4 mb-3 rounded bg-muted/30 p-2.5 border border-border/50">
            <p className="text-[11px] text-muted-foreground line-clamp-2">
              {command.response_text}
            </p>
          </div>
        )}

        {/* Meta row */}
        <div className="mx-4 mb-2 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          {command.ephemeral && (
            <span className="flex items-center gap-1">
              {t("cc_hiddenEphemeral")}
            </span>
          )}
          {command.required_roles?.length > 0 && (
            <span>{command.required_roles.length} {t("cc_requiredRoles")}</span>
          )}
          {(command.cooldown ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              ⏱️ {command.cooldown}s
            </span>
          )}
          {(command.allowed_channels?.length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-blue-600">
              📌 {command.allowed_channels.length} {t("cc_channel")}
            </span>
          )}
          {command.delete_trigger && (
            <span className="text-rose-600">{t("cc_deleteOriginalMessage")}</span>
          )}
          {command.auto_react && (
            <span className="flex items-center gap-1">
              <Smile className="h-3 w-3" />
              {command.auto_react}
            </span>
          )}
        </div>

        <Separator />

        {/* Footer: date + actions */}
        <div className="flex items-center justify-between px-4 py-2.5">
          {command.created_at ? (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(command.created_at)}
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
