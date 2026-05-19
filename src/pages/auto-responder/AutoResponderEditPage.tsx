import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

import type { AutoResponderRule, EmbedField } from "./arTypes";
import type { RuleForm } from "./arTypes";
import { DEFAULT_COLOR, emptyEmbed, emptyField, emptyForm } from "./arConstants";
import { TriggerSection } from "./TriggerSection";
import { ResponseSection } from "./ResponseSection";
import { FilterSection } from "./FilterSection";
import { apiFetch } from "@/hooks/useApi";

export function AutoResponderEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !id;

  // ── Form state ──
  const [form, setForm] = useState<RuleForm>(emptyForm());

  // Collapsible sections
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [restrictionsOpen, setRestrictionsOpen] = useState(false);
  const [varsOpen, setVarsOpen] = useState(false);
  const [focusedInput, setFocusedInput] = useState<"text" | "embed_desc" | null>(null);

  // ── Fetch rule if editing ──
  const { isLoading } = useQuery<AutoResponderRule[]>({
    queryKey: ["auto-responders"],
    queryFn: () =>
      apiFetch("/api/auto-responders").then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      }),
    enabled: !isNew,
    staleTime: 60_000,
  });

  // Populate form when data arrives for editing
  const [populated, setPopulated] = useState(false);
  if (!isNew && !populated) {
    const rules = qc.getQueryData<AutoResponderRule[]>(["auto-responders"]);
    const rule = rules?.find((r) => String(r.id) === id);
    if (rule) {
      setForm({
        name: rule.name ?? "",
        trigger_type: rule.trigger_type ?? "contains",
        trigger_text: rule.trigger_text ?? "",
        ignore_case: rule.ignore_case ?? true,
        response_type: rule.response_type ?? "text",
        response_text: rule.response_text ?? "",
        response_embed: rule.response_embed
          ? {
              title: rule.response_embed.title ?? "",
              description: rule.response_embed.description ?? "",
              color: rule.response_embed.color ?? DEFAULT_COLOR,
              footer: rule.response_embed.footer ?? "",
              image_url: rule.response_embed.image_url ?? "",
              thumbnail_url: rule.response_embed.thumbnail_url ?? "",
              author_name: rule.response_embed.author_name ?? "",
              author_icon_url: rule.response_embed.author_icon_url ?? "",
              fields: rule.response_embed.fields?.map((f) => ({ ...f })) ?? [],
            }
          : emptyEmbed(),
        reaction_emojis: rule.reaction_emojis ?? [],
        reply_to_message: rule.reply_to_message ?? false,
        delete_trigger: rule.delete_trigger ?? false,
        send_dm: rule.send_dm ?? false,
        cooldown: rule.cooldown ?? 0,
        cooldown_type: rule.cooldown_type ?? "per_user",
        allowed_channels: rule.allowed_channels ?? [],
        blocked_channels: rule.blocked_channels ?? [],
        allowed_roles: rule.allowed_roles ?? [],
        blocked_roles: rule.blocked_roles ?? [],
        ignore_bots: rule.ignore_bots ?? true,
        enabled: rule.enabled ?? true,
        priority: rule.priority ?? 0,
      });
      setPopulated(true);
    }
  }

  // ── Mutations ──
  const createMutation = useMutation<any, Error, Record<string, unknown>>({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/api/auto-responders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auto-responders"] });
      navigate("/autoresponder");
      toast({ title: "Rule created successfully" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Failed to create rule",
        description: e.message,
      }),
  });

  const updateMutation = useMutation<any, Error, { id: number } & Record<string, unknown>>({
    mutationFn: ({ id: ruleId, ...body }: { id: number } & Record<string, unknown>) =>
      apiFetch(`/api/auto-responders/${ruleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auto-responders"] });
      navigate("/autoresponder");
      toast({ title: "Rule updated" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Update error",
        description: e.message,
      }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Derived ──
  const hasText = form.response_type === "text" || form.response_type === "text+react";
  const hasEmbed = form.response_type === "embed" || form.response_type === "embed+react";
  const hasReact = form.response_type === "react" || form.response_type === "text+react" || form.response_type === "embed+react";

  // ── Handlers ──
  const handleSave = () => {
    const body = {
      name: form.name,
      trigger_type: form.trigger_type,
      trigger_text: form.trigger_text,
      ignore_case: form.ignore_case,
      response_type: form.response_type,
      response_text: hasText ? form.response_text : null,
      response_embed: hasEmbed ? form.response_embed : null,
      reaction_emojis: hasReact ? form.reaction_emojis : [],
      reply_to_message: form.reply_to_message,
      delete_trigger: form.delete_trigger,
      send_dm: form.send_dm,
      cooldown: form.cooldown,
      cooldown_type: form.cooldown_type,
      allowed_channels: form.allowed_channels,
      blocked_channels: form.blocked_channels,
      allowed_roles: form.allowed_roles,
      blocked_roles: form.blocked_roles,
      ignore_bots: form.ignore_bots,
      enabled: form.enabled,
      priority: form.priority,
    };

    if (!isNew && id) {
      updateMutation.mutate({ id: Number(id), ...body });
    } else {
      createMutation.mutate(body);
    }
  };

  // ── Embed field helpers ──
  const addField = () => {
    setForm((prev) => ({
      ...prev,
      response_embed: {
        ...prev.response_embed,
        fields: [...prev.response_embed.fields, emptyField()],
      },
    }));
  };

  const removeField = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      response_embed: {
        ...prev.response_embed,
        fields: prev.response_embed.fields.filter((_, i) => i !== idx),
      },
    }));
  };

  const updateField = (idx: number, patch: Partial<EmbedField>) => {
    setForm((prev) => ({
      ...prev,
      response_embed: {
        ...prev.response_embed,
        fields: prev.response_embed.fields.map((f, i) =>
          i === idx ? { ...f, ...patch } : f
        ),
      },
    }));
  };

  // ── Emoji helpers ──
  const addEmoji = (emoji: string) => {
    if (!form.reaction_emojis.includes(emoji)) {
      setForm((p) => ({ ...p, reaction_emojis: [...p.reaction_emojis, emoji] }));
    }
  };

  const removeEmoji = (emoji: string) => {
    setForm((p) => ({
      ...p,
      reaction_emojis: p.reaction_emojis.filter((e) => e !== emoji),
    }));
  };

  // ── Channel helpers ──
  const addAllowedChannel = (chId: string) => {
    if (chId && !form.allowed_channels.includes(chId)) {
      setForm((p) => ({ ...p, allowed_channels: [...p.allowed_channels, chId] }));
    }
  };

  const removeAllowedChannel = (chId: string) => {
    setForm((p) => ({
      ...p,
      allowed_channels: p.allowed_channels.filter((c) => c !== chId),
    }));
  };

  const addBlockedChannel = (chId: string) => {
    if (chId && !form.blocked_channels.includes(chId)) {
      setForm((p) => ({ ...p, blocked_channels: [...p.blocked_channels, chId] }));
    }
  };

  const removeBlockedChannel = (chId: string) => {
    setForm((p) => ({
      ...p,
      blocked_channels: p.blocked_channels.filter((c) => c !== chId),
    }));
  };

  // ── Variable insertion ──
  const insertVariable = (key: string) => {
    if (focusedInput === "text") {
      setForm((p) => ({ ...p, response_text: p.response_text + key }));
    } else if (focusedInput === "embed_desc") {
      setForm((p) => ({
        ...p,
        response_embed: { ...p.response_embed, description: p.response_embed.description + key },
      }));
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
        <Button variant="ghost" size="icon" onClick={() => navigate("/autoresponder")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold">
          {isNew ? "Create Auto Responder" : "Edit Auto Responder"}
        </h1>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <Save className="h-4 w-4 sm:mr-2" />}
            <span className="hidden sm:inline">{isPending ? "Saving..." : "Save"}</span>
          </Button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <TriggerSection form={form} setForm={setForm} />

        <Separator />

        <ResponseSection
          form={form}
          setForm={setForm}
          hasText={hasText}
          hasEmbed={hasEmbed}
          hasReact={hasReact}
          varsOpen={varsOpen}
          setVarsOpen={setVarsOpen}
          setFocusedInput={setFocusedInput}
          addField={addField}
          removeField={removeField}
          updateField={updateField}
          addEmoji={addEmoji}
          removeEmoji={removeEmoji}
          insertVariable={insertVariable}
        />

        <Separator />

        <FilterSection
          form={form}
          setForm={setForm}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          restrictionsOpen={restrictionsOpen}
          setRestrictionsOpen={setRestrictionsOpen}
          addAllowedChannel={addAllowedChannel}
          removeAllowedChannel={removeAllowedChannel}
          addBlockedChannel={addBlockedChannel}
          removeBlockedChannel={removeBlockedChannel}
        />
      </div>
    </div>
  );
}
