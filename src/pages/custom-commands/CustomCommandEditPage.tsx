import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Terminal,
} from "lucide-react";
import type { CustomCommand, EmbedField } from "./ccTypes";
import {
  DEFAULT_COLOR,
  emptyEmbed,
  emptyField,
  emptyForm,
} from "./ccConstants";
import type { CommandForm } from "./ccTypes";
import { VariablesReference } from "./VariablesReference";
import { CommandOptionsSection } from "./CommandOptionsSection";
import { CommandPermissionsSection } from "./CommandPermissionsSection";
import { CommandAdvancedSection } from "./CommandAdvancedSection";
import { CommandAdditionalResponses } from "./CommandAdditionalResponses";
import { CommandResponseSection } from "./CommandResponseSection";
import { CommandSettingsSection } from "./CommandSettingsSection";

export function CustomCommandEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !id;

  // ── Form state ──
  const [form, setForm] = useState<CommandForm>(emptyForm());
  const [aliasInput, setAliasInput] = useState("");
  const [varsOpen, setVarsOpen] = useState(false);
  const [focusedInput, setFocusedInput] = useState<"text" | "embed_desc" | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [advOpts2Open, setAdvOpts2Open] = useState(false);
  const [addRespOpen, setAddRespOpen] = useState(false);

  // ── Fetch command if editing ──
  const { isLoading } = useQuery<CustomCommand[]>({
    queryKey: ["custom-commands"],
    queryFn: () =>
      fetch("/api/custom-commands", { credentials: "include" }).then((r) =>
        r.json()
      ),
    enabled: !isNew,
    staleTime: 60_000,
  });

  // Populate form when data arrives for editing
  const [populated, setPopulated] = useState(false);
  if (!isNew && !populated) {
    const commands = qc.getQueryData<CustomCommand[]>(["custom-commands"]);
    const cmd = commands?.find((c) => String(c.id) === id);
    if (cmd) {
      setForm({
        name: cmd.name,
        description: cmd.description ?? "",
        response_type: cmd.response_type ?? "text",
        response_text: cmd.response_text ?? "",
        response_embed: cmd.response_embed
          ? {
              title: cmd.response_embed.title ?? "",
              description: cmd.response_embed.description ?? "",
              color: cmd.response_embed.color ?? DEFAULT_COLOR,
              fields: cmd.response_embed.fields?.map((f) => ({ ...f })) ?? [],
              footer: cmd.response_embed.footer ?? "",
              thumbnail_url: cmd.response_embed.thumbnail_url ?? "",
              image_url: cmd.response_embed.image_url ?? "",
              author: cmd.response_embed.author ?? "",
            }
          : emptyEmbed(),
        ephemeral: cmd.ephemeral ?? false,
        required_roles: cmd.required_roles ?? [],
        enabled: cmd.enabled ?? true,
        aliases: cmd.aliases ?? [],
        cooldown: cmd.cooldown ?? 0,
        allowed_channels: cmd.allowed_channels ?? [],
        delete_trigger: cmd.delete_trigger ?? false,
        auto_react: cmd.auto_react ?? "",
        silent: cmd.silent ?? false,
        dm_response: cmd.dm_response ?? false,
        no_everyone: cmd.no_everyone ?? false,
        allowed_roles: cmd.allowed_roles ?? [],
        ignored_roles: cmd.ignored_roles ?? [],
        ignored_channels: cmd.ignored_channels ?? [],
        response_channel_id: cmd.response_channel_id ?? "",
        delete_after: cmd.delete_after ?? 0,
        required_args: cmd.required_args ?? 0,
        additional_responses: cmd.additional_responses ?? [],
      });
      setPopulated(true);
    }
  }

  // ── Mutations ──
  const createMutation = useMutation<any, Error, Record<string, unknown>>({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/custom-commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-commands"] });
      navigate("/custom-commands");
      toast({ title: "Đã tạo command thành công" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi tạo command",
        description: e.message,
      }),
  });

  const updateMutation = useMutation<any, Error, { id: number } & Record<string, unknown>>({
    mutationFn: ({ id: cmdId, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/custom-commands/${cmdId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-commands"] });
      navigate("/custom-commands");
      toast({ title: "Đã cập nhật command" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật",
        description: e.message,
      }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Handlers ──
  const handleSave = () => {
    const body = {
      name: form.name,
      description: form.description,
      response_type: form.response_type,
      response_text: form.response_type === "text" ? form.response_text : "",
      response_embed:
        form.response_type === "embed" ? form.response_embed : null,
      ephemeral: form.ephemeral,
      required_roles: form.required_roles,
      enabled: form.enabled,
      aliases: form.aliases,
      cooldown: form.cooldown,
      allowed_channels: form.allowed_channels,
      delete_trigger: form.delete_trigger,
      auto_react: form.auto_react || null,
      silent: form.silent,
      dm_response: form.dm_response,
      no_everyone: form.no_everyone,
      allowed_roles: form.allowed_roles,
      ignored_roles: form.ignored_roles,
      ignored_channels: form.ignored_channels,
      response_channel_id: form.response_channel_id || null,
      delete_after: form.delete_after,
      required_args: form.required_args,
      additional_responses: form.additional_responses,
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

  // ── Alias helpers ──
  const addAlias = () => {
    const trimmed = aliasInput.trim().toLowerCase().replace(/\s/g, "");
    if (trimmed && !form.aliases.includes(trimmed)) {
      setForm((p) => ({ ...p, aliases: [...p.aliases, trimmed] }));
    }
    setAliasInput("");
  };

  const removeAlias = (alias: string) => {
    setForm((p) => ({ ...p, aliases: p.aliases.filter((a) => a !== alias) }));
  };

  const handleAliasKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addAlias();
    }
  };

  // ── Channel helpers ──
  const addChannel = (chId: string) => {
    if (chId && !form.allowed_channels.includes(chId)) {
      setForm((p) => ({ ...p, allowed_channels: [...p.allowed_channels, chId] }));
    }
  };

  const removeChannel = (chId: string) => {
    setForm((p) => ({
      ...p,
      allowed_channels: p.allowed_channels.filter((c) => c !== chId),
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
        <Button variant="ghost" size="icon" onClick={() => navigate("/custom-commands")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold">
          {isNew ? "Tạo Custom Command" : "Edit Command"}
        </h1>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* ── Section: Basic Info ── */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5" />
            Thông tin cơ bản
          </p>

          {/* Name */}
          <div className="space-y-2">
            <Label>Tên Command</Label>
            <div className="flex items-center gap-0">
              <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 h-9 text-sm font-mono text-muted-foreground">
                !
              </span>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    name: e.target.value.replace(/\s/g, "").toLowerCase(),
                  }))
                }
                placeholder="tên_command"
                className="rounded-l-none"
              />
            </div>
            {form.name && (
              <p className="text-xs text-muted-foreground">
                Preview: <span className="font-mono font-medium">!{form.name}</span>
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="Mô tả ngắn về lệnh này"
            />
          </div>
        </div>

        <Separator />

        {/* ── Section: Response ── */}
        <CommandResponseSection
          form={form}
          onFormChange={setForm}
          varsOpen={varsOpen}
          onToggleVars={() => setVarsOpen(!varsOpen)}
          onInsertVariable={insertVariable}
          onAddField={addField}
          onRemoveField={removeField}
          onUpdateField={updateField}
          onFocusEmbedDesc={() => setFocusedInput("embed_desc")}
        />

        <Separator />

        {/* ── Section: Variables Reference ── */}
        <VariablesReference />

        <Separator />

        {/* ── Section: Settings ── */}
        <CommandSettingsSection
          form={form}
          onFormChange={setForm}
          aliasInput={aliasInput}
          onAliasInputChange={setAliasInput}
          onAliasKeyDown={handleAliasKeyDown}
          onAddAlias={addAlias}
          onRemoveAlias={removeAlias}
          onAddChannel={addChannel}
          onRemoveChannel={removeChannel}
          advancedOpen={advancedOpen}
          onAdvancedOpenChange={setAdvancedOpen}
        />

        <Separator />

        {/* ── Section: Options ── */}
        <CommandOptionsSection form={form} onFormChange={setForm} open={optionsOpen} onOpenChange={setOptionsOpen} />

        <Separator />

        {/* ── Section: Permissions ── */}
        <CommandPermissionsSection form={form} onFormChange={setForm} open={permOpen} onOpenChange={setPermOpen} />

        <Separator />

        {/* ── Section: Advanced Options ── */}
        <CommandAdvancedSection form={form} onFormChange={setForm} open={advOpts2Open} onOpenChange={setAdvOpts2Open} />

        <Separator />

        {/* ── Section: Additional Responses ── */}
        <CommandAdditionalResponses form={form} onFormChange={setForm} open={addRespOpen} onOpenChange={setAddRespOpen} />
      </div>
    </div>
  );
}
