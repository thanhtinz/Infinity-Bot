import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChannelSelect } from "@/components/ChannelSelect";
import { EmojiPicker } from "@/components/EmojiPicker";
import {
  ArrowLeft,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/hooks/useApi";

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESET_COLORS = ["#5865F2", "#57f287", "#fee75c", "#ed4245", "#eb459e", "#2b2d31"];

// ─── Types ───────────────────────────────────────────────────────────────────

interface StickyMessage {
  id: number;
  guild_id: string;
  channel_id: string;
  content?: string;
  embed_enabled: boolean;
  embed_title?: string;
  embed_description?: string;
  embed_color: string;
  embed_footer?: string;
  embed_image_url?: string;
  embed_thumbnail_url?: string;
  message_count_trigger: number;
  interval_minutes: number;
  is_enabled: boolean;
  is_pinned: boolean;
  resend_count: number;
  created_at?: string;
  last_sent?: string;
  expires_at?: string;
}

interface FormState {
  channel_id: string;
  content: string;
  embed_enabled: boolean;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  embed_footer: string;
  embed_image_url: string;
  embed_thumbnail_url: string;
  message_count_trigger: number;
  interval_minutes: number;
  is_pinned: boolean;
}

const EMPTY_FORM: FormState = {
  channel_id: "",
  content: "",
  embed_enabled: false,
  embed_title: "",
  embed_description: "",
  embed_color: "#5865F2",
  embed_footer: "",
  embed_image_url: "",
  embed_thumbnail_url: "",
  message_count_trigger: 1,
  interval_minutes: 0,
  is_pinned: false,
};

// ─── DiscordPreview ──────────────────────────────────────────────────────────

function DiscordPreview({ form }: { form: FormState }) {
  const DISCORD_BG = "#2b2d31";
  const DISCORD_TEXT = "#dbdee1";
  const DISCORD_MUTED = "#949ba4";

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
          sticky-channel
        </span>
      </div>

      {/* Message */}
      <div className="px-3 pb-3 pt-1">
        <div className="flex items-start gap-2.5">
          {/* Bot avatar */}
          <div
            className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: "#5865F2", color: "#fff" }}
          >
            B
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-semibold text-xs"
                style={{ color: "#5865F2" }}
              >
                Bot
              </span>
              <span className="text-[10px]" style={{ color: DISCORD_MUTED }}>
                Today at 12:00
              </span>
            </div>

            {/* Plain text content */}
            {form.content && (
              <p className="text-xs mt-1" style={{ color: DISCORD_TEXT }}>
                {form.content}
              </p>
            )}

            {/* Embed */}
            {form.embed_enabled &&
              (form.embed_title || form.embed_description) && (
                <div
                  className="mt-1.5 rounded overflow-hidden max-w-[360px]"
                  style={{ backgroundColor: DISCORD_BG }}
                >
                  <div className="flex">
                    <div
                      className="w-1 shrink-0 rounded-l"
                      style={{
                        backgroundColor: form.embed_color || "#5865F2",
                      }}
                    />
                    <div className="p-2.5 flex-1 min-w-0">
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          {form.embed_title && (
                            <p
                              className="font-semibold text-[13px] leading-tight"
                              style={{ color: DISCORD_TEXT }}
                            >
                              {form.embed_title}
                            </p>
                          )}
                          {form.embed_description && (
                            <p
                              className="text-xs mt-1 whitespace-pre-wrap leading-relaxed"
                              style={{ color: DISCORD_MUTED }}
                            >
                              {form.embed_description}
                            </p>
                          )}
                        </div>
                        {/* Thumbnail */}
                        {form.embed_thumbnail_url && (
                          <img
                            src={form.embed_thumbnail_url}
                            className="h-14 w-14 rounded object-cover shrink-0"
                            alt=""
                          />
                        )}
                      </div>
                      {/* Image */}
                      {form.embed_image_url && (
                        <img
                          src={form.embed_image_url}
                          className="mt-2 rounded max-h-40 w-full object-cover"
                          alt=""
                        />
                      )}
                      {/* Footer */}
                      {form.embed_footer && (
                        <p
                          className="text-[10px] mt-2 opacity-70"
                          style={{ color: DISCORD_MUTED }}
                        >
                          {form.embed_footer}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StickyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !id;

  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });

  // ── Fetch sticky if editing ──
  const { isLoading } = useQuery<StickyMessage[]>({
    queryKey: ["sticky"],
    queryFn: () =>
      apiFetch("/api/sticky").then((r) => r.json()),
    enabled: !isNew,
    staleTime: 60_000,
  });

  // Populate form when data arrives for editing
  const [populated, setPopulated] = useState(false);
  if (!isNew && !populated) {
    const stickies = qc.getQueryData<StickyMessage[]>(["sticky"]);
    const sticky = stickies?.find((s) => String(s.id) === id);
    if (sticky) {
      setForm({
        channel_id: sticky.channel_id,
        content: sticky.content ?? "",
        embed_enabled: sticky.embed_enabled,
        embed_title: sticky.embed_title ?? "",
        embed_description: sticky.embed_description ?? "",
        embed_color: sticky.embed_color || "#5865F2",
        embed_footer: sticky.embed_footer ?? "",
        embed_image_url: sticky.embed_image_url ?? "",
        embed_thumbnail_url: sticky.embed_thumbnail_url ?? "",
        message_count_trigger: sticky.message_count_trigger,
        interval_minutes: sticky.interval_minutes,
        is_pinned: sticky.is_pinned,
      });
      setPopulated(true);
    }
  }

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (body: FormState) =>
      apiFetch("/api/sticky", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sticky"] });
      qc.invalidateQueries({ queryKey: ["sticky-stats"] });
      navigate("/sticky");
      toast({ title: "Sticky created." });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id: stickyId, ...body }: { id: number } & Partial<FormState>) =>
      apiFetch(`/api/sticky/${stickyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sticky"] });
      qc.invalidateQueries({ queryKey: ["sticky-stats"] });
      navigate("/sticky");
      toast({ title: "Sticky updated." });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSave = () => {
    if (!isNew && id) {
      updateMutation.mutate({ id: Number(id), ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sticky")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold">
          {isNew ? "Create Sticky" : "Edit Sticky"}
        </h1>
        <div className="ml-auto">
          <Button
            onClick={handleSave}
            disabled={!form.channel_id || isPending}
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        {/* Channel select */}
        <div className="space-y-2">
          <Label>Channel</Label>
          <ChannelSelect
            filter="text"
            value={form.channel_id}
            onChange={(v) =>
              setForm((f) => ({ ...f, channel_id: v === "__clear__" ? "" : v }))
            }
            placeholder="Select channel..."
            disabled={!isNew}
          />
          <p className="text-xs text-muted-foreground">
            Discord channel for sticky message
          </p>
        </div>

        {/* Embed toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="embed-toggle">Use Embed</Label>
          <Switch
            id="embed-toggle"
            checked={form.embed_enabled}
            onCheckedChange={(v) =>
              setForm((f) => ({ ...f, embed_enabled: v }))
            }
          />
        </div>

        {/* Plain text mode */}
        {!form.embed_enabled && (
          <div className="space-y-2">
            <Label>Content</Label>
            <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
              <Textarea
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
                placeholder="Sticky message content..."
                rows={4}
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
              />
              <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, content: f.content + em }))} />
            </div>
          </div>
        )}

        {/* Embed mode */}
        {form.embed_enabled && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Title</Label>
              <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                <Input
                  value={form.embed_title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, embed_title: e.target.value }))
                  }
                  placeholder="Title embed"
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, embed_title: f.embed_title + em }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                <Textarea
                  value={form.embed_description}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      embed_description: e.target.value,
                    }))
                  }
                  placeholder="Description embed..."
                  rows={4}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                />
                <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, embed_description: f.embed_description + em }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Embed color</Label>
              <div className="flex items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, embed_color: c }))
                    }
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-all",
                      form.embed_color?.toLowerCase() === c.toLowerCase()
                        ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Select color ${c}`}
                  />
                ))}
                <Input
                  className="w-24 h-8 text-xs font-mono"
                  value={form.embed_color}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, embed_color: e.target.value }))
                  }
                  placeholder="#5865F2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Footer</Label>
              <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                <Input
                  value={form.embed_footer}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, embed_footer: e.target.value }))
                  }
                  placeholder="Embed footer"
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, embed_footer: f.embed_footer + em }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                value={form.embed_image_url}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    embed_image_url: e.target.value,
                  }))
                }
                placeholder="https://example.com/image.png"
              />
            </div>

            <div className="space-y-2">
              <Label>Thumbnail URL</Label>
              <Input
                value={form.embed_thumbnail_url}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    embed_thumbnail_url: e.target.value,
                  }))
                }
                placeholder="https://example.com/thumb.png"
              />
            </div>

            {/* Live Discord embed preview */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Preview on Discord</Label>
              <DiscordPreview form={form} />
            </div>
          </div>
        )}

        <Separator />

        {/* Resend settings */}
        <p className="text-sm font-medium">Resend settings</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Resend after X messages</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={form.message_count_trigger}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  message_count_trigger: Math.max(
                    1,
                    Math.min(500, Number(e.target.value) || 1)
                  ),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Interval (minutes, 0=off)</Label>
            <Input
              type="number"
              min={0}
              max={10080}
              value={form.interval_minutes}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  interval_minutes: Math.max(
                    0,
                    Math.min(10080, Number(e.target.value) || 0)
                  ),
                }))
              }
            />
          </div>
        </div>

        {/* Pin toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="pin-toggle">Pin message</Label>
          <Switch
            id="pin-toggle"
            checked={form.is_pinned}
            onCheckedChange={(v) =>
              setForm((f) => ({ ...f, is_pinned: v }))
            }
          />
        </div>
      </div>
    </div>
  );
}
