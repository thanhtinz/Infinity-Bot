import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { RoleSelect } from "@/components/RoleSelect";
import { EmbedBuilder, EMBED_DEFAULTS } from "@/components/EmbedBuilder";
import type { EmbedFormData, EmbedField } from "@/components/EmbedBuilder";
import { EmojiPicker } from "@/components/EmojiPicker";
import { ArrowLeft, Plus, X, Save, Loader2 } from "lucide-react";
import { PageContainer } from "@/components/yuri";
import { apiFetch } from "@/hooks/useApi";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ButtonRoleItem {
  label: string;
  emoji: string;
  role_id: string;
  style: string;
  row: number;
}

interface ButtonRolePanel {
  id: number;
  name: string;
  buttons: ButtonRoleItem[];
  channel_id?: string;
  message_id?: string;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  embed_footer: string;
  embed_image_url: string;
  embed_thumbnail_url: string;
  embed_fields: EmbedField[];
  created_at: string;
}

interface PanelForm {
  name: string;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  embed_footer: string;
  embed_image_url: string;
  embed_thumbnail_url: string;
  embed_fields: EmbedField[];
  buttons: ButtonRoleItem[];
}

interface ButtonForm {
  label: string;
  emoji: string;
  role_id: string;
  style: string;
  row: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BUTTON_STYLES = [
  { key: "primary", label: "Primary", bg: "#5865F2", text: "#ffffff" },
  { key: "secondary", label: "Secondary", bg: "#4e5058", text: "#ffffff" },
  { key: "success", label: "Success", bg: "#57f287", text: "#000000" },
  { key: "danger", label: "Danger", bg: "#ed4245", text: "#ffffff" },
] as const;

const emptyPanelForm = (): PanelForm => ({
  name: "",
  embed_title: "",
  embed_description: "",
  embed_color: EMBED_DEFAULTS.color,
  embed_footer: "",
  embed_image_url: "",
  embed_thumbnail_url: "",
  embed_fields: [],
  buttons: [],
});

const emptyButtonForm = (): ButtonForm => ({
  label: "",
  emoji: "",
  role_id: "",
  style: "primary",
  row: 0,
});

// ─── Component ───────────────────────────────────────────────────────────────

export function ButtonRoleEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !id;

  const [form, setForm] = useState<PanelForm>(emptyPanelForm());

  // ── Fetch list, find item by id ──
  const { data: panels, isLoading } = useQuery<ButtonRolePanel[]>({
    queryKey: ["button-roles"],
    queryFn: () =>
      apiFetch("/api/welcome/button-roles").then((r) =>
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
        embed_title: item.embed_title ?? "",
        embed_description: item.embed_description ?? "",
        embed_color: item.embed_color ?? EMBED_DEFAULTS.color,
        embed_footer: item.embed_footer ?? "",
        embed_image_url: item.embed_image_url ?? "",
        embed_thumbnail_url: item.embed_thumbnail_url ?? "",
        embed_fields: item.embed_fields ?? [],
        buttons: item.buttons?.map((b) => ({ ...b })) ?? [],
      });
    }
  }, [item?.id]);

  // ── Mutations ──
  const createMutation = useMutation<any, Error, Record<string, unknown>>({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/api/welcome/button-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["button-roles"] });
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
      apiFetch(`/api/welcome/button-roles/${panelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["button-roles"] });
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
      embed_title: form.embed_title,
      embed_description: form.embed_description,
      embed_color: form.embed_color,
      embed_footer: form.embed_footer,
      embed_image_url: form.embed_image_url,
      embed_thumbnail_url: form.embed_thumbnail_url,
      embed_fields: form.embed_fields,
      buttons: form.buttons,
    };
    if (!isNew && id) {
      updateMutation.mutate({ id: Number(id), ...body });
    } else {
      createMutation.mutate(body);
    }
  };

  // ── Button form helpers ──
  const addButton = () => {
    setForm((prev) => ({
      ...prev,
      buttons: [...prev.buttons, emptyButtonForm()],
    }));
  };

  const removeButton = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== idx),
    }));
  };

  const updateButton = (idx: number, patch: Partial<ButtonForm>) => {
    setForm((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
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
        <h1 className="font-semibold text-lg">{isNew ? "Create" : "Edit"} Panel Button Role</h1>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <Save className="h-4 w-4 sm:mr-2" />}
            <span className="hidden sm:inline">{isPending ? "Saving..." : "Save"}</span>
          </Button>
        </div>
      </div>
      <PageContainer size="sm">
        {/* Name */}
        <div className="space-y-2">
          <Label>Name panel</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Choose a color"
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

        {/* Buttons builder */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Role Buttons</p>
            <Button variant="outline" size="sm" onClick={addButton}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add button
            </Button>
          </div>

          {form.buttons.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No buttons yet. Click "Add button" to get started.
            </p>
          )}

          <div className="space-y-3">
            {form.buttons.map((btn, idx) => (
              <div
                key={idx}
                className="rounded-lg border bg-muted/30 p-3 space-y-3"
              >
                {/* Button header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Button #{idx + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => removeButton(idx)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Label + Emoji */}
                <div className="grid grid-cols-[1fr_80px] gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={btn.label}
                      onChange={(e) =>
                        updateButton(idx, { label: e.target.value })
                      }
                      placeholder="e.g. Red"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Emoji</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        value={btn.emoji}
                        onChange={(e) =>
                          updateButton(idx, { emoji: e.target.value })
                        }
                        placeholder="🔴"
                        className="h-8 text-sm"
                      />
                      <EmojiPicker onSelect={(emoji) => updateButton(idx, { emoji })} />
                    </div>
                  </div>
                </div>

                {/* Role */}
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <RoleSelect
                    value={btn.role_id}
                    onChange={(v) => updateButton(idx, { role_id: v })}
                  />
                </div>

                {/* Style + Row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Button style</Label>
                    <Select
                      value={btn.style}
                      onValueChange={(v) => updateButton(idx, { style: v })}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUTTON_STYLES.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: s.bg }}
                              />
                              {s.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Row</Label>
                    <Select
                      value={String(btn.row)}
                      onValueChange={(v) =>
                        updateButton(idx, { row: Number(v) })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4].map((r) => (
                          <SelectItem key={r} value={String(r)}>
                            Row {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
