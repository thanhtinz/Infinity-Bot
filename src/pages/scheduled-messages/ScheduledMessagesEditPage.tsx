import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ChannelSelect } from "@/components/ChannelSelect";
import {
  ArrowLeft,
  CalendarClock,
  FileText,
  Layout,
  ToggleLeft,
  Save,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { EmbedField, ScheduledMessage, FormState } from "./smTypes";
import { emptyEmbed, emptyForm, toDatetimeLocal } from "./smConstants";
import { EmbedEditorSection } from "./EmbedEditorSection";
import { apiFetch } from "@/hooks/useApi";

// ─── Component ───────────────────────────────────────────────────────────────

export function ScheduledMessagesEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !id;

  const [form, setForm] = useState<FormState>(emptyForm());

  // Embed collapsible sections
  const [embedBodyOpen, setEmbedBodyOpen] = useState(true);
  const [embedAuthorOpen, setEmbedAuthorOpen] = useState(false);
  const [embedFieldsOpen, setEmbedFieldsOpen] = useState(false);
  const [embedImagesOpen, setEmbedImagesOpen] = useState(false);
  const [embedFooterOpen, setEmbedFooterOpen] = useState(false);
  const [embedPreviewOpen, setEmbedPreviewOpen] = useState(true);

  // ── Fetch list, find item by id ──
  const { data: messages, isLoading } = useQuery<ScheduledMessage[]>({
    queryKey: ["scheduled-messages"],
    queryFn: () =>
      apiFetch("/api/scheduled-messages").then((r) =>
        r.json()
      ),
    enabled: !isNew,
  });

  const item = id ? messages?.find((x) => String(x.id) === id) : undefined;

  // Populate form when item loads
  useEffect(() => {
    if (item) {
      setForm({
        channel_id: item.channel_id,
        content: item.content ?? "",
        add_embed: !!item.embed_data,
        embed_data: item.embed_data ?? emptyEmbed(),
        send_at: toDatetimeLocal(item.send_at),
        repeat_type: item.repeat_type,
        enabled: item.enabled,
      });
    }
  }, [item?.id]);

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (body: Partial<FormState>) =>
      apiFetch("/api/scheduled-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
      navigate(-1);
      toast({ title: "Scheduled message created." });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id: msgId, ...body }: { id: number } & Partial<FormState>) =>
      apiFetch(`/api/scheduled-messages/${msgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
      navigate(-1);
      toast({ title: "Schedule updated." });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSave = () => {
    const body: Record<string, unknown> = {
      channel_id: form.channel_id,
      content: form.content,
      embed_data: form.add_embed ? form.embed_data : null,
      send_at: form.send_at,
      repeat_type: form.repeat_type,
      enabled: form.enabled,
    };

    if (!isNew && id) {
      updateMutation.mutate({ id: Number(id), ...body });
    } else {
      createMutation.mutate(body);
    }
  };

  // ── Embed field helpers ──
  const addEmbedField = () => {
    setForm((f) => ({
      ...f,
      embed_data: {
        ...f.embed_data,
        fields: [...f.embed_data.fields, { name: "", value: "", inline: false }],
      },
    }));
  };

  const removeEmbedField = (idx: number) => {
    setForm((f) => ({
      ...f,
      embed_data: {
        ...f.embed_data,
        fields: f.embed_data.fields.filter((_, i) => i !== idx),
      },
    }));
  };

  const updateEmbedField = (idx: number, patch: Partial<EmbedField>) => {
    setForm((f) => ({
      ...f,
      embed_data: {
        ...f.embed_data,
        fields: f.embed_data.fields.map((field, i) =>
          i === idx ? { ...field, ...patch } : field
        ),
      },
    }));
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
      <div className="sticky top-0 z-10 border-b bg-card px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold text-lg">{isNew ? "Create" : "Edit"} schedule</h1>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={!form.channel_id || !form.send_at || isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <Save className="h-4 w-4 sm:mr-2" />}
            <span className="hidden sm:inline">{isPending ? "Saving..." : "Save"}</span>
          </Button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* ── Section 1: Send settings ── */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            ⏰ Send settings
          </p>

          <div className="grid grid-cols-2 gap-4">
            {/* Channel select */}
            <div className="space-y-2">
              <Label>Channel</Label>
              <ChannelSelect
                filter="text"
                value={form.channel_id}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    channel_id: v === "__clear__" ? "" : v,
                  }))
                }
                placeholder="Select channel..."
              />
            </div>

            {/* Time picker */}
            <div className="space-y-2">
              <Label>Send duration</Label>
              <Input
                type="datetime-local"
                value={form.send_at}
                onChange={(e) =>
                  setForm((f) => ({ ...f, send_at: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Repeat type */}
            <div className="space-y-2">
              <Label>Repeat</Label>
              <Select
                value={form.repeat_type}
                onValueChange={(v: ScheduledMessage["repeat_type"]) =>
                  setForm((f) => ({ ...f, repeat_type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No repeat</SelectItem>
                  <SelectItem value="hourly">Every hour</SelectItem>
                  <SelectItem value="daily">Every day</SelectItem>
                  <SelectItem value="weekly">Every week</SelectItem>
                  <SelectItem value="monthly">Every month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Enabled toggle — card style */}
            <div className="space-y-2">
              <Label>Status</Label>
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3 transition-colors cursor-pointer select-none",
                  form.enabled
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/30 border-muted"
                )}
                onClick={() =>
                  setForm((f) => ({ ...f, enabled: !f.enabled }))
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setForm((f) => ({ ...f, enabled: !f.enabled }));
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <ToggleLeft className={cn("h-4 w-4", form.enabled ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-sm font-medium", form.enabled ? "text-primary" : "text-muted-foreground")}>
                    {form.enabled ? "Active" : "Inactive"}
                  </span>
                </div>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, enabled: checked }))
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Section 2: Content ── */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            📝 Content
          </p>

          {/* Message content */}
          <div className="space-y-2">
            <Label>Message content</Label>
            <Textarea
              value={form.content}
              onChange={(e) =>
                setForm((f) => ({ ...f, content: e.target.value }))
              }
              placeholder="Message content to send..."
              rows={4}
            />
          </div>

          {/* Add embed toggle — styled button */}
          <button
            type="button"
            onClick={() =>
              setForm((f) => ({
                ...f,
                add_embed: !f.add_embed,
                embed_data: !f.add_embed ? f.embed_data : emptyEmbed(),
              }))
            }
            className={cn(
              "flex w-full items-center justify-between rounded-lg border p-3 transition-all",
              form.add_embed
                ? "bg-indigo-500/10 border-indigo-500/30"
                : "bg-muted/30 border-muted hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md",
                form.add_embed ? "bg-indigo-500/20" : "bg-muted"
              )}>
                <Layout className={cn("h-4 w-4", form.add_embed ? "text-indigo-500" : "text-muted-foreground")} />
              </div>
              <div className="text-left">
                <p className={cn("text-sm font-medium", form.add_embed ? "text-indigo-600 dark:text-indigo-400" : "text-foreground")}>
                  Add Embed
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Send a rich embed along with the message
                </p>
              </div>
            </div>
            <Switch
              checked={form.add_embed}
              onCheckedChange={(checked) =>
                setForm((f) => ({
                  ...f,
                  add_embed: checked,
                  embed_data: checked ? f.embed_data : emptyEmbed(),
                }))
              }
              onClick={(e) => e.stopPropagation()}
            />
          </button>
        </div>

        {/* ── Section 3: Config Embed ── */}
        {form.add_embed && (
          <>
            <Separator />
            <EmbedEditorSection
              embedData={form.embed_data}
              setForm={setForm}
              embedBodyOpen={embedBodyOpen}
              setEmbedBodyOpen={setEmbedBodyOpen}
              embedAuthorOpen={embedAuthorOpen}
              setEmbedAuthorOpen={setEmbedAuthorOpen}
              embedFieldsOpen={embedFieldsOpen}
              setEmbedFieldsOpen={setEmbedFieldsOpen}
              embedImagesOpen={embedImagesOpen}
              setEmbedImagesOpen={setEmbedImagesOpen}
              embedFooterOpen={embedFooterOpen}
              setEmbedFooterOpen={setEmbedFooterOpen}
              embedPreviewOpen={embedPreviewOpen}
              setEmbedPreviewOpen={setEmbedPreviewOpen}
              addEmbedField={addEmbedField}
              removeEmbedField={removeEmbedField}
              updateEmbedField={updateEmbedField}
            />
          </>
        )}
      </div>
    </div>
  );
}
