import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useT } from "@/i18n";
import type { TicketPanel, TicketPanelGroup } from "./tpTypes";

// ─── Delete Panel Dialog ─────────────────────────────────────────────────────

export interface DeletePanelDialogProps {
  target: TicketPanel | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeletePanelDialog({ target, onClose, onConfirm, isPending }: DeletePanelDialogProps) {
  const { t } = useT();
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("ticketPanels_deletePanel")}</DialogTitle>
          <DialogDescription>
            {t("ticketPanels_deletePanelDesc")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending ? t("deleting") : t("delete")}
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
  const { t } = useT();
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("ticketPanels_deleteGroup")}</DialogTitle>
          <DialogDescription>
            {t("ticketPanels_deleteGroupDesc")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending ? t("deleting") : t("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
