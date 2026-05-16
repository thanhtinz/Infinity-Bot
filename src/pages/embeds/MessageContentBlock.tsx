import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  ChevronDown, ChevronRight, BellOff,
} from "lucide-react";
import type { CustomFormState } from "./embedTypes";

interface MessageContentBlockProps {
  form: CustomFormState;
  onFormChange: (updater: (prev: CustomFormState) => CustomFormState) => void;
  threadOpen: boolean;
  onToggleThread: () => void;
  profileOpen: boolean;
  onToggleProfile: () => void;
  flagsOpen: boolean;
  onToggleFlags: () => void;
}

export function MessageContentBlock({
  form,
  onFormChange,
  threadOpen,
  onToggleThread,
  profileOpen,
  onToggleProfile,
  flagsOpen,
  onToggleFlags,
}: MessageContentBlockProps) {
  return (
    <>
      {/* ── Message block ── */}
      <div className="rounded-lg border overflow-hidden bg-card">
        {/* Content */}
        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Content</Label>
            <span className="text-[11px] text-muted-foreground">{form.content.length}/2000</span>
          </div>
          <Textarea
            placeholder="Message content (plain text, supports Discord markdown)"
            value={form.content}
            onChange={(e) => onFormChange((f) => ({ ...f, content: e.target.value }))}
            rows={3}
            maxLength={2000}
            className="resize-y text-sm"
          />
        </div>

        {/* Thread — collapsible */}
        <div className="border-t">
          <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            onClick={onToggleThread}>
            {threadOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Thread
          </button>
          {threadOpen && (
            <div className="px-4 pb-4">
              <Input placeholder="Name thread..." value={form.thread_name}
                onChange={(e) => onFormChange((f) => ({ ...f, thread_name: e.target.value }))} className="text-sm" />
            </div>
          )}
        </div>

        {/* Profile — collapsible */}
        <div className="border-t">
          <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            onClick={onToggleProfile}>
            {profileOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Profile
          </button>
          {profileOpen && (
            <div className="px-4 pb-4 space-y-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Webhook Username</Label>
                <Input placeholder="Display name..." value={form.webhook_username}
                  onChange={(e) => onFormChange((f) => ({ ...f, webhook_username: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Webhook Avatar URL</Label>
                <Input placeholder="https://..." value={form.webhook_avatar_url}
                  onChange={(e) => onFormChange((f) => ({ ...f, webhook_avatar_url: e.target.value }))} className="text-sm" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Flags ── */}
      <div className="rounded-lg border">
        <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold hover:bg-muted/50"
          onClick={onToggleFlags}>
          {flagsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <BellOff className="h-3.5 w-3.5 text-muted-foreground" />Flags &amp; Mentions
        </button>
        {flagsOpen && (
          <div className="px-3 pb-3 space-y-3">
            {/* Flags */}
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Message Flags</div>
              <div className="flex items-center gap-2">
                <Switch id="flag-suppress" checked={!!form.flags.suppress_embeds}
                  onCheckedChange={(v) => onFormChange(f => ({ ...f, flags: { ...f.flags, suppress_embeds: v } }))} />
                <Label htmlFor="flag-suppress" className="text-xs">Suppress Embeds</Label>
              </div>
            </div>
            {/* Allowed Mentions */}
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Allowed Mentions</div>
              <div className="flex flex-wrap gap-3">
                {(["everyone", "roles", "users"] as const).map((type) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <input type="checkbox" id={`am-${type}`} className="h-3.5 w-3.5 accent-indigo-500"
                      checked={(form.allowed_mentions.parse ?? []).includes(type)}
                      onChange={(e) => {
                        const current = form.allowed_mentions.parse ?? [];
                        const next = e.target.checked ? [...current, type] : current.filter(t => t !== type);
                        onFormChange(f => ({ ...f, allowed_mentions: { ...f.allowed_mentions, parse: next } }));
                      }} />
                    <Label htmlFor={`am-${type}`} className="text-xs capitalize">{type}</Label>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Switch id="am-replied"
                  checked={!!form.allowed_mentions.replied_user}
                  onCheckedChange={(v) => onFormChange(f => ({ ...f, allowed_mentions: { ...f.allowed_mentions, replied_user: v } }))} />
                <Label htmlFor="am-replied" className="text-xs">Mention replied user</Label>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
