import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2,
  ChevronDown, ChevronRight,
  Hash, Pencil,
  Link2, Copy, MessageSquare, ExternalLink, Loader2,
  ArrowUp, ArrowDown, FileJson, Download, Upload, Save, Share2, Database,
  Code2, BellOff, Send, LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/EmojiPicker";
import type { FormState, EmbedField, CustomEmbed, EmbedData, CustomFormState, ComponentButton, ActionRow, MessageFlags, AllowedMentions, EmbedOpenState } from "./embedTypes";
import { DiscordPreview } from "./DiscordPreview";
import { emptyEmbed, defaultEmbedOpen, emptyButton, emptyRow, emptyCustomForm, migrateToEmbeds } from "./customMessagesHelpers";


// Helper: Backup list component
function BackupList({ getBackups, loadBackup, deleteBackup }: {
  getBackups: () => { id: string; name: string; timestamp: string; data: object }[];
  loadBackup: (data: Record<string, unknown>) => void;
  deleteBackup: (id: string) => void;
}) {
  const [list, setList] = useState(() => getBackups());
  const refresh = () => setList(getBackups());
  if (!list.length) return <p className="text-sm text-muted-foreground text-center py-6">Chưa có backup nào. Nhấn "Lưu backup hiện tại".</p>;
  return (
    <div className="space-y-1.5 max-h-72 overflow-y-auto">
      {list.map(b => (
        <div key={b.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{b.name}</div>
            <div className="text-xs text-muted-foreground">{new Date(b.timestamp).toLocaleString("vi-VN")}</div>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => loadBackup(b.data as Record<string, unknown>)}>Tải</Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => { deleteBackup(b.id); refresh(); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function CustomMessagesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Load share param from URL ──
  const shareInit = useMemo<Partial<CustomFormState>>(() => {
    try {
      const param = new URLSearchParams(window.location.search).get("share");
      if (!param) return {};
      const parsed = JSON.parse(decodeURIComponent(atob(param)));
      return parsed as Partial<CustomFormState>;
    } catch { return {}; }
  }, []);

  // ── State ──
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomFormState>({ ...emptyCustomForm, ...shareInit, embeds: shareInit.embeds ?? [emptyEmbed()] });
  const [editingExistingId, setEditingExistingId] = useState<number | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(!!shareInit.content || !!(shareInit.embeds?.length));
  const [linkInput, setLinkInput] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [, setCopiedUrl] = useState(false);

  // Section collapsibles (message-level)
  const [threadOpen, setThreadOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [flagsOpen, setFlagsOpen] = useState(false);

  // Per-embed open states
  const [embedOpenStates, setEmbedOpenStates] = useState<EmbedOpenState[]>([defaultEmbedOpen()]);

  // Dialogs
  const [showPreview, setShowPreview] = useState(false);
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [codeGenOpen, setCodeGenOpen] = useState(false);
  const [codeGenTab, setCodeGenTab] = useState<"python" | "js">("python");
  const [backupsOpen, setBackupsOpen] = useState(false);

  // ── Queries ──
  const { data: customEmbeds = [], isLoading: listLoading } = useQuery<CustomEmbed[]>({
    queryKey: ["custom-embeds"],
    queryFn: () => fetch("/api/embeds/custom", { credentials: "include" }).then((r) => r.json()),
    staleTime: 30_000,
  });

  const { data: channels = [] } = useQuery<{ id: string; name: string; type: number }[]>({
    queryKey: ["discord-channels"],
    queryFn: () => fetch("/api/discord/channels/all", { credentials: "include" }).then((r) => r.json()),
    staleTime: 300_000,
  });

  const selectedEmbed = useMemo(
    () => customEmbeds.find((e) => e.id === selectedId) ?? null,
    [customEmbeds, selectedId]
  );

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (body: CustomFormState) => {
      const res = await fetch("/api/embeds/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Tạo thất bại");
      return res.json() as Promise<CustomEmbed>;
    },
    onSuccess: (data) => {
      toast({ title: "Đã tạo", description: "Embed mới đã được tạo." });
      queryClient.invalidateQueries({ queryKey: ["custom-embeds"] });
      setEditingExistingId(data.id);
      setSelectedId(data.id);
      setIsCreatingNew(false);
      setSelectedChannelId(data.channel_id || "");
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể tạo embed.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: CustomFormState }) => {
      const res = await fetch(`/api/embeds/custom/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Cập nhật thất bại");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Đã lưu", description: "Embed đã được cập nhật." });
      queryClient.invalidateQueries({ queryKey: ["custom-embeds"] });
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể lưu embed.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/embeds/custom/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Xóa thất bại");
    },
    onSuccess: () => {
      toast({ title: "Đã xóa", description: "Embed đã được xóa." });
      queryClient.invalidateQueries({ queryKey: ["custom-embeds"] });
      if (selectedId === editingExistingId) {
        setSelectedId(null);
        setEditingExistingId(null);
        setForm(emptyCustomForm);
      }
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể xóa embed.", variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async ({ id, channel_id }: { id: number; channel_id: string }) => {
      const res = await fetch(`/api/embeds/custom/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ channel_id }),
      });
      if (!res.ok) throw new Error("Gửi thất bại");
      return res.json() as Promise<CustomEmbed & { message_url?: string }>;
    },
    onSuccess: (data) => {
      toast({ title: "Đã gửi", description: "Embed đã được gửi lên Discord." });
      queryClient.invalidateQueries({ queryKey: ["custom-embeds"] });
      if (data.message_url) {
        setCopiedUrl(false);
      }
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể gửi embed lên Discord.", variant: "destructive" });
    },
  });

  const updateMessageMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/embeds/custom/${id}/update-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Cập nhật tin nhắn thất bại");
      return res.json() as Promise<{ ok: boolean; message_url?: string }>;
    },
    onSuccess: (_data) => {
      toast({ title: "Đã cập nhật", description: "Tin nhắn Discord đã được cập nhật." });
      queryClient.invalidateQueries({ queryKey: ["custom-embeds"] });
      setCopiedUrl(false);
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể cập nhật tin nhắn Discord.", variant: "destructive" });
    },
  });

  const loadLinkMutation = useMutation({
    mutationFn: async (link: string) => {
      const res = await fetch("/api/embeds/custom/load-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ link }),
      });
      if (!res.ok) throw new Error("Tải link thất bại");
      return res.json() as Promise<CustomEmbed & { is_new?: boolean }>;
    },
    onSuccess: (data) => {
      toast({ title: "Đã tải", description: "Embed từ link đã được tải thành công." });
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
      toast({ title: "Lỗi", description: "Không thể tải embed từ link. Kiểm tra lại link Discord.", variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/embeds/custom/${id}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Nhân đôi thất bại");
      return res.json() as Promise<CustomEmbed>;
    },
    onSuccess: () => {
      toast({ title: "Đã nhân đôi", description: "Tin nhắn đã được sao chép." });
      queryClient.invalidateQueries({ queryKey: ["custom-embeds"] });
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể nhân đôi.", variant: "destructive" });
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
      toast({ title: "Không thể xóa", description: "Cần ít nhất 1 embed.", variant: "destructive" });
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
  const openJsonEditor = () => {
    setJsonText(JSON.stringify({ content: form.content, embeds: form.embeds }, null, 2));
    setJsonEditorOpen(true);
  };

  const applyJsonEditor = () => {
    try {
      const parsed = JSON.parse(jsonText) as { content?: string; embeds?: EmbedData[] };
      if (!Array.isArray(parsed.embeds)) throw new Error("embeds phải là array");
      setForm((f) => ({
        ...f,
        content: parsed.content ?? f.content,
        embeds: parsed.embeds!,
      }));
      setEmbedOpenStates(parsed.embeds!.map(() => defaultEmbedOpen()));
      setJsonEditorOpen(false);
      toast({ title: "Đã áp dụng JSON" });
    } catch (e) {
      toast({ title: "JSON không hợp lệ", description: String(e), variant: "destructive" });
    }
  };

  const copyQueryData = () => {
    const data = JSON.stringify({ content: form.content, embeds: form.embeds }, null, 2);
    navigator.clipboard.writeText(data);
    toast({ title: "Đã copy JSON!" });
  };

  // ── Import mutation ──
  const importMutation = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetch("/api/embeds/custom/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Import thất bại");
      return res.json() as Promise<CustomEmbed>;
    },
    onSuccess: (data) => {
      toast({ title: "Đã import", description: "Tin nhắn đã được tạo từ JSON." });
      queryClient.invalidateQueries({ queryKey: ["custom-embeds"] });
      handleSelectEmbed(data);
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể import JSON.", variant: "destructive" });
    },
  });

  // ── Code Generator ──
  const generatePythonCode = (): string => {
    const lines: string[] = ["import discord", ""];
    form.embeds.forEach((emb, i) => {
      const varName = form.embeds.length === 1 ? "embed" : `embed${i + 1}`;
      const colorHex = (emb.color || "#5865F2").replace("#", "");
      lines.push(`${varName} = discord.Embed(`);
      if (emb.title) lines.push(`    title=${JSON.stringify(emb.title)},`);
      if (emb.description) lines.push(`    description=${JSON.stringify(emb.description)},`);
      lines.push(`    color=0x${colorHex},`);
      lines.push(")");
      if (emb.author) lines.push(`${varName}.set_author(name=${JSON.stringify(emb.author)}${emb.author_icon_url ? `, icon_url=${JSON.stringify(emb.author_icon_url)}` : ""})`);
      if (emb.footer) lines.push(`${varName}.set_footer(text=${JSON.stringify(emb.footer)})`);
      if (emb.thumbnail_url) lines.push(`${varName}.set_thumbnail(url=${JSON.stringify(emb.thumbnail_url)})`);
      if (emb.image_url) lines.push(`${varName}.set_image(url=${JSON.stringify(emb.image_url)})`);
      emb.fields.forEach(f => {
        lines.push(`${varName}.add_field(name=${JSON.stringify(f.name)}, value=${JSON.stringify(f.value)}, inline=${f.inline ? "True" : "False"})`);
      });
      lines.push("");
    });
    // Components (link buttons only)
    if (form.components.length > 0) {
      lines.push("view = discord.ui.View(timeout=None)");
      form.components.forEach((row, ri) => {
        row.components.forEach(btn => {
          const style = { 1: "primary", 2: "secondary", 3: "success", 4: "danger", 5: "link" }[btn.style] ?? "secondary";
          if (btn.style === 5) {
            lines.push(`view.add_item(discord.ui.Button(style=discord.ButtonStyle.link, label=${JSON.stringify(btn.label)}, url=${JSON.stringify(btn.url || "")}, row=${ri}))`);
          } else {
            lines.push(`view.add_item(discord.ui.Button(style=discord.ButtonStyle.${style}, label=${JSON.stringify(btn.label)}, custom_id=${JSON.stringify(btn.custom_id || btn.label)}, row=${ri}))`);
          }
        });
      });
      lines.push("");
    }
    const embedVars = form.embeds.length === 1 ? "embed" : form.embeds.map((_, i) => `embed${i + 1}`).join(", ");
    const sendArgs = [`embeds=[${embedVars}]`];
    if (form.content) sendArgs.unshift(`content=${JSON.stringify(form.content)}`);
    if (form.components.length > 0) sendArgs.push("view=view");
    lines.push(`await channel.send(${sendArgs.join(", ")})`);
    return lines.join("\n");
  };

  const generateJSCode = (): string => {
    const lines: string[] = [
      'const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");',
      "",
    ];
    form.embeds.forEach((emb, i) => {
      const varName = form.embeds.length === 1 ? "embed" : `embed${i + 1}`;
      const colorHex = (emb.color || "#5865F2").replace("#", "0x");
      lines.push(`const ${varName} = new EmbedBuilder()`);
      if (emb.title) lines.push(`  .setTitle(${JSON.stringify(emb.title)})`);
      if (emb.description) lines.push(`  .setDescription(${JSON.stringify(emb.description)})`);
      lines.push(`  .setColor(${colorHex})`);
      if (emb.author) lines.push(`  .setAuthor({ name: ${JSON.stringify(emb.author)}${emb.author_icon_url ? `, iconURL: ${JSON.stringify(emb.author_icon_url)}` : ""} })`);
      if (emb.footer) lines.push(`  .setFooter({ text: ${JSON.stringify(emb.footer)} })`);
      if (emb.thumbnail_url) lines.push(`  .setThumbnail(${JSON.stringify(emb.thumbnail_url)})`);
      if (emb.image_url) lines.push(`  .setImage(${JSON.stringify(emb.image_url)})`);
      if (emb.fields.length > 0) {
        const fieldsStr = emb.fields.map(f => `{ name: ${JSON.stringify(f.name)}, value: ${JSON.stringify(f.value)}, inline: ${f.inline} }`).join(", ");
        lines.push(`  .addFields(${fieldsStr})`);
      }
      lines.push(";");
      lines.push("");
    });
    if (form.components.length > 0) {
      form.components.forEach((row, ri) => {
        lines.push(`const row${ri + 1} = new ActionRowBuilder().addComponents(`);
        row.components.forEach((btn, bi) => {
          const styleMap: Record<number, string> = { 1: "Primary", 2: "Secondary", 3: "Success", 4: "Danger", 5: "Link" };
          const style = styleMap[btn.style] ?? "Secondary";
          lines.push(`  new ButtonBuilder().setLabel(${JSON.stringify(btn.label)}).setStyle(ButtonStyle.${style})${btn.style === 5 ? `.setURL(${JSON.stringify(btn.url || "")})` : `.setCustomId(${JSON.stringify(btn.custom_id || btn.label)})`}${bi < row.components.length - 1 ? "," : ""}`);
        });
        lines.push(");");
      });
      lines.push("");
    }
    const embedVars = form.embeds.length === 1 ? "embed" : form.embeds.map((_, i) => `embed${i + 1}`).join(", ");
    const rowVars = form.components.map((_, i) => `row${i + 1}`).join(", ");
    lines.push("await channel.send({");
    if (form.content) lines.push(`  content: ${JSON.stringify(form.content)},`);
    lines.push(`  embeds: [${embedVars}],`);
    if (form.components.length > 0) lines.push(`  components: [${rowVars}],`);
    lines.push("});");
    return lines.join("\n");
  };

  // ── Share via URL ──
  const handleShare = () => {
    const payload = { content: form.content, embeds: form.embeds, components: form.components };
    const b64 = btoa(encodeURIComponent(JSON.stringify(payload)));
    const url = `${window.location.origin}${window.location.pathname}?tab=custom&share=${b64}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Đã copy link share!", description: "Người khác mở link sẽ thấy nội dung này." });
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
    toast({ title: "Đã lưu backup!", description: `Backup "${form.name || "Untitled"}" đã được lưu.` });
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
    toast({ title: "Đã tải backup!" });
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
        toast({ title: "Lỗi", description: "File JSON không hợp lệ.", variant: "destructive" });
      }
    };
    input.click();
  };

  // ── Preview form (uses first embed) ──
  const previewForm: FormState = useMemo(() => {
    const firstEmbed = form.embeds[0] ?? emptyEmbed();
    return {
      ...firstEmbed,
      name: "",
      event_type: "",
      enabled: true,
      response_mode: "embed" as const,
      text_template: "",
      existingId: undefined,
    };
  }, [form]);

  const isEditing = editingExistingId !== null || isCreatingNew;
  const hasMessageId = Boolean(selectedEmbed?.message_id);

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2 border-b">
        <Button size="sm" className="w-full" onClick={handleCreateNew}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Tạo mới
        </Button>
        <div className="flex gap-1.5">
          <Input
            placeholder="Paste Discord message link..."
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            className="text-xs h-8"
            onKeyDown={(e) => { if (e.key === "Enter") handleLoadLink(); }}
          />
          <Button size="sm" variant="outline" className="shrink-0 h-8 px-2.5" onClick={handleLoadLink}
            disabled={loadLinkMutation.isPending || !linkInput.trim()}>
            {loadLinkMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {listLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Đang tải...</div>
        ) : customEmbeds.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Chưa có tin nhắn nào</div>
        ) : (
          <div className="p-2 space-y-1">
            {customEmbeds.map((embed) => (
              <div key={embed.id} role="button" tabIndex={0}
                className={cn("w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 cursor-pointer", selectedId === embed.id && "bg-muted")}
                onClick={() => handleSelectEmbed(embed)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectEmbed(embed); } }}>
                <div className="font-medium truncate">{embed.name || "Không tên"}</div>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                  <Hash className="h-3 w-3" />
                  {channels.find((c) => c.id === embed.channel_id)?.name || embed.channel_id || "—"}
                  {embed.message_id && <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-1">Đã gửi</Badge>}
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleSelectEmbed(embed); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); duplicateMutation.mutate(embed.id); }} disabled={duplicateMutation.isPending}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(embed.id); }} disabled={deleteMutation.isPending}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Editor ────────────────────────────────────────────────────────────────
  const editor = (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="border-b px-4 py-2 flex flex-wrap items-center gap-2 bg-background sticky top-0 z-10">
        {/* Name */}
        <Input
          className="h-8 text-sm w-48 max-w-[180px]"
          placeholder="Tên tin nhắn..."
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        {/* Lưu */}
        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending || createMutation.isPending}>
          {(updateMutation.isPending || createMutation.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
          Lưu
        </Button>
        {/* Send dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="default" className="bg-indigo-600 hover:bg-indigo-700 gap-1">
              <Send className="h-3.5 w-3.5" />
              Gửi
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 p-2 space-y-2">
            <div className="text-xs font-medium text-muted-foreground px-1 mb-1">Gửi lên kênh</div>
            <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Chọn kênh..." />
              </SelectTrigger>
              <SelectContent>
                {channels.filter((c) => c.type === 0).map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    <span className="flex items-center gap-2"><Hash className="h-3.5 w-3.5" />{ch.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="w-full" onClick={() => selectedChannelId && handleSend(selectedChannelId)}
              disabled={sendMutation.isPending || !selectedChannelId || isCreatingNew}>
              {sendMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
              {isCreatingNew ? "Lưu trước" : "Gửi"}
            </Button>
            {hasMessageId && (
              <>
                <DropdownMenuSeparator />
                <Button size="sm" variant="outline" className="w-full" onClick={handleUpdateMessage} disabled={updateMessageMutation.isPending}>
                  {updateMessageMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Pencil className="h-3.5 w-3.5 mr-1" />}
                  Cập nhật tin nhắn
                </Button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Preview */}
        <Button size="sm" variant="outline" onClick={() => setShowPreview(true)}>
          Xem trước
        </Button>
        {/* Message link */}
        {hasMessageId && selectedEmbed?.message_id && (
          <a href={`https://discord.com/channels/${selectedEmbed.guild_id}/${selectedEmbed.channel_id}/${selectedEmbed.message_id}`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />Link tin nhắn
          </a>
        )}
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-3">

          {/* ── Message block ── */}
          <div className="rounded-lg border overflow-hidden bg-card">
            {/* Content */}
            <div className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Content</Label>
                <span className="text-[11px] text-muted-foreground">{form.content.length}/2000</span>
              </div>
              <Textarea
                placeholder="Nội dung tin nhắn (plain text, hỗ trợ markdown Discord)"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={3}
                maxLength={2000}
                className="resize-y text-sm"
              />
            </div>

            {/* Thread — collapsible */}
            <div className="border-t">
              <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                onClick={() => setThreadOpen(!threadOpen)}>
                {threadOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Thread
              </button>
              {threadOpen && (
                <div className="px-4 pb-4">
                  <Input placeholder="Tên thread..." value={form.thread_name}
                    onChange={(e) => setForm((f) => ({ ...f, thread_name: e.target.value }))} className="text-sm" />
                </div>
              )}
            </div>

            {/* Profile — collapsible */}
            <div className="border-t">
              <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                onClick={() => setProfileOpen(!profileOpen)}>
                {profileOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Profile
              </button>
              {profileOpen && (
                <div className="px-4 pb-4 space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Webhook Username</Label>
                    <Input placeholder="Tên hiển thị..." value={form.webhook_username}
                      onChange={(e) => setForm((f) => ({ ...f, webhook_username: e.target.value }))} className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Webhook Avatar URL</Label>
                    <Input placeholder="https://..." value={form.webhook_avatar_url}
                      onChange={(e) => setForm((f) => ({ ...f, webhook_avatar_url: e.target.value }))} className="text-sm" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Embed cards ── */}
          {form.embeds.map((emb, idx) => {
            const openState = embedOpenStates[idx] ?? defaultEmbedOpen();
            const borderColor = emb.color || "#5865F2";
            return (
              <div key={idx} className="rounded-lg border overflow-hidden bg-card" style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}>
                {/* Embed header */}
                <div className="flex items-center gap-1 px-3 py-2 bg-muted/30">
                  <button type="button" className="flex-1 flex items-center gap-2 text-sm font-semibold text-left"
                    onClick={() => setEmbedOpenState(idx, { main: !openState.main })}>
                    {openState.main ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Embed {idx + 1}{emb.title ? ` — ${emb.title}` : ""}
                  </button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Di chuyển lên" disabled={idx === 0} onClick={() => moveEmbed(idx, "up")}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Di chuyển xuống" disabled={idx === form.embeds.length - 1} onClick={() => moveEmbed(idx, "down")}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Nhân đôi" onClick={() => duplicateEmbed(idx)}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title="Xóa" onClick={() => removeEmbed(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>

                {openState.main && (
                  <div className="px-4 pb-4 pt-3 space-y-4">
                    {/* Author — collapsible */}
                    <div className="rounded-md border">
                      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50"
                        onClick={() => setEmbedOpenState(idx, { author: !openState.author })}>
                        {openState.author ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        Tác giả
                      </button>
                      {openState.author && (
                        <div className="px-3 pb-3 space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Tên tác giả <span className="text-[10px]">{emb.author.length}/256</span></Label>
                            <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                              <Input className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm" placeholder="Tên tác giả" maxLength={256}
                                value={emb.author} onChange={(e) => updateEmbed(idx, { author: e.target.value })} />
                              <EmojiPicker onSelect={(em) => updateEmbed(idx, { author: emb.author + em })} />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Icon URL</Label>
                            <Input className="text-sm" placeholder="https://..." value={emb.author_icon_url} onChange={(e) => updateEmbed(idx, { author_icon_url: e.target.value })} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Body: Title, Description, Color */}
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Tiêu đề</Label>
                          <span className="text-[11px] text-muted-foreground">{emb.title.length}/256</span>
                        </div>
                        <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                          <Input className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm" placeholder="Tiêu đề embed" maxLength={256}
                            value={emb.title} onChange={(e) => updateEmbed(idx, { title: e.target.value })} />
                          <EmojiPicker onSelect={(em) => updateEmbed(idx, { title: emb.title + em })} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Mô tả</Label>
                          <span className="text-[11px] text-muted-foreground">{emb.description.length}/4096</span>
                        </div>
                        <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                          <Textarea className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 text-sm resize-y" placeholder="Mô tả embed..." rows={4} maxLength={4096}
                            value={emb.description} onChange={(e) => updateEmbed(idx, { description: e.target.value })} />
                          <EmojiPicker onSelect={(em) => updateEmbed(idx, { description: emb.description + em })} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Màu sắc</Label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={emb.color} onChange={(e) => updateEmbed(idx, { color: e.target.value })}
                            className="h-8 w-8 rounded cursor-pointer border-0 p-0" />
                          <Input value={emb.color} onChange={(e) => updateEmbed(idx, { color: e.target.value })}
                            className="w-28 font-mono text-xs" maxLength={7} />
                        </div>
                      </div>
                    </div>

                    {/* Images — collapsible */}
                    <div className="rounded-md border">
                      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50"
                        onClick={() => setEmbedOpenState(idx, { images: !openState.images })}>
                        {openState.images ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        Hình ảnh
                      </button>
                      {openState.images && (
                        <div className="px-3 pb-3 space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Thumbnail URL</Label>
                            <Input className="text-sm" placeholder="https://..." value={emb.thumbnail_url} onChange={(e) => updateEmbed(idx, { thumbnail_url: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Image URL (lớn)</Label>
                            <Input className="text-sm" placeholder="https://..." value={emb.image_url} onChange={(e) => updateEmbed(idx, { image_url: e.target.value })} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Chân trang</Label>
                        <span className="text-[11px] text-muted-foreground">{emb.footer.length}/2048</span>
                      </div>
                      <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                        <Input className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm" placeholder="Nội dung chân trang" maxLength={2048}
                          value={emb.footer} onChange={(e) => updateEmbed(idx, { footer: e.target.value })} />
                        <EmojiPicker onSelect={(em) => updateEmbed(idx, { footer: emb.footer + em })} />
                      </div>
                    </div>

                    {/* Fields — collapsible */}
                    <div className="rounded-md border">
                      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50"
                        onClick={() => setEmbedOpenState(idx, { fields: !openState.fields })}>
                        {openState.fields ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        Fields ({emb.fields.length}/25)
                      </button>
                      {openState.fields && (
                        <div className="px-3 pb-3 space-y-2 pt-1">
                          {emb.fields.map((field, fi) => (
                            <div key={fi} className="rounded-md border bg-muted/30 p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">Field {fi + 1}</span>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeField(idx, fi)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                                  <Input placeholder="Tên field" value={field.name} onChange={(e) => updateField(idx, fi, "name", e.target.value)}
                                    className="text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                                  <EmojiPicker onSelect={(em) => updateField(idx, fi, "name", field.name + em)} />
                                </div>
                                <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                                  <Input placeholder="Giá trị" value={field.value} onChange={(e) => updateField(idx, fi, "value", e.target.value)}
                                    className="text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                                  <EmojiPicker onSelect={(em) => updateField(idx, fi, "value", field.value + em)} />
                                </div>
                              </div>
                              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                                <input type="checkbox" checked={field.inline} onChange={(e) => updateField(idx, fi, "inline", e.target.checked)} className="rounded border-input" />
                                Inline
                              </label>
                            </div>
                          ))}
                          {emb.fields.length < 25 && (
                            <Button variant="outline" size="sm" onClick={() => addField(idx)} className="w-full border-dashed">
                              <Plus className="h-3.5 w-3.5 mr-1.5" />Thêm field
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Footer actions ── */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Add dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="default" className="bg-indigo-600 hover:bg-indigo-700 gap-1">
                  <Plus className="h-3.5 w-3.5" />Add<ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={addEmbed} disabled={form.embeds.length >= 10}>
                  <Plus className="h-4 w-4 mr-2" />Add Embed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setForm(f => ({ ...f, components: [...f.components, emptyRow()] })) } disabled={form.components.length >= 5}>
                  <LayoutGrid className="h-4 w-4 mr-2" />Add Component Row
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Options dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">
                  Options<ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={openJsonEditor}>
                  <FileJson className="h-4 w-4 mr-2" />JSON Editor
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyQueryData}>
                  <Copy className="h-4 w-4 mr-2" />Copy Query Data
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setCodeGenOpen(true)}>
                  <Code2 className="h-4 w-4 mr-2" />Generate Code
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />Share via Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport} disabled={!editingExistingId}>
                  <Download className="h-4 w-4 mr-2" />Export JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportFile}>
                  <Upload className="h-4 w-4 mr-2" />Import JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={saveBackup}>
                  <Save className="h-4 w-4 mr-2" />Save Backup
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBackupsOpen(true)}>
                  <Database className="h-4 w-4 mr-2" />Load Backup
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* ── Components Section (rows/buttons) ── */}
          {form.components.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5" />Components
              </div>
              {form.components.map((row, rowIdx) => (
                <div key={rowIdx} className="rounded-lg border bg-card overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                    <span className="text-xs font-semibold flex-1">Row {rowIdx + 1}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" title="Thêm button"
                      disabled={row.components.length >= 5}
                      onClick={() => {
                        const rows = form.components.map((r, i) => i === rowIdx ? { ...r, components: [...r.components, emptyButton()] } : r);
                        setForm(f => ({ ...f, components: rows }));
                      }}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" title="Xóa row"
                      onClick={() => setForm(f => ({ ...f, components: f.components.filter((_, i) => i !== rowIdx) }))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {/* Button previews + edit */}
                  <div className="px-3 py-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {row.components.map((btn, btnIdx) => {
                        const styleColors: Record<number, string> = {
                          1: "bg-[#5865F2] hover:bg-[#4752c4] text-white",
                          2: "bg-[#4E5058] hover:bg-[#6D6F78] text-white",
                          3: "bg-[#2D7D46] hover:bg-[#256137] text-white",
                          4: "bg-[#DA373C] hover:bg-[#a12828] text-white",
                          5: "bg-[#4E5058] hover:bg-[#6D6F78] text-white",
                        };
                        return (
                          <div key={btnIdx} className="flex items-center gap-1">
                            <div className={`px-3 py-1 rounded text-xs font-medium ${styleColors[btn.style] ?? styleColors[2]} ${btn.disabled ? "opacity-40" : ""}`}>
                              {btn.emoji && <span className="mr-1">{btn.emoji}</span>}
                              {btn.label || "Button"}
                              {btn.style === 5 && <ExternalLink className="h-3 w-3 ml-1 inline" />}
                            </div>
                            <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground"
                              onClick={() => {
                                const rows = form.components.map((r, ri) => ri === rowIdx ? {
                                  ...r,
                                  components: r.components.filter((_, bi) => bi !== btnIdx),
                                } : r);
                                setForm(f => ({ ...f, components: rows }));
                              }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    {/* Button editor */}
                    {row.components.map((btn, btnIdx) => (
                      <div key={btnIdx} className="rounded-md border p-2 space-y-2 bg-muted/20">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground font-medium w-12 shrink-0">Btn {btnIdx + 1}</span>
                          <Select value={String(btn.style)} onValueChange={(v) => {
                            const rows = form.components.map((r, ri) => ri === rowIdx ? {
                              ...r, components: r.components.map((b, bi) => bi === btnIdx ? { ...b, style: Number(v) as ComponentButton["style"] } : b),
                            } : r);
                            setForm(f => ({ ...f, components: rows }));
                          }}>
                            <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">🟣 Primary</SelectItem>
                              <SelectItem value="2">⬜ Secondary</SelectItem>
                              <SelectItem value="3">🟢 Success</SelectItem>
                              <SelectItem value="4">🔴 Danger</SelectItem>
                              <SelectItem value="5">🔗 Link</SelectItem>
                            </SelectContent>
                          </Select>
                          <Switch checked={!!btn.disabled}
                            onCheckedChange={(v) => {
                              const rows = form.components.map((r, ri) => ri === rowIdx ? {
                                ...r, components: r.components.map((b, bi) => bi === btnIdx ? { ...b, disabled: v } : b),
                              } : r);
                              setForm(f => ({ ...f, components: rows }));
                            }} />
                          <span className="text-[10px] text-muted-foreground">Disabled</span>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Label</Label>
                            <Input className="h-7 text-xs" placeholder="Button label" value={btn.label}
                              onChange={(e) => {
                                const rows = form.components.map((r, ri) => ri === rowIdx ? {
                                  ...r, components: r.components.map((b, bi) => bi === btnIdx ? { ...b, label: e.target.value } : b),
                                } : r);
                                setForm(f => ({ ...f, components: rows }));
                              }} />
                          </div>
                          <div className="w-16 space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Emoji</Label>
                            <Input className="h-7 text-xs" placeholder="😀" value={btn.emoji ?? ""}
                              onChange={(e) => {
                                const rows = form.components.map((r, ri) => ri === rowIdx ? {
                                  ...r, components: r.components.map((b, bi) => bi === btnIdx ? { ...b, emoji: e.target.value } : b),
                                } : r);
                                setForm(f => ({ ...f, components: rows }));
                              }} />
                          </div>
                        </div>
                        {btn.style === 5 ? (
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">URL</Label>
                            <Input className="h-7 text-xs" placeholder="https://..." value={btn.url ?? ""}
                              onChange={(e) => {
                                const rows = form.components.map((r, ri) => ri === rowIdx ? {
                                  ...r, components: r.components.map((b, bi) => bi === btnIdx ? { ...b, url: e.target.value } : b),
                                } : r);
                                setForm(f => ({ ...f, components: rows }));
                              }} />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Custom ID</Label>
                            <Input className="h-7 text-xs font-mono" placeholder="my_button_id" value={btn.custom_id ?? ""}
                              onChange={(e) => {
                                const rows = form.components.map((r, ri) => ri === rowIdx ? {
                                  ...r, components: r.components.map((b, bi) => bi === btnIdx ? { ...b, custom_id: e.target.value } : b),
                                } : r);
                                setForm(f => ({ ...f, components: rows }));
                              }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Flags ── */}
          <div className="rounded-lg border">
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold hover:bg-muted/50"
              onClick={() => setFlagsOpen(v => !v)}>
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
                      onCheckedChange={(v) => setForm(f => ({ ...f, flags: { ...f.flags, suppress_embeds: v } }))} />
                    <Label htmlFor="flag-suppress" className="text-xs">Suppress Embeds (ẩn embed)</Label>
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
                            setForm(f => ({ ...f, allowed_mentions: { ...f.allowed_mentions, parse: next } }));
                          }} />
                        <Label htmlFor={`am-${type}`} className="text-xs capitalize">{type}</Label>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="am-replied"
                      checked={!!form.allowed_mentions.replied_user}
                      onCheckedChange={(v) => setForm(f => ({ ...f, allowed_mentions: { ...f.allowed_mentions, replied_user: v } }))} />
                    <Label htmlFor="am-replied" className="text-xs">Mention replied user</Label>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Code Generator Dialog ── */}
      <Dialog open={codeGenOpen} onOpenChange={setCodeGenOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Code2 className="h-5 w-5" />Code Generator</DialogTitle>
            <DialogDescription>Sinh code từ tin nhắn hiện tại để dùng trong bot.</DialogDescription>
          </DialogHeader>
          <Tabs value={codeGenTab} onValueChange={(v) => setCodeGenTab(v as "python" | "js")}>
            <TabsList className="mb-2">
              <TabsTrigger value="python">Python (discord.py)</TabsTrigger>
              <TabsTrigger value="js">JavaScript (discord.js)</TabsTrigger>
            </TabsList>
            <TabsContent value="python">
              <div className="relative">
                <Textarea value={generatePythonCode()} readOnly rows={20} className="font-mono text-xs resize-y bg-muted" />
                <Button size="sm" variant="outline" className="absolute top-2 right-2"
                  onClick={() => { navigator.clipboard.writeText(generatePythonCode()); toast({ title: "Đã copy!" }); }}>
                  <Copy className="h-3.5 w-3.5 mr-1" />Copy
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="js">
              <div className="relative">
                <Textarea value={generateJSCode()} readOnly rows={20} className="font-mono text-xs resize-y bg-muted" />
                <Button size="sm" variant="outline" className="absolute top-2 right-2"
                  onClick={() => { navigator.clipboard.writeText(generateJSCode()); toast({ title: "Đã copy!" }); }}>
                  <Copy className="h-3.5 w-3.5 mr-1" />Copy
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ── Backups Dialog ── */}
      <Dialog open={backupsOpen} onOpenChange={setBackupsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Backups cục bộ</DialogTitle>
            <DialogDescription>Backup được lưu trong trình duyệt của bạn (tối đa 20).</DialogDescription>
          </DialogHeader>
          <BackupList getBackups={getBackups} loadBackup={loadBackup} deleteBackup={deleteBackup} />
          <DialogFooter>
            <Button size="sm" onClick={saveBackup}><Save className="h-3.5 w-3.5 mr-1" />Lưu backup hiện tại</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── JSON Editor Dialog ── */}
      <Dialog open={jsonEditorOpen} onOpenChange={setJsonEditorOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileJson className="h-5 w-5" />JSON Editor</DialogTitle>
            <DialogDescription>Chỉnh sửa trực tiếp JSON của tin nhắn. Nhấn Áp dụng để cập nhật form.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={18}
            className="font-mono text-xs resize-y"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(jsonText); toast({ title: "Đã copy!" }); }}>
              <Copy className="h-4 w-4 mr-1" />Copy
            </Button>
            <Button variant="outline" onClick={() => setJsonEditorOpen(false)}>Hủy</Button>
            <Button onClick={applyJsonEditor}>Áp dụng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ── */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Xem trước Discord</DialogTitle></DialogHeader>
          <div className="py-2">
            {form.content && <p className="text-sm mb-3 whitespace-pre-wrap text-foreground">{form.content}</p>}
            <DiscordPreview form={previewForm} />
            {form.embeds.length > 1 && <p className="text-xs text-muted-foreground mt-2">* Preview chỉ hiển thị embed đầu tiên</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row gap-0 h-full">
      <div className={cn("w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r bg-card", isEditing && "hidden md:block")}>
        {sidebar}
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        {isEditing ? editor : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-8">
            <div className="text-center space-y-2">
              <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p>Chọn tin nhắn từ danh sách hoặc tạo mới</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

