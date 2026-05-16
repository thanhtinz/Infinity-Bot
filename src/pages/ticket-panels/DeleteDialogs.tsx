import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { TicketPanel, TicketPanelGroup } from "./tpTypes";

// ─── Delete Panel Dialog ─────────────────────────────────────────────────────

export interface DeletePanelDialogProps {
  target: TicketPanel | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeletePanelDialog({ target, onClose, onConfirm, isPending }: DeletePanelDialogProps) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete panel?</DialogTitle>
          <DialogDescription>
            Panel{" "}
            <strong className="text-foreground">{target?.name}</strong>{" "}
            will be permanently deleted. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Group Dialog ─────────────────────────────────────────────────────

export interface DeleteGroupDialogProps {
  target: TicketPanelGroup | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteGroupDialog({ target, onClose, onConfirm, isPending }: DeleteGroupDialogProps) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete panel group?</DialogTitle>
          <DialogDescription>
            Group <strong className="text-foreground">{target?.name}</strong> will be deleted. Panels inside will become standalone panels.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
