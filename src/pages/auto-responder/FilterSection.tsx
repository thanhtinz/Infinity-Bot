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
  return (
    <>
      {/* ═══════ Section 3: Cài đặt (Collapsible) ═══════ */}
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
            Cài đặt
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          {/* Reply to message */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-1.5">
                <Reply className="h-3.5 w-3.5" />
                Reply tin nhắn
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Phản hồi dưới dạng reply tin nhắn gốc
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
                Xóa tin nhắn gốc
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Xóa tin nhắn kích hoạt sau khi phản hồi
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
                Gửi DM
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Gửi phản hồi qua tin nhắn riêng thay vì kênh
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
              Cooldown
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
                placeholder="0 = không giới hạn"
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">giây</span>
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
                  {ct === "per_user" ? "Per user" : ct === "per_channel" ? "Per channel" : "Global"}
                  </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5" />
              Priority
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
                Cao hơn = ưu tiên hơn
              </span>
            </div>
          </div>

          {/* Enabled */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Kích hoạt</Label>
              <p className="text-[11px] text-muted-foreground">
                Bật/tắt rule này
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

      {/* ═══════ Section 4: Giới hạn (Collapsible) ═══════ */}
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
            Giới hạn
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          {/* Allowed channels */}
          <div className="space-y-2">
            <Label>Kênh cho phép</Label>
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
              placeholder="Chọn kênh cho phép..."
            />
            <p className="text-[11px] text-muted-foreground">
              Để trống = cho phép tất cả kênh
            </p>
          </div>

          {/* Blocked channels */}
          <div className="space-y-2">
            <Label>Kênh chặn</Label>
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
              placeholder="Chọn kênh chặn..."
            />
          </div>

          <Separator />

          {/* Allowed roles */}
          <div className="space-y-2">
            <Label>Role cho phép</Label>
            <MultiRoleSelect
              value={form.allowed_roles}
              onChange={(roles) =>
                setForm((p) => ({ ...p, allowed_roles: roles }))
              }
              placeholder="Chọn role cho phép..."
            />
          </div>

          {/* Blocked roles */}
          <div className="space-y-2">
            <Label>Role chặn</Label>
            <MultiRoleSelect
              value={form.blocked_roles}
              onChange={(roles) =>
                setForm((p) => ({ ...p, blocked_roles: roles }))
              }
              placeholder="Chọn role chặn..."
            />
          </div>

          <Separator />

          {/* Ignore bots */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" />
                Bỏ qua bot
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Không kích hoạt khi tin nhắn từ bot
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
