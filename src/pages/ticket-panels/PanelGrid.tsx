import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutGrid, Plus } from "lucide-react";
import type { TicketPanel, TicketPanelGroup } from "./tpTypes";
import { PanelCard } from "./tpComponents";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface PanelGridProps {
  panels: TicketPanel[];
  groups: TicketPanelGroup[];
  isLoading: boolean;
  onCreate: () => void;
  onEdit: (p: TicketPanel) => void;
  onDelete: (p: TicketPanel) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PanelGrid({ panels, groups, isLoading, onCreate, onEdit, onDelete }: PanelGridProps) {
  // Build a map of panel -> group for badge display
  const panelGroupMap = new Map<number, TicketPanelGroup>();
  for (const g of groups) {
    for (const pid of g.panel_ids) {
      panelGroupMap.set(pid, g);
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (panels.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-20 flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <LayoutGrid className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium">No panels yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Create your first Panel to start managing tickets
          </p>
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create Panel
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {panels.map((p) => {
        const grp = panelGroupMap.get(p.id);
        return (
          <PanelCard
            key={p.id}
            panel={p}
            groupName={grp?.name}
            groupColor={grp?.color}
            onEdit={() => onEdit(p)}
            onDelete={() => onDelete(p)}
          />
        );
      })}
    </div>
  );
}
