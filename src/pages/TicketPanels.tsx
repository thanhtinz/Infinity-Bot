import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import type {
  TicketButton,
  TicketPanel,
  PanelForm,
  ButtonForm,
  TicketPanelGroup,
  PanelGroupForm,
} from "./ticket-panels/tpTypes";
import {
  DEFAULT_COLOR,
  MAX_BUTTONS,
  emptyPanelForm,
  emptyButtonForm,
  emptyPanelGroupForm,
} from "./ticket-panels/tpConstants";
import { PanelGrid } from "./ticket-panels/PanelGrid";
import { PanelEditDialog } from "./ticket-panels/PanelEditDialog";
import { GroupEditDialog } from "./ticket-panels/GroupEditDialog";
import { GroupListSection } from "./ticket-panels/GroupListSection";
import { DeletePanelDialog, DeleteGroupDialog } from "./ticket-panels/DeleteDialogs";

// ─── Main Component ──────────────────────────────────────────────────────────

export function TicketPanels() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Panel state ──
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<TicketPanel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TicketPanel | null>(null);
  const [form, setForm] = useState<PanelForm>(emptyPanelForm());
  const [activeTab, setActiveTab] = useState<string>("embed");

  // ── Button editing state (inline within sheet) ──
  const [editingBtnIdx, setEditingBtnIdx] = useState<number | null>(null);
  const [btnForm, setBtnForm] = useState<ButtonForm>(emptyButtonForm());

  // ── Group state ──
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TicketPanelGroup | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<TicketPanelGroup | null>(null);
  const [groupForm, setGroupForm] = useState<PanelGroupForm>(emptyPanelGroupForm());

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: panels = [], isLoading } = useQuery<TicketPanel[]>({
    queryKey: ["ticket-panels"],
    queryFn: () =>
      fetch("/api/ticket-panels", { credentials: "include" }).then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  });

  const { data: groups = [] } = useQuery<TicketPanelGroup[]>({
    queryKey: ["ticket-panel-groups"],
    queryFn: () =>
      fetch("/api/ticket-panel-groups", { credentials: "include" }).then((r) =>
        r.json()
      ),
    staleTime: 60_000,
  });

  // ── Panel Mutations ──────────────────────────────────────────────────────

  const createMutation = useMutation<any, Error, Record<string, unknown>>({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/ticket-panels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-panels"] });
      setSheetOpen(false);
      toast({ title: "Đã tạo panel thành công" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi tạo panel",
        description: e.message,
      }),
  });

  const updateMutation = useMutation<any, Error, { id: number } & Record<string, unknown>>({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/ticket-panels/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-panels"] });
      setSheetOpen(false);
      setEditingPanel(null);
      toast({ title: "Đã cập nhật panel" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật",
        description: e.message,
      }),
  });

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: (id: number) =>
      fetch(`/api/ticket-panels/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-panels"] });
      setDeleteTarget(null);
      toast({ title: "Đã xóa panel" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi xóa panel",
        description: e.message,
      }),
  });

  // ── Group Mutations ──────────────────────────────────────────────────────

  const createGroupMutation = useMutation<any, Error, Record<string, unknown>>({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/ticket-panel-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-panel-groups"] });
      qc.invalidateQueries({ queryKey: ["ticket-panels"] });
      setGroupSheetOpen(false);
      toast({ title: "Đã tạo nhóm panel" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi tạo nhóm",
        description: e.message,
      }),
  });

  const updateGroupMutation = useMutation<any, Error, { id: number } & Record<string, unknown>>({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/ticket-panel-groups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-panel-groups"] });
      qc.invalidateQueries({ queryKey: ["ticket-panels"] });
      setGroupSheetOpen(false);
      setEditingGroup(null);
      toast({ title: "Đã cập nhật nhóm" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi cập nhật nhóm",
        description: e.message,
      }),
  });

  const deleteGroupMutation = useMutation<unknown, Error, number>({
    mutationFn: (id: number) =>
      fetch(`/api/ticket-panel-groups/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-panel-groups"] });
      qc.invalidateQueries({ queryKey: ["ticket-panels"] });
      setDeleteGroupTarget(null);
      toast({ title: "Đã xóa nhóm" });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Lỗi xóa nhóm",
        description: e.message,
      }),
  });

  // ── Panel Handlers ───────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingPanel(null);
    setForm(emptyPanelForm());
    setActiveTab("embed");
    setEditingBtnIdx(null);
    setBtnForm(emptyButtonForm());
    setSheetOpen(true);
  };

  const openEdit = (p: TicketPanel) => {
    setEditingPanel(p);
    setForm({
      name: p.name,
      title: p.title ?? "",
      description: p.description ?? "",
      color: p.color ?? DEFAULT_COLOR,
      channel_id: p.channel_id ?? "",
      buttons: (p.buttons ?? []).map((b) => ({ ...b })),
      naming_format: p.naming_format ?? "",
      open_message_title: p.open_message_title ?? "",
      open_message_body: p.open_message_body ?? "",
      close_message_title: p.close_message_title ?? "",
      close_message_body: p.close_message_body ?? "",
      claim_message_title: p.claim_message_title ?? "",
      claim_message_body: p.claim_message_body ?? "",
    });
    setActiveTab("embed");
    setEditingBtnIdx(null);
    setBtnForm(emptyButtonForm());
    setSheetOpen(true);
  };

  const handleSave = () => {
    const payload: Record<string, unknown> = {
      name: form.name,
      title: form.title,
      description: form.description,
      color: form.color,
      channel_id: form.channel_id,
      buttons: form.buttons.map(({ label, emoji, style, category_id, form_id }) => ({
        label,
        emoji,
        style,
        category_id,
        ...(form_id ? { form_id } : {}),
      })),
      naming_format: form.naming_format.trim() || null,
      open_message_title: form.open_message_title.trim() || null,
      open_message_body: form.open_message_body.trim() || null,
      close_message_title: form.close_message_title.trim() || null,
      close_message_body: form.close_message_body.trim() || null,
      claim_message_title: form.claim_message_title.trim() || null,
      claim_message_body: form.claim_message_body.trim() || null,
    };
    if (editingPanel) {
      updateMutation.mutate({ id: editingPanel.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const setField = <K extends keyof PanelForm>(field: K, value: PanelForm[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Button Handlers (inline in sheet) ────────────────────────────────────

  const startAddButton = () => {
    if (form.buttons.length >= MAX_BUTTONS) return;
    setEditingBtnIdx(form.buttons.length);
    setBtnForm(emptyButtonForm());
  };

  const startEditButton = (idx: number) => {
    const btn = form.buttons[idx];
    setEditingBtnIdx(idx);
    setBtnForm({
      label: btn.label,
      emoji: btn.emoji,
      style: btn.style,
      category_id: btn.category_id,
      form_id: btn.form_id ?? "",
    });
  };

  const confirmButton = () => {
    if (!btnForm.label.trim()) return;
    const newBtn: TicketButton = {
      label: btnForm.label,
      emoji: btnForm.emoji,
      style: btnForm.style,
      category_id: btnForm.category_id,
      ...(btnForm.form_id ? { form_id: btnForm.form_id } : {}),
    };
    if (editingBtnIdx !== null && editingBtnIdx < form.buttons.length) {
      // Update existing
      const updated = [...form.buttons];
      updated[editingBtnIdx] = { ...updated[editingBtnIdx], ...newBtn };
      setField("buttons", updated);
    } else {
      // Add new
      setField("buttons", [...form.buttons, newBtn]);
    }
    setEditingBtnIdx(null);
    setBtnForm(emptyButtonForm());
  };

  const removeButton = (idx: number) => {
    const updated = form.buttons.filter((_, i) => i !== idx);
    setField("buttons", updated);
    if (editingBtnIdx === idx) {
      setEditingBtnIdx(null);
      setBtnForm(emptyButtonForm());
    }
  };

  const cancelButtonEdit = () => {
    setEditingBtnIdx(null);
    setBtnForm(emptyButtonForm());
  };

  const setBtnField = <K extends keyof ButtonForm>(
    field: K,
    value: ButtonForm[K]
  ) => setBtnForm((prev) => ({ ...prev, [field]: value }));

  // ── Group Handlers ───────────────────────────────────────────────────────

  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm(emptyPanelGroupForm());
    setGroupSheetOpen(true);
  };

  const openEditGroup = (g: TicketPanelGroup) => {
    setEditingGroup(g);
    setGroupForm({
      name: g.name,
      title: g.title ?? "",
      description: g.description ?? "",
      color: g.color ?? DEFAULT_COLOR,
      channel_id: g.channel_id ?? "",
      panel_ids: [...(g.panel_ids ?? [])],
    });
    setGroupSheetOpen(true);
  };

  const handleSaveGroup = () => {
    const payload: Record<string, unknown> = {
      name: groupForm.name,
      title: groupForm.title,
      description: groupForm.description,
      color: groupForm.color,
      channel_id: groupForm.channel_id,
      panel_ids: groupForm.panel_ids,
    };
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, ...payload });
    } else {
      createGroupMutation.mutate(payload);
    }
  };

  const isSavingGroup = createGroupMutation.isPending || updateGroupMutation.isPending;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Panels</h1>
            <Badge variant="secondary" className="text-xs font-medium">
              {panels.length} panel
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Quản lý panel tạo ticket cho server Discord của bạn
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo Panel
        </Button>
      </div>

      {/* ── Panel Grid ── */}
      <PanelGrid
        panels={panels}
        groups={groups}
        isLoading={isLoading}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
      />

      {/* ── Panel Groups Section ── */}
      <GroupListSection
        groups={groups}
        panels={panels}
        onCreateGroup={openCreateGroup}
        onEditGroup={openEditGroup}
        onDeleteGroup={setDeleteGroupTarget}
      />

      {/* ── Create / Edit Panel Dialog ── */}
      <PanelEditDialog
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSheetOpen(false);
            setEditingPanel(null);
          }
        }}
        editingPanel={editingPanel}
        form={form}
        setField={setField}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSaving={isSaving}
        onSave={handleSave}
        onCancel={() => {
          setSheetOpen(false);
          setEditingPanel(null);
        }}
        editingBtnIdx={editingBtnIdx}
        btnForm={btnForm}
        setBtnField={setBtnField}
        startAddButton={startAddButton}
        startEditButton={startEditButton}
        confirmButton={confirmButton}
        removeButton={removeButton}
        cancelButtonEdit={cancelButtonEdit}
      />

      {/* ── Delete Panel Confirmation Dialog ── */}
      <DeletePanelDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />

      {/* ── Group Edit Dialog ── */}
      <GroupEditDialog
        open={groupSheetOpen}
        onOpenChange={(open) => { if (!open) { setGroupSheetOpen(false); setEditingGroup(null); } }}
        editingGroup={editingGroup}
        groupForm={groupForm}
        setGroupForm={setGroupForm}
        isSaving={isSavingGroup}
        onSave={handleSaveGroup}
        onCancel={() => { setGroupSheetOpen(false); setEditingGroup(null); }}
        panels={panels}
        groups={groups}
      />

      {/* ── Delete Group Dialog ── */}
      <DeleteGroupDialog
        target={deleteGroupTarget}
        onClose={() => setDeleteGroupTarget(null)}
        onConfirm={() => deleteGroupTarget && deleteGroupMutation.mutate(deleteGroupTarget.id)}
        isPending={deleteGroupMutation.isPending}
      />
    </div>
  );
}
