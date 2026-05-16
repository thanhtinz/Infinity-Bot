import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChannelSelect } from "@/components/ChannelSelect";
import { EmojiPicker } from "@/components/EmojiPicker";
import { ChevronDown, ChevronRight, Hash, X } from "lucide-react";
import type { CommandForm } from "./ccTypes";

interface CommandSettingsAdvancedProps {
  form: CommandForm;
  onFormChange: React.Dispatch<React.SetStateAction<CommandForm>>;
  aliasInput: string;
  onAliasInputChange: (v: string) => void;
  onAliasKeyDown: (e: React.KeyboardEvent) => void;
  onAddAlias: () => void;
  onRemoveAlias: (alias: string) => void;
  onAddChannel: (chId: string) => void;
  onRemoveChannel: (chId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandSettingsAdvanced({
  form,
  onFormChange,
  aliasInput,
  onAliasInputChange,
  onAliasKeyDown,
  onAddAlias,
  onRemoveAlias,
  onAddChannel,
  onRemoveChannel,
  open,
  onOpenChange,
}: CommandSettingsAdvancedProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          Cài đặt nâng cao
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-3">
        {/* Aliases */}
        <div className="space-y-2">
          <Label>Tên thay thế (Aliases)</Label>
          <div className="flex flex-wrap gap-1.5 min-h-[28px] p-2 rounded-md border bg-background">
            {form.aliases.map((alias) => (
              <Badge
                key={alias}
                variant="secondary"
                className="gap-1 text-xs font-mono"
              >
                !{alias}
                <button
                  type="button"
                  onClick={() => onRemoveAlias(alias)}
                  className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
            <input
              value={aliasInput}
              onChange={(e) => onAliasInputChange(e.target.value)}
              onKeyDown={onAliasKeyDown}
              onBlur={aliasInput.trim() ? onAddAlias : undefined}
              placeholder={form.aliases.length === 0 ? "Nhập alias rồi nhấn Enter..." : "Thêm..."}
              className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tên gọi khác cho lệnh này. VD: thêm "hi" để !hi cũng hoạt động như !{form.name || "command"}
          </p>
        </div>

        {/* Cooldown */}
        <div className="space-y-2">
          <Label>Cooldown</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={form.cooldown}
              onChange={(e) =>
                onFormChange((p) => ({
                  ...p,
                  cooldown: Math.max(0, parseInt(e.target.value) || 0),
                }))
              }
              placeholder="0 = không giới hạn"
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">giây</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Thời gian chờ giữa mỗi lần dùng (0 = không giới hạn)
          </p>
        </div>

        {/* Allowed Channels */}
        <div className="space-y-2">
          <Label>Giới hạn kênh</Label>
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
                    onClick={() => onRemoveChannel(chId)}
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
            onChange={onAddChannel}
            placeholder="Chọn kênh để thêm..."
          />
          <p className="text-[11px] text-muted-foreground">
            Để trống = cho phép tất cả kênh
          </p>
        </div>

        {/* Delete Trigger */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Xóa tin nhắn lệnh</Label>
            <p className="text-[11px] text-muted-foreground">
              Xóa tin nhắn !command sau khi phản hồi
            </p>
          </div>
          <Switch
            checked={form.delete_trigger}
            onCheckedChange={(checked) =>
              onFormChange((p) => ({ ...p, delete_trigger: checked }))
            }
          />
        </div>

        {/* Auto React */}
        <div className="space-y-2">
          <Label>Tự động react</Label>
          <div className="flex items-center gap-2">
            <EmojiPicker
              onSelect={(emoji) =>
                onFormChange((p) => ({ ...p, auto_react: emoji }))
              }
            />
            {form.auto_react && (
              <span className="text-lg">{form.auto_react}</span>
            )}
            {form.auto_react && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() =>
                  onFormChange((p) => ({ ...p, auto_react: "" }))
                }
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Emoji react vào tin nhắn phản hồi
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
