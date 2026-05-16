import { apiFetch } from "@/hooks/useApi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { EmbedField, CustomEmbed, EmbedData, CustomFormState, ActionRow, MessageFlags, AllowedMentions, EmbedOpenState } from "./embedTypes";
import { emptyEmbed, defaultEmbedOpen, emptyCustomForm, migrateToEmbeds } from "./customMessagesHelpers";

export function useCustomMessagesMutations(
  form: CustomFormState,
  setForm: React.Dispatch<React.SetStateAction<CustomFormState>>,
  selectedId: number | null,
  setSelectedId: (id: number | null) => void,
  editingExistingId: number | null,
  setEditingExistingId: (id: number | null) => void,
  _isCreatingNew: boolean,
  setIsCreatingNew: (v: boolean) => void,
  linkInput: string,
  setLinkInput: (v: string) => void,
  _selectedChannelId: string,
  setSelectedChannelId: (v: string) => void,
  _embedOpenStates: EmbedOpenState[],
  setEmbedOpenStates: React.Dispatch<React.SetStateAction<EmbedOpenState[]>>,
  setThreadOpen: (v: boolean) => void,
  setProfileOpen: (v: boolean) => void,
  setBackupsOpen: (v: boolean) => void,
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (body: CustomFormState) => {
      const res = await apiFetch("/api/embeds/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Create failed");
      return res.json() as Promise<CustomEmbed>;
    },
    onSuccess: (data) => {
      toast({ title: "Created", description: "New embed created." });
      queryClient.invalidateQueries({ queryKey: ["custom-embeds"] });
      setEditingExistingId(data.id);
      setSelectedId(data.id);
      setIsCreatingNew(false);
      setSelectedChannelId(data.channel_id || "");
    },
    onError: () => {
      toast({ title: "Error", description: "Could not create embed.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: CustomFormState }) => {
      const res = await apiFetch(`/api/embeds/custom/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Embed updated." });
      queryClient.invalidateQueries({ queryKey: ["custom-embeds"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save embed.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/embeds/custom/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Embed deleted." });
      queryClient.invalidateQueries({ queryKey: ["custom-embeds"] });
      if (selectedId === editingExistingId) {
        setSelectedId(null);
        setEditingExistingId(null);
        setForm(emptyCustomForm);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete embed.", variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async ({ id, channel_id }: { id: number; channel_id: string }) => {
      const res = await apiFetch(`/api/embeds/custom/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ channel_id }),
      });
      if (!res.ok) throw new Error("Send failed");
      return res.json() as Promise<CustomEmbed & { message_url?: string }>;
    },
    onSuccess: () => {
      toast({ title: "Sent", description: "Embed sent to Discord." });
      queryClient.invalidateQueries({ queryKey: ["custom-embeds"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not send embed to Discord.", variant: "destructive" });
    },
  });

  const updateMessageMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/embeds/custom/${id}/update-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Update message failed");
      return res.json() as Promise<{ ok: boolean; message_url?: string }>;
    },
    onSuccess: (_data) => {
      toast({ title: "Updated", description: "Discord message updated." });
      queryClient.invalidateQueries({ queryKey: ["custom-embeds"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update Discord message.", variant: "destructive" });
    },
  });

  const loadLinkMutation = useMutation({
    mutationFn: async (link: string) => {
      const res = await apiFetch("/api/embeds/custom/load-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ link }),
      });
      if (!res.ok) throw new Error("Load link failed");
      return res.json() as Promise<CustomEmbed & { is_new?: boolean }>;
    },
    onSuccess: (data) => {
      toast({ title: "Loaded", description: "Embed loaded from link." });
      queryClient.invalidateQueries({ queryKey: ["custom-embeds"] });
      setSelectedId(data.id);
      setEditingExistingId(data.id);
      const loadedEmbeds = migrateToEmbeds(data);
      setForm({
        name: data.name,
        content: data.content ?? "",
        webhook_username: data.webhook_username ?? "",
        webhook_avatar_url: data.webhook_avatar_url ?? "",
        thread_name: data.thread_name ?? "",
        embeds: loadedEmbeds,
        components: data.components ?? [],
        flags: data.flags ?? {},
        allowed_mentions: data.allowed_mentions ?? {},
      });
      setEmbedOpenStates(loadedEmbeds.map(() => defaultEmbedOpen()));
      setLinkInput("");
    },
    onError: () => {
      toast({ title: "Error", description: "Could not load embed from link. Check the Discord link.", variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/embeds/custom/${id}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Duplicate failed");
      return res.json() as Promise<CustomEmbed>;
    },
    onSuccess: () => {
      toast({ title: "Duplicated", description: "Message duplicated." });
      queryClient.invalidateQueries({ queryKey: ["custom-embeds"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not duplicate.", variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (body: object) => {
      const res = await apiFetch("/api/embeds/custom/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Import failed");
      return res.json() as Promise<CustomEmbed>;
    },
    onSuccess: (data) => {
      toast({ title: "Imported", description: "Message created from JSON." });
      queryClient.invalidateQueries({ queryKey: ["custom-embeds"] });
      handleSelectEmbed(data);
    },
    onError: () => {
      toast({ title: "Error", description: "Could not import JSON.", variant: "destructive" });
    },
  });

  // ── Handlers ──
  const handleCreateNew = () => {
    setSelectedId(null);
    setEditingExistingId(null);
    setIsCreatingNew(true);
    setSelectedChannelId("");
    setForm(emptyCustomForm);
    setEmbedOpenStates([defaultEmbedOpen()]);
    setThreadOpen(false);
    setProfileOpen(false);
  };

  const handleSelectEmbed = (embed: CustomEmbed) => {
    setSelectedId(embed.id);
    setEditingExistingId(embed.id);
    setIsCreatingNew(false);
    setSelectedChannelId(embed.channel_id || "");
    const loadedEmbeds = migrateToEmbeds(embed);
    setForm({
      name: embed.name,
      content: embed.content ?? "",
      webhook_username: embed.webhook_username ?? "",
      webhook_avatar_url: embed.webhook_avatar_url ?? "",
      thread_name: embed.thread_name ?? "",
      embeds: loadedEmbeds,
      components: embed.components ?? [],
      flags: embed.flags ?? {},
      allowed_mentions: embed.allowed_mentions ?? {},
    });
    setEmbedOpenStates(loadedEmbeds.map(() => defaultEmbedOpen()));
    setThreadOpen(false);
    setProfileOpen(false);
  };

  const handleSave = () => {
    if (editingExistingId) {
      updateMutation.mutate({ id: editingExistingId, body: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleSend = (channelId: string) => {
    if (!editingExistingId) return;
    sendMutation.mutate({ id: editingExistingId, channel_id: channelId });
  };

  const handleUpdateMessage = () => {
    if (!editingExistingId) return;
    updateMessageMutation.mutate(editingExistingId);
  };

  const handleLoadLink = () => {
    if (!linkInput.trim()) return;
    loadLinkMutation.mutate(linkInput.trim());
  };

  // ── Multi-embed helpers ──
  const addEmbed = () => {
    if (form.embeds.length >= 10) return;
    setForm((f) => ({ ...f, embeds: [...f.embeds, emptyEmbed()] }));
    setEmbedOpenStates((s) => [...s, defaultEmbedOpen()]);
  };

  const removeEmbed = (idx: number) => {
    if (form.embeds.length <= 1) {
      toast({ title: "Cannot remove", description: "At least 1 embed required.", variant: "destructive" });
      return;
    }
    setForm((f) => ({ ...f, embeds: f.embeds.filter((_, i) => i !== idx) }));
    setEmbedOpenStates((s) => s.filter((_, i) => i !== idx));
  };

  const duplicateEmbed = (idx: number) => {
    const clone = JSON.parse(JSON.stringify(form.embeds[idx])) as EmbedData;
    const newEmbeds = [...form.embeds];
    newEmbeds.splice(idx + 1, 0, clone);
    setForm((f) => ({ ...f, embeds: newEmbeds }));
    setEmbedOpenStates((s) => {
      const ns = [...s];
      ns.splice(idx + 1, 0, defaultEmbedOpen());
      return ns;
    });
  };

  const moveEmbed = (idx: number, dir: "up" | "down") => {
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= form.embeds.length) return;
    const newEmbeds = [...form.embeds];
    [newEmbeds[idx], newEmbeds[target]] = [newEmbeds[target], newEmbeds[idx]];
    setForm((f) => ({ ...f, embeds: newEmbeds }));
    setEmbedOpenStates((s) => {
      const ns = [...s];
      [ns[idx], ns[target]] = [ns[target], ns[idx]];
      return ns;
    });
  };

  const updateEmbed = (idx: number, patch: Partial<EmbedData>) => {
    setForm((f) => ({
      ...f,
      embeds: f.embeds.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    }));
  };

  const setEmbedOpenState = (idx: number, patch: Partial<EmbedOpenState>) => {
    setEmbedOpenStates((s) => s.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  };

  // ── Field helpers (per embed) ──
  const addField = (embedIdx: number) => {
    const emb = form.embeds[embedIdx];
    if (!emb || emb.fields.length >= 25) return;
    updateEmbed(embedIdx, { fields: [...emb.fields, { name: "", value: "", inline: false }] });
  };

  const removeField = (embedIdx: number, fieldIdx: number) => {
    const emb = form.embeds[embedIdx];
    if (!emb) return;
    updateEmbed(embedIdx, { fields: emb.fields.filter((_, i) => i !== fieldIdx) });
  };

  const updateField = (embedIdx: number, fieldIdx: number, key: keyof EmbedField, val: string | boolean) => {
    const emb = form.embeds[embedIdx];
    if (!emb) return;
    updateEmbed(embedIdx, {
      fields: emb.fields.map((f, i) => (i === fieldIdx ? { ...f, [key]: val } : f)),
    });
  };

  // ── JSON Editor ──
  const handleApplyJson = (content: string, embeds: EmbedData[]) => {
    setForm((f) => ({ ...f, content, embeds }));
    setEmbedOpenStates(embeds.map(() => defaultEmbedOpen()));
  };

  const copyQueryData = () => {
    const data = JSON.stringify({ content: form.content, embeds: form.embeds }, null, 2);
    navigator.clipboard.writeText(data);
    toast({ title: "JSON copied!" });
  };

  // ── Share via URL ──
  const handleShare = () => {
    const payload = { content: form.content, embeds: form.embeds, components: form.components };
    const b64 = btoa(encodeURIComponent(JSON.stringify(payload)));
    const url = `${window.location.origin}${window.location.pathname}?tab=custom&share=${b64}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Share link copied!", description: "Anyone with this link can view the message." });
  };

  // ── Backups (localStorage) ──
  const BACKUP_KEY = "discord_embed_backups";
  const getBackups = (): { id: string; name: string; timestamp: string; data: object }[] => {
    try { return JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]"); } catch { return []; }
  };
  const saveBackup = () => {
    const backups = getBackups();
    const id = Date.now().toString();
    const backup = {
      id,
      name: form.name || "Untitled",
      timestamp: new Date().toISOString(),
      data: { content: form.content, embeds: form.embeds, components: form.components, flags: form.flags, allowed_mentions: form.allowed_mentions, webhook_username: form.webhook_username, webhook_avatar_url: form.webhook_avatar_url, thread_name: form.thread_name },
    };
    backups.unshift(backup);
    if (backups.length > 20) backups.pop();
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
    toast({ title: "Backup saved!", description: `Backup "${form.name || "Untitled"}" saved.` });
  };
  const loadBackup = (data: Record<string, unknown>) => {
    const embeds = (data.embeds as EmbedData[]) || [emptyEmbed()];
    setForm(f => ({
      ...f,
      content: (data.content as string) ?? "",
      embeds,
      components: (data.components as ActionRow[]) ?? [],
      flags: (data.flags as MessageFlags) ?? {},
      allowed_mentions: (data.allowed_mentions as AllowedMentions) ?? {},
      webhook_username: (data.webhook_username as string) ?? "",
      webhook_avatar_url: (data.webhook_avatar_url as string) ?? "",
      thread_name: (data.thread_name as string) ?? "",
    }));
    setEmbedOpenStates(embeds.map(() => defaultEmbedOpen()));
    setBackupsOpen(false);
    toast({ title: "Backup loaded!" });
  };
  const deleteBackup = (id: string) => {
    const backups = getBackups().filter(b => b.id !== id);
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
  };

  // ── Export JSON file ──
  const handleExport = () => {
    if (!editingExistingId) return;
    const payload = {
      name: form.name, content: form.content, embeds: form.embeds,
      components: form.components, flags: form.flags, allowed_mentions: form.allowed_mentions,
      webhook_username: form.webhook_username, webhook_avatar_url: form.webhook_avatar_url, thread_name: form.thread_name,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${form.name || "message"}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Import from file ──
  const handleImportFile = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        importMutation.mutate(parsed);
      } catch {
        toast({ title: "Error", description: "Invalid JSON file.", variant: "destructive" });
      }
    };
    input.click();
  };

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    sendMutation,
    updateMessageMutation,
    loadLinkMutation,
    duplicateMutation,
    importMutation,
    handleCreateNew,
    handleSelectEmbed,
    handleSave,
    handleSend,
    handleUpdateMessage,
    handleLoadLink,
    addEmbed,
    removeEmbed,
    duplicateEmbed,
    moveEmbed,
    updateEmbed,
    setEmbedOpenState,
    addField,
    removeField,
    updateField,
    handleApplyJson,
    copyQueryData,
    handleShare,
    getBackups,
    saveBackup,
    loadBackup,
    deleteBackup,
    handleExport,
    handleImportFile,
  };
}
