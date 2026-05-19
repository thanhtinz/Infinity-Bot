import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ChannelSelect } from "@/components/ChannelSelect";
import { RoleSelect } from "@/components/RoleSelect";
import { EmbedBuilder, EMBED_DEFAULTS } from "@/components/EmbedBuilder";
import type { EmbedFormData, EmbedField } from "@/components/EmbedBuilder";
import { EmojiPicker } from "@/components/EmojiPicker";
import { ArrowLeft, Plus, X, Save, Loader2 } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReactionMapping {
  emoji: string;
  role_id: string;
  label: string;
}

interface ReactionRolePanel {
  id: number;
  name: string;
  channel_id?: string;
  message_id?: string;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  embed_footer: string;
  embed_image_url: string;
  embed_thumbnail_url: string;
  embed_fields: EmbedField[];
  mappings: ReactionMapping[];
  created_at: string;
}

interface PanelForm {
  name: string;
  channel_id: string;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  embed_footer: string;
  embed_image_url: string;
  embed_thumbnail_url: string;
  embed_fields: EmbedField[];
  mappings: ReactionMapping[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const emptyPanelForm = (): PanelForm => ({
  name: "",
  channel_id: "",
  embed_title: "",
  embed_description: "",
  embed_color: EMBED_DEFAULTS.color,
  embed_footer: "",
  embed_image_url: "",
  embed_thumbnail_url: "",
  embed_fields: [],
  mappings: [],
});

const emptyMapping = (): ReactionMapping => ({
  emoji: "",
  role_id: "",
  label: "",
});

// ─── Component ───────────────────────────────────────────────────────────────

export function ReactionRoleEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !id;

  const [form, setForm] = useState<PanelForm>(emptyPanelForm());

  // ── Fetch list, find item by id ──
  const { data: panels, isLoading } = useQuery<ReactionRolePanel[]>({
    queryKey: ["reaction-roles"],
    queryFn: () =>
      apiFetch("/api/reaction-roles").then((r) =>
        r.json()
      ),
    enabled: !isNew,
    staleTime: 60_000,
  });

  const item = id ? panels?.find((x) => String(x.id) === id) : undefined;

  // Populate form when item loads
  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        channel_id: item.channel_id ?? "",
        embed_title: item.embed_title ?? "",
        embed_description: item.embed_description ?? "",
        embed_color: item.embed_color ?? EMBED_DEFAULTS.color,
        embed_footer: item.embed_footer ?? "",
        embed_image_url: item.embed_image_url ?? "",
        embed_thumbnail_url: item.embed_thumbnail_url ?? "",
        embed_fields: item.embed_fields ?? [],
        mappings: item.mappings?.map((m) => ({ ...m })) ?? [],
      });
    }
  }, [item?.id]);

  // ── Mutations ──
  const createMutation = useMutation<any, Error, Record<string, unknown>>({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/api/reaction-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reaction-roles"] });
      navigate(-1);
      toast({ title: "Panel created" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Error creating panel",
        description: e.message,
      }),
  });

  const updateMutation = useMutation<any, Error, { id: number } & Record<string, unknown>>({
    mutationFn: ({ id: panelId, ...body }: { id: number } & Record<string, unknown>) =>
      apiFetch(`/api/reaction-roles/${panelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reaction-roles"] });
      navigate(-1);
      toast({ title: "Panel updated" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Update error",
        description: e.message,
      }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSave = () => {
    const body = {
      name: form.name,
      channel_id: form.channel_id,
      embed_title: form.embed_title,
      embed_description: form.embed_description,
      embed_color: form.embed_color,
      embed_footer: form.embed_footer,
      embed_image_url: form.embed_image_url,
      embed_thumbnail_url: form.embed_thumbnail_url,
      embed_fields: form.embed_fields,
      mappings: form.mappings,
    };
    if (!isNew && id) {
      updateMutation.mutate({ id: Number(id), ...body });
    } else {
      createMutation.mutate(body);
    }
  };

  // ── Mapping form helpers ──
  const addMapping = () => {
    setForm((prev) => ({
      ...prev,
      mappings: [...prev.mappings, emptyMapping()],
    }));
  };

  const removeMapping = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      mappings: prev.mappings.filter((_, i) => i !== idx),
    }));
  };

  const updateMapping = (idx: number, patch: Partial<ReactionMapping>) => {
    setForm((prev) => ({
      ...prev,
      mappings: prev.mappings.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
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
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b px-6 py-3.5 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg tracking-tight">{isNew ? "Create Reaction Role" : "Edit Reaction Role"}</h1>
          <p className="text-xs text-muted-foreground">{isNew ? "Create new reaction role panel" : "Edit reaction role panel"}</p>
        </div>
        <Button className="rounded-xl gap-2" onClick={handleSave} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="hidden sm:inline">{isPending ? "Saving..." : "Save"}</span>
        </Button>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <Label>Name Panel</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Choose a color"
          />
        </div>

        {/* Channel */}
        <div className="space-y-2">
          <Label>Channel</Label>
          <ChannelSelect
            value={form.channel_id}
            onChange={(v) => setForm((p) => ({ ...p, channel_id: v }))}
            placeholder="Select channel for panel"
            filter="text"
          />
        </div>

        <Separator />

        {/* Embed settings */}
        <div className="space-y-4">
          <p className="text-sm font-medium">Settings Embed</p>
          <EmbedBuilder
            data={{
              title: form.embed_title,
              description: form.embed_description,
              color: form.embed_color,
              footer: form.embed_footer,
              image_url: form.embed_image_url,
              thumbnail_url: form.embed_thumbnail_url,
              fields: form.embed_fields,
            }}
            onChange={(ed: EmbedFormData) => {
              setForm((p) => ({
                ...p,
                embed_title: ed.title,
                embed_description: ed.description,
                embed_color: ed.color,
                embed_footer: ed.footer,
                embed_image_url: ed.image_url,
                embed_thumbnail_url: ed.thumbnail_url,
                embed_fields: ed.fields,
              }));
            }}
            compact
          />
        </div>

        <Separator />

        {/* Mappings builder */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Emoji → Role</p>
            <Button variant="outline" size="sm" onClick={addMapping}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>

          {form.mappings.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No mappings yet. Click "Add" to get started.
            </p>
          )}

          <div className="space-y-3">
            {form.mappings.map((mapping, idx) => (
              <div
                key={idx}
                className="rounded-lg border bg-muted/30 p-3 space-y-3"
              >
                {/* Mapping header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Mapping #{idx + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => removeMapping(idx)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Emoji + Label */}
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Emoji</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        value={mapping.emoji}
                        onChange={(e) =>
                          updateMapping(idx, { emoji: e.target.value })
                        }
                        placeholder="🔴"
                        className="h-8 text-sm"
                      />
                      <EmojiPicker
                        onSelect={(emoji) => updateMapping(idx, { emoji })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={mapping.label}
                      onChange={(e) =>
                        updateMapping(idx, { label: e.target.value })
                      }
                      placeholder="e.g. Red"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                {/* Role */}
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <RoleSelect
                    value={mapping.role_id}
                    onChange={(v) => updateMapping(idx, { role_id: v })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
