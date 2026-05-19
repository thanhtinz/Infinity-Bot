import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import {
  Plus,
  ChevronDown,
  Copy, MessageSquare,
  FileJson, Download, Upload, Save, Share2, Database,
  Code2, LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormState, CustomEmbed, CustomFormState, EmbedOpenState } from "./embedTypes";
import { DiscordPreview } from "./DiscordPreview";
import { emptyEmbed, defaultEmbedOpen, emptyRow, emptyCustomForm } from "./customMessagesHelpers";
import { BackupList } from "./BackupList";
import { JsonEditorDialog } from "./JsonEditorDialog";
import { CodeGeneratorDialog } from "./CodeGeneratorDialog";
import { ComponentsSection } from "./ComponentsSection";
import { EmbedCardEditor } from "./EmbedCardEditor";
import { MessageSidebar } from "./MessageSidebar";
import { EditorToolbar } from "./EditorToolbar";
import { MessageContentBlock } from "./MessageContentBlock";
import { useCustomMessagesMutations } from "./useCustomMessagesMutations";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";

export function CustomMessagesTab() {
  const { t } = useT();
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

  // Section collapsibles (message-level)
  const [threadOpen, setThreadOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [flagsOpen, setFlagsOpen] = useState(false);

  // Per-embed open states
  const [embedOpenStates, setEmbedOpenStates] = useState<EmbedOpenState[]>([defaultEmbedOpen()]);

  // Dialogs
  const [showPreview, setShowPreview] = useState(false);
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [codeGenOpen, setCodeGenOpen] = useState(false);
  const [backupsOpen, setBackupsOpen] = useState(false);

  // ── Queries ──
  const { data: customEmbeds = [], isLoading: listLoading } = useQuery<CustomEmbed[]>({
    queryKey: ["custom-embeds"],
    queryFn: () => apiFetch("/api/embeds/custom").then((r) => r.json()),
    staleTime: 30_000,
  });

  const { data: channels = [] } = useQuery<{ id: string; name: string; type: number }[]>({
    queryKey: ["discord-channels"],
    queryFn: () => apiFetch("/api/discord/channels/all").then((r) => r.json()),
    staleTime: 300_000,
  });

  const selectedEmbed = useMemo(
    () => customEmbeds.find((e) => e.id === selectedId) ?? null,
    [customEmbeds, selectedId]
  );

  // ── Mutations & Handlers ──
  const {
    createMutation, updateMutation, deleteMutation, sendMutation,
    updateMessageMutation, loadLinkMutation, duplicateMutation,
    handleCreateNew, handleSelectEmbed, handleSave, handleSend,
    handleUpdateMessage, handleLoadLink,
    addEmbed, removeEmbed, duplicateEmbed, moveEmbed,
    updateEmbed, setEmbedOpenState,
    addField, removeField, updateField,
    handleApplyJson, copyQueryData, handleShare,
    getBackups, saveBackup, loadBackup, deleteBackup,
    handleExport, handleImportFile,
  } = useCustomMessagesMutations(
    form, setForm, selectedId, setSelectedId,
    editingExistingId, setEditingExistingId,
    isCreatingNew, setIsCreatingNew,
    linkInput, setLinkInput,
    selectedChannelId, setSelectedChannelId,
    embedOpenStates, setEmbedOpenStates,
    setThreadOpen, setProfileOpen, setBackupsOpen,
  );

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
    <MessageSidebar
      customEmbeds={customEmbeds}
      channels={channels}
      selectedId={selectedId}
      listLoading={listLoading}
      linkInput={linkInput}
      loadLinkPending={loadLinkMutation.isPending}
      duplicatePending={duplicateMutation.isPending}
      deletePending={deleteMutation.isPending}
      onCreateNew={handleCreateNew}
      onSelectEmbed={handleSelectEmbed}
      onLoadLink={handleLoadLink}
      onDuplicate={(id) => duplicateMutation.mutate(id)}
      onDelete={(id) => deleteMutation.mutate(id)}
      onLinkInputChange={setLinkInput}
    />
  );

  // ── Editor ────────────────────────────────────────────────────────────────
  const editor = (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <EditorToolbar
        formName={form.name}
        onNameChange={(name) => setForm((f) => ({ ...f, name }))}
        onSave={handleSave}
        savePending={updateMutation.isPending || createMutation.isPending}
        channels={channels}
        selectedChannelId={selectedChannelId}
        onChannelChange={setSelectedChannelId}
        onSend={handleSend}
        sendPending={sendMutation.isPending}
        isCreatingNew={isCreatingNew}
        hasMessageId={hasMessageId}
        selectedEmbed={selectedEmbed}
        onUpdateMessage={handleUpdateMessage}
        updateMessagePending={updateMessageMutation.isPending}
        onPreview={() => setShowPreview(true)}
      />

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-3">

          {/* ── Message block + Flags ── */}
          <MessageContentBlock
            form={form}
            onFormChange={setForm}
            threadOpen={threadOpen}
            onToggleThread={() => setThreadOpen(!threadOpen)}
            profileOpen={profileOpen}
            onToggleProfile={() => setProfileOpen(!profileOpen)}
            flagsOpen={flagsOpen}
            onToggleFlags={() => setFlagsOpen(v => !v)}
          />

          {/* ── Embed cards ── */}
          <EmbedCardEditor
            embeds={form.embeds}
            openStates={embedOpenStates}
            onUpdateEmbed={updateEmbed}
            onRemoveEmbed={removeEmbed}
            onDuplicateEmbed={duplicateEmbed}
            onMoveEmbed={moveEmbed}
            onAddField={addField}
            onRemoveField={removeField}
            onUpdateField={updateField}
            onSetOpenState={setEmbedOpenState}
          />

          {/* ── Footer actions ── */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Add dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="default" className="bg-indigo-600 hover:bg-indigo-700 gap-1">
                  <Plus className="h-3.5 w-3.5" />{t("embed_add")}<ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={addEmbed} disabled={form.embeds.length >= 10}>
                  <Plus className="h-4 w-4 mr-2" />{t("embed_addEmbed")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setForm(f => ({ ...f, components: [...f.components, emptyRow()] })) } disabled={form.components.length >= 5}>
                  <LayoutGrid className="h-4 w-4 mr-2" />{t("embed_addComponentRow")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Options dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">
                  {t("embed_options")}<ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setJsonEditorOpen(true)}>
                  <FileJson className="h-4 w-4 mr-2" />{t("embed_jsonEditor")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyQueryData}>
                  <Copy className="h-4 w-4 mr-2" />{t("embed_copyQueryData")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setCodeGenOpen(true)}>
                  <Code2 className="h-4 w-4 mr-2" />{t("embed_generateCode")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />{t("embed_shareViaLink")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport} disabled={!editingExistingId}>
                  <Download className="h-4 w-4 mr-2" />{t("embed_exportJson")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportFile}>
                  <Upload className="h-4 w-4 mr-2" />{t("embed_importJson")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={saveBackup}>
                  <Save className="h-4 w-4 mr-2" />{t("embed_saveBackup")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBackupsOpen(true)}>
                  <Database className="h-4 w-4 mr-2" />{t("embed_loadBackup")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* ── Components Section (rows/buttons) ── */}
          <ComponentsSection
            components={form.components}
            onChange={(components) => setForm(f => ({ ...f, components }))}
          />

        </div>
      </div>

      {/* ── Code Generator Dialog ── */}
      <CodeGeneratorDialog open={codeGenOpen} onOpenChange={setCodeGenOpen} form={form} />

      {/* ── Backups Dialog ── */}
      <Dialog open={backupsOpen} onOpenChange={setBackupsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Database className="h-5 w-5" />{t("embed_localBackups")}</DialogTitle>
            <DialogDescription>{t("embed_localBackupsDesc")}</DialogDescription>
          </DialogHeader>
          <BackupList getBackups={getBackups} loadBackup={loadBackup} deleteBackup={deleteBackup} />
          <DialogFooter>
            <Button size="sm" onClick={saveBackup}><Save className="h-3.5 w-3.5 sm:mr-2" /><span className="hidden sm:inline">{t("embed_saveCurrentBackup")}</span></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── JSON Editor Dialog ── */}
      <JsonEditorDialog
        open={jsonEditorOpen}
        onOpenChange={setJsonEditorOpen}
        content={form.content}
        embeds={form.embeds}
        onApply={handleApplyJson}
      />

      {/* ── Preview Dialog ── */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("embed_previewDiscord")}</DialogTitle></DialogHeader>
          <div className="py-2">
            {form.content && <p className="text-sm mb-3 whitespace-pre-wrap text-foreground">{form.content}</p>}
            <DiscordPreview form={previewForm} />
            {form.embeds.length > 1 && <p className="text-xs text-muted-foreground mt-2">{t("embed_previewFirstOnly")}</p>}
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
              <p>{t("embed_selectOrCreate")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

