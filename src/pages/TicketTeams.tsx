import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { UserCheck, Plus, Pencil, Trash2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TicketTeamType {
  id: number;
  guild_id?: string;
  name: string;
  description?: string;
  role_ids: string[];
  panel_ids: number[];
  color: string;
  created_at?: string;
}

interface TicketPanel {
  id: number;
  name: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DISCORD_COLORS = [
  { value: "#5865F2", label: "Blurple" },
  { value: "#57f287", label: "Green" },
  { value: "#ed4245", label: "Red" },
  { value: "#fee75c", label: "Yellow" },
  { value: "#eb459e", label: "Fuchsia" },
  { value: "#3ba55d", label: "Dark Green" },
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export function TicketTeams() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TicketTeamType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TicketTeamType | null>(null);

  // Form state
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [teamColor, setTeamColor] = useState("#5865F2");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [selectedPanelIds, setSelectedPanelIds] = useState<number[]>([]);

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: teams, isLoading } = useQuery({
    queryKey: ["ticket-teams"],
    queryFn: () => fetch("/api/ticket-teams").then((r) => r.json()),
    staleTime: 30_000,
  });

  const { data: panels } = useQuery({
    queryKey: ["ticket-panels"],
    queryFn: () => fetch("/api/ticket-panels").then((r) => r.json()),
    staleTime: 30_000,
  });

  // ─── Mutations ───────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/ticket-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-teams"] });
      toast({ title: "Đã tạo team thành công" });
      closeSheet();
    },
    onError: () => toast({ title: "Lỗi khi tạo team", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/ticket-teams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-teams"] });
      toast({ title: "Đã cập nhật team" });
      closeSheet();
    },
    onError: () => toast({ title: "Lỗi khi cập nhật", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/ticket-teams/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-teams"] });
      toast({ title: "Đã xóa team" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Lỗi khi xóa", variant: "destructive" }),
  });

  // ─── Handlers ────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingTeam(null);
    setTeamName("Team mới");
    setTeamDesc("");
    setTeamColor("#5865F2");
    setRoleIds([]);
    setSelectedPanelIds([]);
    setSheetOpen(true);
  }

  function openEdit(t: TicketTeamType) {
    setEditingTeam(t);
    setTeamName(t.name);
    setTeamDesc(t.description ?? "");
    setTeamColor(t.color);
    setRoleIds([...(t.role_ids ?? [])]);
    setSelectedPanelIds([...(t.panel_ids ?? [])]);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditingTeam(null);
  }

  function handleSave() {
    const payload = {
      name: teamName,
      description: teamDesc || null,
      color: teamColor,
      role_ids: roleIds,
      panel_ids: selectedPanelIds,
    };
    if (editingTeam) {
      updateMutation.mutate({ id: editingTeam.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function togglePanel(panelId: number) {
    setSelectedPanelIds((prev) =>
      prev.includes(panelId)
        ? prev.filter((p) => p !== panelId)
        : [...prev, panelId]
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ─── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const teamList = (teams as TicketTeamType[] | undefined) ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Teams</h1>
          <p className="text-muted-foreground text-sm">
            Phân chia nhân sự theo từng loại hỗ trợ
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Tạo team
        </Button>
      </div>

      {/* Grid */}
      {teamList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <UserCheck className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Chưa có team nào</p>
          <p className="text-sm">Tạo team để phân chia nhân sự hỗ trợ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamList.map((t) => (
            <Card
              key={t.id}
              className="cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
              onClick={() => openEdit(t)}
            >
              <div
                className="h-1.5"
                style={{ backgroundColor: t.color || "#5865F2" }}
              />
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{t.name}</h3>
                    {t.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {t.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">{t.role_ids?.length ?? 0} roles</Badge>
                  <Badge variant="outline">{t.panel_ids?.length ?? 0} panels</Badge>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(t);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(t);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Dialog Editor ── */}
      <Dialog open={sheetOpen} onOpenChange={(open) => { if (!open) closeSheet(); }}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTeam ? "Chỉnh sửa team" : "Tạo team mới"}</DialogTitle>
            <DialogDescription>
              {editingTeam ? "Cập nhật thông tin team" : "Thiết lập team hỗ trợ"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>Tên team</Label>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team mới"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Textarea
                value={teamDesc}
                onChange={(e) => setTeamDesc(e.target.value)}
                placeholder="Mô tả ngắn về team..."
                rows={3}
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label>Màu sắc</Label>
              <div className="flex gap-2">
                {DISCORD_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className="h-8 w-8 rounded-full border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: c.value,
                      borderColor: teamColor === c.value ? "#fff" : "transparent",
                      outline: teamColor === c.value ? `2px solid ${c.value}` : "none",
                    }}
                    title={c.label}
                    onClick={() => setTeamColor(c.value)}
                  />
                ))}
              </div>
            </div>

            {/* Role IDs */}
            <div className="space-y-2">
              <Label>Discord Role IDs</Label>
              <MultiRoleSelect
                value={roleIds}
                onChange={setRoleIds}
                placeholder="Chọn roles..."
                disabled={!!editingTeam}
              />
            </div>

            {/* Panel assignment */}
            <div className="space-y-2">
              <Label>Panel được gắn</Label>
              <div className="space-y-2 rounded-lg border p-3 max-h-48 overflow-y-auto">
                {((panels as TicketPanel[] | undefined) ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có panel nào</p>
                ) : (
                  ((panels as TicketPanel[] | undefined) ?? []).map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedPanelIds.includes(p.id)}
                        onCheckedChange={() => togglePanel(p.id)}
                      />
                      <span className="text-sm">{p.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Footer */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={closeSheet}>
              Hủy
            </Button>
            {editingTeam && (
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteTarget(editingTeam)}
              >
                Xóa
              </Button>
            )}
            <Button
              className="flex-1"
              disabled={!teamName.trim() || isSaving}
              onClick={handleSave}
            >
              {isSaving ? "Đang lưu..." : editingTeam ? "Cập nhật" : "Tạo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xóa team?</DialogTitle>
            <DialogDescription>
              Team <strong className="text-foreground">{deleteTarget?.name}</strong> sẽ bị xóa vĩnh viễn.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
