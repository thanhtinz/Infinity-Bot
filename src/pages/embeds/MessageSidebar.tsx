import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Trash2, Hash, Pencil, Link2, Copy, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CustomEmbed } from "./embedTypes";
import { useT } from "@/i18n";

interface ChannelInfo {
  id: string;
  name: string;
  type: number;
}

interface MessageSidebarProps {
  customEmbeds: CustomEmbed[];
  channels: ChannelInfo[];
  selectedId: number | null;
  listLoading: boolean;
  linkInput: string;
  loadLinkPending: boolean;
  duplicatePending: boolean;
  deletePending: boolean;
  onCreateNew: () => void;
  onSelectEmbed: (embed: CustomEmbed) => void;
  onLoadLink: () => void;
  onDuplicate: (id: number) => void;
  onDelete: (id: number) => void;
  onLinkInputChange: (value: string) => void;
}

export function MessageSidebar({
  customEmbeds,
  channels,
  selectedId,
  listLoading,
  linkInput,
  loadLinkPending,
  duplicatePending,
  deletePending,
  onCreateNew,
  onSelectEmbed,
  onLoadLink,
  onDuplicate,
  onDelete,
  onLinkInputChange,
}: MessageSidebarProps) {
  const { t } = useT();
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2 border-b">
        <Button size="sm" className="w-full" onClick={onCreateNew}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t("embed_create")}
        </Button>
        <div className="flex gap-1.5">
          <Input
            placeholder={t("embed_pasteLink")}
            value={linkInput}
            onChange={(e) => onLinkInputChange(e.target.value)}
            className="text-xs h-8"
            onKeyDown={(e) => { if (e.key === "Enter") onLoadLink(); }}
          />
          <Button size="sm" variant="outline" className="shrink-0 h-8 px-2.5" onClick={onLoadLink}
            disabled={loadLinkPending || !linkInput.trim()}>
            {loadLinkPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {listLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />{t("embed_loading")}</div>
        ) : customEmbeds.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">{t("embed_noMessagesYet")}</div>
        ) : (
          <div className="p-2 space-y-1">
            {customEmbeds.map((embed) => (
              <div key={embed.id} role="button" tabIndex={0}
                className={cn("w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 cursor-pointer", selectedId === embed.id && "bg-muted")}
                onClick={() => onSelectEmbed(embed)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectEmbed(embed); } }}>
                <div className="font-medium truncate">{embed.name || t("embed_untitled")}</div>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                  <Hash className="h-3 w-3" />
                  {channels.find((c) => c.id === embed.channel_id)?.name || embed.channel_id || "—"}
                  {embed.message_id && <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-1">{t("embed_sent")}</Badge>}
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onSelectEmbed(embed); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onDuplicate(embed.id); }} disabled={duplicatePending}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete(embed.id); }} disabled={deletePending}>
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
}
