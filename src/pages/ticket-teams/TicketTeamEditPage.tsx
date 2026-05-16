import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { MultiRoleSelect } from "@/components/RoleSelect";
import { ArrowLeft } from "lucide-react";

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

export function TicketTeamEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !id;

  const [teamName, setTeamName] = useState("Team mới");
  const [teamDesc, setTeamDesc] = useState("");
  const [teamColor, setTeamColor] = useState("#5865F2");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [selectedPanelIds, setSelectedPanelIds] = useState<number[]>([]);

  const { data: teams, isLoading } = useQuery({
    queryKey: ["ticket-teams"],
    queryFn: () => fetch("/api/ticket-teams").then((r) => r.json()),
    enabled: !isNew,
    staleTime: 60_000,
  });

  const { data: panels } = useQuery({
    queryKey: ["ticket-panels"],
    queryFn: () => fetch("/api/ticket-panels").then((r) => r.json()),
    staleTime: 30_000,
  });

  const item = id ? (teams as TicketTeamType[] | undefined)?.find((t) => String(t.id) === id) : undefined;

  useEffect(() => {
    if (item) {
      setTeamName(item.name);
      setTeamDesc(item.description ?? "");
      setTeamColor(item.color);
      setRoleIds([...(item.role_ids ?? [])]);
      setSelectedPanelIds([...(item.panel_ids ?? [])]);
    }
  }, [item?.id]);

  // ── Mutations ───────────────────────────────────────────────────────────

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
      navigate(-1);
      toast({ title: "Đã tạo team thành công" });
    },
    onError: () => toast({ title: "Lỗi khi tạo team", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id: teamId, ...body }: { id: number } & Record<string, unknown>) =>
      fetch(`/api/ticket-teams/${teamId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-teams"] });
      navigate(-1);
      toast({ title: "Đã cập nhật team" });
    },
    onError: () => toast({ title: "Lỗi khi cập nhật", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSave() {
    const payload = {
      name: teamName,
      description: teamDesc || null,
      color: teamColor,
      role_ids: roleIds,
      panel_ids: selectedPanelIds,
    };
    if (!isNew && id) {
      updateMutation.mutate({ id: Number(id), ...payload });
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

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-card px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-semibold text-lg">{isNew ? "Tạo mới" : "Edit"}</h1>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={!teamName.trim() || isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
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
          <Label>Description</Label>
          <Textarea
            value={teamDesc}
            onChange={(e) => setTeamDesc(e.target.value)}
            placeholder="Mô tả ngắn về team..."
            rows={3}
          />
        </div>

        {/* Color */}
        <div className="space-y-2">
          <Label>Colors</Label>
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
            disabled={!isNew}
          />
        </div>

        <Separator />

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
    </div>
  );
}
