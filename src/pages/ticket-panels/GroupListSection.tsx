import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutGrid,
  Plus,
  Pencil,
  Trash2,
  Hash,
} from "lucide-react";
import type { TicketPanel, TicketPanelGroup } from "./tpTypes";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface GroupListSectionProps {
  groups: TicketPanelGroup[];
  panels: TicketPanel[];
  onCreateGroup: () => void;
  onEditGroup: (g: TicketPanelGroup) => void;
  onDeleteGroup: (g: TicketPanelGroup) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GroupListSection({
  groups,
  panels,
  onCreateGroup,
  onEditGroup,
  onDeleteGroup,
}: GroupListSectionProps) {
  return (
    <>
      <Separator />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Multi-Panel Groups</h2>
            <p className="text-sm text-muted-foreground">
              Gộp nhiều panel vào 1 embed message trên Discord
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onCreateGroup}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Tạo Nhóm
          </Button>
        </div>

        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <LayoutGrid className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Chưa có nhóm nào. Tạo nhóm để gộp nhiều panel buttons vào 1 message.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map(g => {
              const memberPanels = panels.filter(p => g.panel_ids.includes(p.id));
              return (
                <Card key={g.id} className="overflow-hidden">
                  <div className="h-1" style={{ backgroundColor: g.color }} />
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{g.name}</p>
                        <p className="text-xs text-muted-foreground">{g.title}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditGroup(g)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDeleteGroup(g)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {memberPanels.length > 0 ? memberPanels.map(p => (
                        <Badge key={p.id} variant="secondary" className="text-xs">{p.name}</Badge>
                      )) : (
                        <span className="text-xs text-muted-foreground italic">Chưa có panel nào trong nhóm</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={g.is_sent ? "default" : "outline"} className="text-[10px]">
                        {g.is_sent ? "Đã gửi" : "Not sent"}
                      </Badge>
                      {g.channel_id && (
                        <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{g.channel_id}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
