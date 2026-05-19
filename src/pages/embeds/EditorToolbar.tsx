import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown, Hash, Pencil, ExternalLink, Loader2, Send, Save,
} from "lucide-react";
import type { CustomEmbed } from "./embedTypes";
import { useT } from "@/i18n";

interface ChannelInfo {
  id: string;
  name: string;
  type: number;
}

interface EditorToolbarProps {
  formName: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  savePending: boolean;
  channels: ChannelInfo[];
  selectedChannelId: string;
  onChannelChange: (id: string) => void;
  onSend: (channelId: string) => void;
  sendPending: boolean;
  isCreatingNew: boolean;
  hasMessageId: boolean;
  selectedEmbed: CustomEmbed | null;
  onUpdateMessage: () => void;
  updateMessagePending: boolean;
  onPreview: () => void;
}

export function EditorToolbar({
  formName,
  onNameChange,
  onSave,
  savePending,
  channels,
  selectedChannelId,
  onChannelChange,
  onSend,
  sendPending,
  isCreatingNew,
  hasMessageId,
  selectedEmbed,
  onUpdateMessage,
  updateMessagePending,
  onPreview,
}: EditorToolbarProps) {
  const { t } = useT();
  return (
    <div className="border-b px-4 py-2 flex flex-wrap items-center gap-2 bg-background sticky top-0 z-10">
      {/* Name */}
      <Input
        className="h-8 text-sm w-48 max-w-[180px]"
        placeholder={t("embed_messageNamePlaceholder")}
        value={formName}
        onChange={(e) => onNameChange(e.target.value)}
      />
      {/* Save */}
      <Button size="sm" onClick={onSave} disabled={savePending}>
        {savePending ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <Save className="h-4 w-4 sm:mr-2" />}
        <span className="hidden sm:inline">{t("save")}</span>
      </Button>
      {/* Send dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="default" className="bg-indigo-600 hover:bg-indigo-700 gap-1">
            <Send className="h-3.5 w-3.5" />
            {t("embed_send")}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 p-2 space-y-2">
          <div className="text-xs font-medium text-muted-foreground px-1 mb-1">{t("embed_sendToChannel")}</div>
          <Select value={selectedChannelId} onValueChange={onChannelChange}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={t("embed_selectChannel")} />
            </SelectTrigger>
            <SelectContent>
              {channels.filter((c) => c.type === 0).map((ch) => (
                <SelectItem key={ch.id} value={ch.id}>
                  <span className="flex items-center gap-2"><Hash className="h-3.5 w-3.5" />{ch.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="w-full" onClick={() => selectedChannelId && onSend(selectedChannelId)}
            disabled={sendPending || !selectedChannelId || isCreatingNew}>
            {sendPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
            {isCreatingNew ? t("embed_saveFirst") : t("embed_send")}
          </Button>
          {hasMessageId && (
            <>
              <DropdownMenuSeparator />
              <Button size="sm" variant="outline" className="w-full" onClick={onUpdateMessage} disabled={updateMessagePending}>
                {updateMessagePending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Pencil className="h-3.5 w-3.5 mr-1" />}
                {t("embed_updateMessage")}
              </Button>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Preview */}
      <Button size="sm" variant="outline" onClick={onPreview}>
        {t("embed_preview")}
      </Button>
      {/* Message link */}
      {hasMessageId && selectedEmbed?.message_id && (
        <a href={`https://discord.com/channels/${selectedEmbed.guild_id}/${selectedEmbed.channel_id}/${selectedEmbed.message_id}`}
          target="_blank" rel="noopener noreferrer"
          className="text-xs text-primary underline flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />{t("embed_messageLink")}
        </a>
      )}
    </div>
  );
}
