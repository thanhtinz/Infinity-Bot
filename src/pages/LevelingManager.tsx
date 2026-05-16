import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import type { PointerEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ChannelSelect, MultiChannelSelect } from "@/components/ChannelSelect";
import { MultiRoleSelect, RoleSelect } from "@/components/RoleSelect";
import { Filter, Gift, Hash, ImagePlus, ListOrdered, Settings, Shield, Sparkles, User, X, Zap, Layers, MousePointer2, Type, Square, CircleUserRound, Wand2, MessageSquareText, Maximize2, ZoomIn, ZoomOut, RotateCcw, ArrowLeft, Save, Copy, Trash2, Eye, EyeOff, Plus, RefreshCw, Upload } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";

interface LevelingConfig {
  enabled: boolean;
  xp_min: number;
  xp_max: number;
  cooldown_seconds: number;
  level_up_channel_id?: string | null;
  level_up_mode: string;
  ignored_channels: string[];
  ignored_roles: string[];
  ignored_users: string[];
  whitelist_channels: string[];
  use_channel_whitelist: boolean;
  gain_xp_from_commands: boolean;
  remove_old_reward_roles: boolean;
  stack_reward_roles: boolean;
}
interface LeaderboardItem { rank: number; discord_id: string; username?: string; xp: number; level: number; message_count: number }
type RankLayerType = "rect" | "avatar" | "text" | "progress";
interface RankCardLayer {
  id: string;
  type: RankLayerType;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  visible: boolean;
  color?: string;
  stroke?: string;
  stroke_width?: number;
  radius?: number;
  opacity?: number;
  token?: string;
  text?: string;
  font_size?: number;
  bold?: boolean;
  shape?: string;
  track?: string;
  fill?: string;
}
interface RankCardLayout {
  width: number;
  height: number;
  background: { style: string; color: string; accent: string };
  layers: RankCardLayer[];
}

interface Reward { id: number; level: number; role_id: string; role_name?: string; remove_on_higher: boolean; dm_user: boolean }
interface Multiplier { id: number; type: string; target_id?: string; target_name?: string; multiplier: number; priority: number; enabled: boolean }
export interface RankCardConfig {
  accent: string;
  secondary_accent: string;
  background: string;
  panel_style: string;
  progress_style: string;
  avatar_shape: string;
  card_radius: number;
  panel_opacity: number;
  glow_strength: number;
  avatar_size: number;
  show_avatar_ring: boolean;
  show_progress_bar: boolean;
  show_username: boolean;
  show_server: boolean;
  show_total_xp: boolean;
  show_percent: boolean;
  show_rank: boolean;
  show_level: boolean;
  rank_label: string;
  level_label: string;
  xp_label: string;
  layout_config: RankCardLayout;
  username: string;
  display_name: string;
  server: string;
  custom_bg_url?: string | null;
}

const defaultLayout = (): RankCardLayout => ({
  width: 980,
  height: 320,
  background: { style: "gradient", color: "#0B1020", accent: "#7C8CFF" },
  layers: [
    { id: "panel", type: "rect", name: "Glass panel", x: 28, y: 28, w: 924, h: 264, z: 1, visible: true, color: "#FFFFFF", radius: 34, opacity: 14, stroke: "#FFFFFF", stroke_width: 1 },
    { id: "avatar", type: "avatar", name: "Avatar", x: 62, y: 70, w: 178, h: 178, z: 2, visible: true, radius: 90, shape: "circle" },
    { id: "display", type: "text", name: "Display name", x: 278, y: 72, w: 455, h: 54, z: 3, visible: true, token: "display_name", color: "#FFFFFF", font_size: 44, bold: true, opacity: 100 },
    { id: "username", type: "text", name: "Username", x: 278, y: 124, w: 420, h: 28, z: 4, visible: true, token: "username", color: "#BAC3DA", font_size: 22, opacity: 96 },
    { id: "server", type: "text", name: "Server", x: 278, y: 160, w: 420, h: 24, z: 5, visible: true, token: "server", color: "#8490AA", font_size: 17, opacity: 90 },
    { id: "rankBox", type: "rect", name: "Rank capsule", x: 650, y: 96, w: 138, h: 70, z: 6, visible: true, color: "#FFFFFF", radius: 22, opacity: 9, stroke: "#FFFFFF", stroke_width: 1 },
    { id: "rankText", type: "text", name: "Rank text", x: 668, y: 126, w: 96, h: 38, z: 7, visible: true, token: "rank", color: "#FFFFFF", font_size: 34, bold: true, opacity: 100 },
    { id: "levelBox", type: "rect", name: "Level capsule", x: 806, y: 96, w: 138, h: 70, z: 8, visible: true, color: "#7C8CFF", radius: 22, opacity: 18, stroke: "#FFFFFF", stroke_width: 1 },
    { id: "levelText", type: "text", name: "Level text", x: 824, y: 126, w: 96, h: 38, z: 9, visible: true, token: "level", color: "#FFFFFF", font_size: 34, bold: true, opacity: 100 },
    { id: "progress", type: "progress", name: "Progress bar", x: 278, y: 232, w: 626, h: 34, z: 10, visible: true, radius: 17, track: "#FFFFFF", fill: "#7C8CFF", opacity: 100 },
    { id: "xp", type: "text", name: "XP text", x: 278, y: 202, w: 320, h: 24, z: 11, visible: true, token: "progress", color: "#E2E7F4", font_size: 17, opacity: 96 },
    { id: "percent", type: "text", name: "Percent", x: 845, y: 202, w: 60, h: 24, z: 12, visible: true, token: "percent", color: "#E2E7F4", font_size: 17, opacity: 96 },
  ],
});

const LAYER_PRESETS: { type: RankLayerType; name: string; desc: string; layer: Omit<RankCardLayer, "id" | "z"> }[] = [
  { type: "text", name: "Display name", desc: "Tên lớn của user", layer: { type: "text", name: "Display name", x: 278, y: 72, w: 455, h: 54, visible: true, token: "display_name", color: "#FFFFFF", font_size: 44, bold: true, opacity: 100 } },
  { type: "text", name: "Username", desc: "Username nhỏ", layer: { type: "text", name: "Username", x: 278, y: 124, w: 420, h: 28, visible: true, token: "username", color: "#BAC3DA", font_size: 22, opacity: 96 } },
  { type: "text", name: "Server", desc: "Tên server", layer: { type: "text", name: "Server", x: 278, y: 160, w: 420, h: 24, visible: true, token: "server", color: "#8490AA", font_size: 17, opacity: 90 } },
  { type: "avatar", name: "Avatar", desc: "Avatar user", layer: { type: "avatar", name: "Avatar", x: 62, y: 70, w: 178, h: 178, visible: true, radius: 90, shape: "circle", stroke: "#FFFFFF", stroke_width: 4 } },
  { type: "progress", name: "Progress bar", desc: "Thanh tiến độ XP", layer: { type: "progress", name: "Progress bar", x: 278, y: 232, w: 626, h: 34, visible: true, radius: 17, track: "#FFFFFF", fill: "#7C8CFF", opacity: 100 } },
  { type: "rect", name: "Glass panel", desc: "Nền kính", layer: { type: "rect", name: "Glass panel", x: 28, y: 28, w: 924, h: 264, visible: true, color: "#FFFFFF", radius: 34, opacity: 14, stroke: "#FFFFFF", stroke_width: 1 } },
  { type: "rect", name: "Stat capsule", desc: "Ô rank/level", layer: { type: "rect", name: "Stat capsule", x: 650, y: 96, w: 138, h: 70, visible: true, color: "#FFFFFF", radius: 22, opacity: 10, stroke: "#FFFFFF", stroke_width: 1 } },
  { type: "text", name: "Rank text", desc: "Text #rank", layer: { type: "text", name: "Rank text", x: 668, y: 126, w: 96, h: 38, visible: true, token: "rank", color: "#FFFFFF", font_size: 34, bold: true, opacity: 100 } },
  { type: "text", name: "Level text", desc: "Text level", layer: { type: "text", name: "Level text", x: 824, y: 126, w: 96, h: 38, visible: true, token: "level", color: "#FFFFFF", font_size: 34, bold: true, opacity: 100 } },
  { type: "text", name: "XP text", desc: "Text XP/progress", layer: { type: "text", name: "XP text", x: 278, y: 202, w: 320, h: 24, visible: true, token: "progress", color: "#E2E7F4", font_size: 17, opacity: 96 } },
];



function IdListEditor({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const ids = draft.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);
    if (!ids.length) return;
    onChange(Array.from(new Set([...value, ...ids])));
    setDraft("");

  };
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 pr-1">
              <User className="h-3 w-3" /> {id}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== id))} className="rounded-sm text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Discord user ID, cách nhau bằng dấu phẩy" />
        <Button type="button" variant="secondary" onClick={add}>Add</Button>
      </div>

    </div>
  );
}

const previewToken = (layer: RankCardLayer): string => {
  const values: Record<string, string> = {
    display_name: "Nguyen Studio",
    username: "@nguyen.dev",
    server: "Discord Bot Builder",
    level: "LV 42",
    rank: "#1",
    xp: "124,800 XP",
    progress: "8,420 / 10,000 XP",
    percent: "84%",
  };
  return values[layer.token || "display_name"] || layer.text || layer.name;
};

function CanvasLayerPreview({ layer, layout, selected, onPointerDown }: { layer: RankCardLayer; layout: RankCardLayout; selected: boolean; onPointerDown: (event: PointerEvent<HTMLDivElement>) => void }) {
  const commonStyle = {
    left: `${(layer.x / layout.width) * 100}%`,
    top: `${(layer.y / layout.height) * 100}%`,
    width: `${(layer.w / layout.width) * 100}%`,
    height: `${(layer.h / layout.height) * 100}%`,
    opacity: (layer.opacity ?? 100) / 100,
    zIndex: layer.z,
    borderRadius: layer.type === "avatar" ? "9999px" : layer.radius ?? 12,
  };

  if (!layer.visible) return null;

  if (layer.type === "text") {
    return (
      <div
        className={`absolute cursor-grab select-none overflow-hidden rounded-md px-1 text-left leading-none active:cursor-grabbing ${selected ? "ring-2 ring-sky-300 ring-offset-2 ring-offset-slate-950" : "hover:ring-1 hover:ring-white/50"}`}
        style={{ ...commonStyle, color: layer.color || "#fff", fontSize: layer.font_size || 24, fontWeight: layer.bold ? 800 : 500 }}
        onPointerDown={onPointerDown}
      >
        {previewToken(layer)}
      </div>
    );
  }

  if (layer.type === "avatar") {
    return (
      <div
        className={`absolute cursor-grab select-none active:cursor-grabbing ${selected ? "ring-2 ring-sky-300 ring-offset-2 ring-offset-slate-950" : "hover:ring-1 hover:ring-white/50"}`}
        style={{ ...commonStyle, background: "linear-gradient(135deg,#f8fafc,#94a3b8)", border: `${layer.stroke_width || 4}px solid ${layer.stroke || "rgba(255,255,255,.72)"}` }}
        onPointerDown={onPointerDown}
      >
        <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900/20 text-3xl font-black text-slate-900/55">A</div>
      </div>
    );
  }

  if (layer.type === "progress") {
    return (
      <div
        className={`absolute cursor-grab select-none overflow-hidden active:cursor-grabbing ${selected ? "ring-2 ring-sky-300 ring-offset-2 ring-offset-slate-950" : "hover:ring-1 hover:ring-white/50"}`}
        style={{ ...commonStyle, backgroundColor: layer.track || "rgba(255,255,255,.18)" }}
        onPointerDown={onPointerDown}
      >
        <div className="h-full" style={{ width: "84%", background: layer.fill || layer.color || "#7C8CFF", borderRadius: layer.radius ?? 12 }} />
      </div>
    );
  }

  return (
    <div
      className={`absolute cursor-grab select-none active:cursor-grabbing ${selected ? "ring-2 ring-sky-300 ring-offset-2 ring-offset-slate-950" : "hover:ring-1 hover:ring-white/50"}`}
      style={{ ...commonStyle, backgroundColor: layer.color || "#fff", border: layer.stroke ? `${layer.stroke_width || 1}px solid ${layer.stroke}` : undefined }}
      onPointerDown={onPointerDown}
    />
  );
}


export function LevelingManager({ section }: { section?: string } = {}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<LevelingConfig | null>(null);
  const [reward, setReward] = useState({ level: 1, role_id: "", role_name: "" });

  const [multi, setMulti] = useState({ type: "global", target_id: "", target_name: "", multiplier: 1, priority: 0, enabled: true });
  const [previewVersion, setPreviewVersion] = useState(0);
  const [rankCard, setRankCard] = useState<RankCardConfig | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState("display");
  const [canvasDialogOpen, setCanvasDialogOpen] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(0.45);
  const [serverPreviewUrl, setServerPreviewUrl] = useState<string | null>(null);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const bgInputRef = useRef<HTMLInputElement | null>(null);
  const { data: bgList, refetch: refetchBgList } = useQuery<{ backgrounds: { slug: string; url: string; index: number }[]; active_slug: string | null }>({
    queryKey: ["leveling_bg_list"],
    queryFn: () => apiFetch("/api/leveling/rank-card/backgrounds").then(r => r.json()),
  });
  const autoSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [panState, setPanState] = useState<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);


  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<{ id: string; pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number; scale: number } | null>(null);


  const { data: config } = useQuery<LevelingConfig>({ queryKey: ["leveling_config"], queryFn: () => apiFetch("/api/leveling/config").then(r => r.json()) });
  const { data: rankCardConfig } = useQuery<RankCardConfig>({ queryKey: ["leveling_rank_card_config"], queryFn: () => apiFetch("/api/leveling/rank-card/config").then(r => r.json()) });
  const { data: leaderboard } = useQuery<{ items: LeaderboardItem[]; reset_at: string | null }>({ queryKey: ["leveling_leaderboard"], queryFn: () => apiFetch("/api/leveling/leaderboard").then(r => r.json()) });
  const { data: rewards = [] } = useQuery<Reward[]>({ queryKey: ["leveling_rewards"], queryFn: () => apiFetch("/api/leveling/rewards").then(r => r.json()).then(rows => rows.map((r: any) => ({...r, _sa_instance_state: undefined}))) });
  const { data: multipliers = [] } = useQuery<Multiplier[]>({ queryKey: ["leveling_multipliers"], queryFn: () => apiFetch("/api/leveling/multipliers").then(r => r.json()).then(rows => rows.map((r: any) => ({...r, _sa_instance_state: undefined}))) });
  const previewUrl = useMemo(() => `/api/leveling/rank-card/preview?version=${previewVersion}`, [previewVersion]);

  useEffect(() => () => {
    if (serverPreviewUrl) URL.revokeObjectURL(serverPreviewUrl);
    if (livePreviewUrl) URL.revokeObjectURL(livePreviewUrl);
    if (autoSyncTimer.current) clearTimeout(autoSyncTimer.current);
  }, [serverPreviewUrl, livePreviewUrl]);

  useEffect(() => { if (config) setForm({ ...config, ignored_users: config.ignored_users || [] }); }, [config]);
  useEffect(() => { if (rankCardConfig) setRankCard({ ...rankCardConfig, layout_config: rankCardConfig.layout_config?.layers?.length ? rankCardConfig.layout_config : defaultLayout() }); }, [rankCardConfig]);

  // Auto-sync preview whenever rankCard settings change (debounced 700ms)
  const triggerAutoSync = useCallback((card: RankCardConfig) => {
    if (autoSyncTimer.current) clearTimeout(autoSyncTimer.current);
    autoSyncTimer.current = setTimeout(async () => {
      setIsAutoSyncing(true);
      try {
        const res = await apiFetch("/api/leveling/rank-card/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(card),
        });
        if (res.ok) {
          const blob = await res.blob();
          setLivePreviewUrl((cur) => { if (cur) URL.revokeObjectURL(cur); return URL.createObjectURL(blob); });
        }
      } catch {/* ignore */} finally {
        setIsAutoSyncing(false);
      }
    }, 700);
  }, []);

  useEffect(() => {
    if (rankCard) triggerAutoSync(rankCard);
  }, [rankCard, triggerAutoSync]);

  const layout = rankCard?.layout_config;
  const selectedLayer = layout?.layers.find((layer) => layer.id === selectedLayerId) || layout?.layers[0];
  const updateLayout = (patch: Partial<RankCardLayout>) => {
    if (!rankCard) return;
    setRankCard({ ...rankCard, layout_config: { ...rankCard.layout_config, ...patch } });
  };
  const updateSelectedLayer = (patch: Partial<RankCardLayer>) => {
    if (!rankCard || !selectedLayer) return;
    setRankCard({
      ...rankCard,
      layout_config: {
        ...rankCard.layout_config,
        layers: rankCard.layout_config.layers.map((layer) => layer.id === selectedLayer.id ? { ...layer, ...patch } : layer),
      },
    });
  };
  const addLayer = (type: RankLayerType) => {
    if (!rankCard) return;
    const layer: RankCardLayer = {
      id: `${type}-${Date.now()}`,
      type,
      name: type === "text" ? "Text layer" : type === "rect" ? "Shape" : type === "avatar" ? "Avatar" : "Progress",
      x: 120,
      w: type === "text" ? 260 : 180,
      y: 80,
      h: type === "text" ? 42 : 70,
      z: Math.max(0, ...rankCard.layout_config.layers.map((layer) => layer.z || 0)) + 1,
      visible: true,
      color: "#FFFFFF",
      opacity: 100,
      radius: type === "avatar" ? 90 : 18,
      token: type === "text" ? "display_name" : undefined,
      font_size: 28,
      bold: type === "text",
      track: "#FFFFFF",
      fill: rankCard.accent,
    };
    setRankCard({ ...rankCard, layout_config: { ...rankCard.layout_config, layers: [...rankCard.layout_config.layers, layer] } });
    setSelectedLayerId(layer.id);
  };
  const addPresetLayer = (preset: (typeof LAYER_PRESETS)[number]) => {
    if (!rankCard) return;
    const layer: RankCardLayer = {
      ...preset.layer,
      id: `${preset.type}-${Date.now()}`,
      z: Math.max(0, ...rankCard.layout_config.layers.map((layer) => layer.z || 0)) + 1,
      fill: preset.layer.type === "progress" ? (preset.layer.fill || rankCard.accent) : preset.layer.fill,
    };
    setRankCard({ ...rankCard, layout_config: { ...rankCard.layout_config, layers: [...rankCard.layout_config.layers, layer] } });
    setSelectedLayerId(layer.id);
  };
  const duplicateSelectedLayer = () => {
    if (!rankCard || !selectedLayer) return;
    const layer: RankCardLayer = {
      ...selectedLayer,
      id: `${selectedLayer.type}-${Date.now()}`,
      name: `${selectedLayer.name} copy`,
      x: selectedLayer.x + 18,
      y: selectedLayer.y + 18,
      z: Math.max(0, ...rankCard.layout_config.layers.map((item) => item.z || 0)) + 1,
    };
    setRankCard({ ...rankCard, layout_config: { ...rankCard.layout_config, layers: [...rankCard.layout_config.layers, layer] } });
    setSelectedLayerId(layer.id);
  };
  const deleteSelectedLayer = () => {
    if (!rankCard || !selectedLayer) return;
    const nextLayers = rankCard.layout_config.layers.filter((layer) => layer.id !== selectedLayer.id);
    setRankCard({ ...rankCard, layout_config: { ...rankCard.layout_config, layers: nextLayers } });
    setSelectedLayerId(nextLayers[0]?.id || "");
  };
  const renderServerPreview = useMutation({
    mutationFn: async () => {
      if (!rankCard) throw new Error("Missing rank card config");
      const response = await apiFetch("/api/leveling/rank-card/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(rankCard),
      });
      if (!response.ok) throw new Error("Render failed");
      return response.blob();
    },
    onSuccess: (blob) => {
      setServerPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Render preview từ bot thất bại." }),
  });

  const saveRankCard = useMutation({
    mutationFn: () => apiFetch("/api/leveling/rank-card/config", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(rankCard) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: (data) => { setRankCard(data); setPreviewVersion((v) => v + 1); qc.invalidateQueries({ queryKey: ["leveling_rank_card_config"] }); toast({ title: "Saved", description: "Ảnh rank card đã được cập nhật." }); },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Lưu rank card thất bại." }),
  });

  const saveConfig = useMutation({
    mutationFn: () => apiFetch("/api/leveling/config", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(form) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leveling_config"] }); toast({ title: "Saved", description: "Cấu hình Leveling đã được lưu." }); },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Lưu cấu hình thất bại." }),
  });
  const addReward = useMutation({
    mutationFn: () => apiFetch("/api/leveling/rewards", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(reward) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leveling_rewards"] }); setReward({ level: 1, role_id: "", role_name: "" }); },
  });
  const delReward = useMutation({ mutationFn: (id: number) => fetch(`/api/leveling/rewards/${id}`, { method: "DELETE", credentials: "include" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["leveling_rewards"] }) });
  const addMulti = useMutation({
    mutationFn: () => apiFetch("/api/leveling/multipliers", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(multi) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leveling_multipliers"] }); setMulti({ type: "global", target_id: "", target_name: "", multiplier: 1, priority: 0, enabled: true }); },
  });
  const delMulti = useMutation({ mutationFn: (id: number) => fetch(`/api/leveling/multipliers/${id}`, { method: "DELETE", credentials: "include" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["leveling_multipliers"] }) });
  const resetLeaderboard = useMutation({
    mutationFn: () => apiFetch("/api/leveling/leaderboard/reset", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leveling_leaderboard"] }); toast({ title: "Đã reset", description: "BXH level đã được reset." }); },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Reset thất bại." }),
  });

  if (!form) return <div>Loading...</div>;

  const updateLayer = (id: string, patch: Partial<RankCardLayer>) => {
    if (!rankCard) return;
    setRankCard({
      ...rankCard,
      layout_config: {
        ...rankCard.layout_config,
        layers: rankCard.layout_config.layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer),
      },
    });
  };
  const startDragLayer = (event: PointerEvent<HTMLDivElement>, layer: RankCardLayer, viewZoom?: number) => {
    if (!layout) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedLayerId(layer.id);
    const rect = canvasRef.current?.getBoundingClientRect();
    const scale = viewZoom ? 1 / viewZoom : rect ? layout.width / rect.width : 1;
    setDragState({ id: layer.id, pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startX: layer.x, startY: layer.y, scale });
  };
  const moveDragLayer = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const nextX = Math.round(dragState.startX + (event.clientX - dragState.startClientX) * dragState.scale);
    const nextY = Math.round(dragState.startY + (event.clientY - dragState.startClientY) * dragState.scale);
    updateLayer(dragState.id, { x: nextX, y: nextY });
  };
  const endDragLayer = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    setDragState(null);
  };
  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if (!viewportRef.current || event.target !== event.currentTarget) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanState({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: viewportRef.current.scrollLeft, top: viewportRef.current.scrollTop });
  };
  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    if (!panState || panState.pointerId !== event.pointerId || !viewportRef.current) return;
    viewportRef.current.scrollLeft = panState.left - (event.clientX - panState.x);
    viewportRef.current.scrollTop = panState.top - (event.clientY - panState.y);
  };
  const endPan = (event: PointerEvent<HTMLDivElement>) => {
    if (!panState || panState.pointerId !== event.pointerId) return;
    setPanState(null);
  };
  const renderCanvas = (zoom = 1, large = false) => !layout ? null : (
    <div
      ref={large ? undefined : canvasRef}
      className={`relative touch-none overflow-hidden bg-slate-950 shadow-2xl ring-1 ring-white/10 ${large ? "rounded-[32px]" : "rounded-[20px] sm:rounded-[28px]"}`}
      style={{
        width: layout.width * zoom,
        height: layout.height * zoom,
        minWidth: layout.width * zoom,
        background: layout.background.style === "gradient"
          ? `radial-gradient(circle at 18% 10%, ${layout.background.accent}55, transparent 30%), linear-gradient(135deg, ${layout.background.color}, #020617)`
          : layout.background.color,
      }}
      onPointerMove={moveDragLayer}
      onPointerUp={endDragLayer}
      onPointerCancel={endDragLayer}
    >
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
        {[...layout.layers].sort((a, b) => a.z - b.z).map((layer) => (
          <CanvasLayerPreview
            key={layer.id}
            layer={layer}
            layout={layout}
            selected={selectedLayer?.id === layer.id}
            onPointerDown={(event) => startDragLayer(event, layer, zoom)}
          />
        ))}
      </div>
    </div>
  );

  return <div className="space-y-4 sm:space-y-6">
    <Tabs value={section || "rank-card"} className="space-y-4">
      {!section && <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:flex sm:flex-wrap sm:justify-start"><TabsTrigger value="rank-card" className="text-xs sm:text-sm">Rank Card</TabsTrigger><TabsTrigger value="config" className="text-xs sm:text-sm">XP Config</TabsTrigger><TabsTrigger value="filters" className="text-xs sm:text-sm">Filters</TabsTrigger><TabsTrigger value="leaderboard" className="text-xs sm:text-sm">Leaderboard</TabsTrigger><TabsTrigger value="rewards" className="text-xs sm:text-sm">Rewards</TabsTrigger><TabsTrigger value="multipliers" className="text-xs sm:text-sm">Multipliers</TabsTrigger></TabsList>}

      <TabsContent value="rank-card" className="space-y-4">
        {rankCard && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-500" /> Rank Card</CardTitle>
                  <CardDescription>Tuỳ chỉnh màu sắc, nền và hiển thị. Preview tự cập nhật.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => saveRankCard.mutate()} disabled={saveRankCard.isPending}><Save className="mr-1.5 h-4 w-4" />{saveRankCard.isPending ? "Saving..." : "Save"}</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setRankCard({ ...rankCard, layout_config: defaultLayout() }); }}><RotateCcw className="mr-1.5 h-4 w-4" />Reset</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
                {/* LEFT: controls */}
                <div className="space-y-5">
                  {/* Colors */}
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Wand2 className="h-4 w-4 text-violet-500" /> Màu sắc</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex items-center gap-3">
                        <input type="color" value={rankCard.accent} onChange={e => setRankCard({ ...rankCard, accent: e.target.value })} className="h-10 w-12 cursor-pointer rounded-lg border bg-transparent p-0.5" />
                        <div><Label className="text-xs">Primary accent</Label><p className="font-mono text-xs text-muted-foreground">{rankCard.accent}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="color" value={rankCard.secondary_accent} onChange={e => setRankCard({ ...rankCard, secondary_accent: e.target.value })} className="h-10 w-12 cursor-pointer rounded-lg border bg-transparent p-0.5" />
                        <div><Label className="text-xs">Secondary accent (gradient bar)</Label><p className="font-mono text-xs text-muted-foreground">{rankCard.secondary_accent}</p></div>
                      </div>
                    </div>
                  </div>

                  {/* Background Gallery */}
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><ImagePlus className="h-4 w-4 text-sky-500" /> Background</p>
                    <div className="space-y-3">
                      {/* Upload button */}
                      <button type="button" onClick={() => bgInputRef.current?.click()} disabled={bgUploading}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 py-4 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground disabled:opacity-60">
                        {bgUploading ? <><RefreshCw className="h-4 w-4 animate-spin" />Đang upload...</> : <><Upload className="h-4 w-4" />Upload ảnh nền mới (PNG/JPG, tối đa 10MB)</>}
                      </button>
                      <input ref={bgInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setBgUploading(true);
                        try {
                          const fd = new FormData();
                          fd.append("file", file);
                          const res = await apiFetch("/api/leveling/rank-card/background", { method: "POST", credentials: "include", body: fd });
                          if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Upload failed"); }
                          const data = await res.json();
                          // Auto-set as active
                          await apiFetch("/api/leveling/rank-card/background/active", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: data.slug }) });
                          refetchBgList();
                          setPreviewVersion(v => v + 1);
                        } catch (err: unknown) {
                          toast({ variant: "destructive", title: "Lỗi upload", description: err instanceof Error ? err.message : "Upload thất bại." });
                        } finally {
                          setBgUploading(false);
                          e.target.value = "";
                        }
                      }} />
                      {/* Gallery grid */}
                      {(bgList?.backgrounds?.length ?? 0) > 0 && (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {/* No background option */}
                          <button type="button" onClick={async () => {
                            await apiFetch("/api/leveling/rank-card/background/active", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: "" }) });
                            refetchBgList(); setPreviewVersion(v => v + 1);
                          }} className={`group relative aspect-video overflow-hidden rounded-xl border-2 bg-slate-900 transition ${!bgList?.active_slug ? "border-primary ring-2 ring-primary/40" : "border-transparent hover:border-muted-foreground/40"}`}>
                            <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Không có</span>
                          </button>
                          {bgList?.backgrounds.map(bg => (
                            <div key={bg.slug} className="group relative">
                              <button type="button" onClick={async () => {
                                await apiFetch("/api/leveling/rank-card/background/active", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: bg.slug }) });
                                refetchBgList(); setPreviewVersion(v => v + 1);
                              }} className={`block w-full aspect-video overflow-hidden rounded-xl border-2 transition ${bgList?.active_slug === bg.slug ? "border-primary ring-2 ring-primary/40" : "border-transparent hover:border-muted-foreground/40"}`}>
                                <img src={bg.url + "?t=" + Date.now()} alt={bg.slug} className="h-full w-full object-cover" />
                              </button>
                              {bgList?.active_slug === bg.slug && (
                                <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">Đang dùng</span>
                              )}
                              <button type="button" onClick={async () => {
                                await fetch(`/api/leveling/rank-card/background/${bg.slug}`, { method: "DELETE", credentials: "include" });
                                refetchBgList(); setPreviewVersion(v => v + 1);
                              }} className="absolute right-1 top-1 hidden rounded bg-black/70 p-0.5 text-white hover:bg-destructive group-hover:flex">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Toggles hiển thị */}
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="mb-3 text-sm font-semibold">Hiển thị thành phần</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {([
                        ["show_rank", "Rank (#1, #2...)"],
                        ["show_level", "Level"],
                        ["show_progress_bar", "Thanh XP"],
                        ["show_percent", "Phần trăm XP"],
                        ["show_total_xp", "Tổng XP"],
                        ["show_username", "Username"],
                        ["show_server", "Tên server"],
                        ["show_avatar_ring", "Viền avatar"],
                      ] as [keyof RankCardConfig, string][]).map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between rounded-xl border px-3 py-2">
                          <Label className="text-xs">{label}</Label>
                          <Switch checked={Boolean(rankCard[key])} onCheckedChange={v => setRankCard({ ...rankCard, [key]: v })} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Labels */}
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="mb-3 text-sm font-semibold">Nhãn tuỳ chỉnh</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div><Label className="text-xs">Nhãn Rank</Label><Input value={rankCard.rank_label} onChange={e => setRankCard({ ...rankCard, rank_label: e.target.value })} placeholder="Rank" /></div>
                      <div><Label className="text-xs">Nhãn Level</Label><Input value={rankCard.level_label} onChange={e => setRankCard({ ...rankCard, level_label: e.target.value })} placeholder="Level" /></div>
                      <div><Label className="text-xs">Nhãn XP</Label><Input value={rankCard.xp_label} onChange={e => setRankCard({ ...rankCard, xp_label: e.target.value })} placeholder="XP" /></div>
                    </div>
                  </div>

                  {/* Avatar size slider */}
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="mb-3 text-sm font-semibold">Kích thước Avatar</p>
                    <div className="flex items-center gap-4">
                      <Slider min={60} max={130} step={2} value={[rankCard.avatar_size]} onValueChange={([v]) => setRankCard({ ...rankCard, avatar_size: v })} className="flex-1" />
                      <span className="w-10 text-right text-sm font-mono">{rankCard.avatar_size}px</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT: live preview */}
                <div className="flex flex-col gap-3">
                  <div className="sticky top-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Preview (bot render)</p>
                      <div className="flex items-center gap-2">
                        {isAutoSyncing && <span className="flex items-center gap-1 text-xs text-muted-foreground"><RefreshCw className="h-3 w-3 animate-spin" />Đang sync...</span>}
                        <Button size="sm" variant="ghost" onClick={() => rankCard && triggerAutoSync(rankCard)}><RefreshCw className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-2xl border bg-slate-950 shadow-inner">
                      <img
                        src={livePreviewUrl || `/api/leveling/rank-card/preview?v=${previewVersion}`}
                        alt="Rank card preview"
                        className="block w-full"
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Preview tự cập nhật sau khi thay đổi (~0.7s). Bấm Lưu để lưu vĩnh viễn vào database.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="hidden">
            {rankCard && <div className="grid gap-3 rounded-2xl border bg-background/70 p-3 sm:rounded-3xl sm:p-4 xl:grid-cols-[1fr_1fr_auto]">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div><Label>Primary accent</Label><Input type="color" value={rankCard.accent} onChange={e => setRankCard({...rankCard, accent: e.target.value})} className="h-10" /></div>
                <div><Label>Secondary accent</Label><Input type="color" value={rankCard.secondary_accent} onChange={e => setRankCard({...rankCard, secondary_accent: e.target.value})} className="h-10" /></div>
                <div><Label>Background</Label><Select value={rankCard.background} onValueChange={v => setRankCard({...rankCard, background: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aurora">Aurora</SelectItem><SelectItem value="midnight">Midnight</SelectItem><SelectItem value="sunset">Sunset</SelectItem><SelectItem value="mono">Mono</SelectItem></SelectContent></Select></div>
                <div><Label>Panel</Label><Select value={rankCard.panel_style} onValueChange={v => setRankCard({...rankCard, panel_style: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="glass">Glass</SelectItem><SelectItem value="solid">Solid</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div><Label>Display mẫu</Label><Input value={rankCard.display_name} onChange={e => setRankCard({...rankCard, display_name: e.target.value})} /></div>
                <div><Label>Server mẫu</Label><Input value={rankCard.server} onChange={e => setRankCard({...rankCard, server: e.target.value})} /></div>
                <div><Label>Nhãn Rank</Label><Input value={rankCard.rank_label} onChange={e => setRankCard({...rankCard, rank_label: e.target.value})} /></div>
                <div><Label>Nhãn Level</Label><Input value={rankCard.level_label} onChange={e => setRankCard({...rankCard, level_label: e.target.value})} /></div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end xl:justify-end">
                <Button className="w-full sm:w-auto" onClick={() => saveRankCard.mutate()} disabled={saveRankCard.isPending}>Lưu ảnh rank</Button>
                <Button className="w-full sm:w-auto" variant="secondary" onClick={() => renderServerPreview.mutate()} disabled={renderServerPreview.isPending}><Sparkles className="mr-2 h-4 w-4" />{renderServerPreview.isPending ? "Đang render..." : "Render ảnh bot"}</Button>
                <Button className="w-full sm:w-auto" variant="outline" onClick={() => rankCard && setRankCard({...rankCard, layout_config: defaultLayout()})}><Wand2 className="mr-2 h-4 w-4" />Reset</Button>
              </div>
            </div>}
            {rankCard && layout && <div className="grid gap-4 xl:min-h-[560px] xl:grid-cols-[240px_minmax(0,1fr)_300px]">
              <div className="rounded-2xl border bg-background/80 p-3 sm:rounded-3xl">
                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2"><Layers className="h-4 w-4" /><p className="text-sm font-semibold">Blocks</p></div>
                  <Badge variant="outline">{layout.layers.length}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => addLayer("text")}><Type className="mr-1 h-3 w-3" />Text</Button>
                  <Button size="sm" variant="secondary" onClick={() => addLayer("rect")}><Square className="mr-1 h-3 w-3" />Shape</Button>
                  <Button size="sm" variant="secondary" onClick={() => addLayer("avatar")}><CircleUserRound className="mr-1 h-3 w-3" />Avatar</Button>
                  <Button size="sm" variant="secondary" onClick={() => addLayer("progress")}><Zap className="mr-1 h-3 w-3" />Bar</Button>
                </div>
                <div className="mt-4 rounded-2xl border bg-muted/20 p-2">
                  <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Thêm block mẫu</p>
                  <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                    {LAYER_PRESETS.map((preset) => (
                      <button key={`${preset.type}-${preset.name}`} type="button" onClick={() => addPresetLayer(preset)} className="group flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-background">
                        <span className="min-w-0"><span className="block truncate text-xs font-medium">{preset.name}</span><span className="block truncate text-[11px] text-muted-foreground">{preset.desc}</span></span>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 max-h-56 space-y-1 overflow-y-auto pr-1 sm:max-h-72 xl:max-h-[280px]">
                  {[...layout.layers].sort((a, b) => b.z - a.z).map((layer) => (
                    <button key={layer.id} onClick={() => setSelectedLayerId(layer.id)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${selectedLayer?.id === layer.id ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"}`}>
                      <span className="truncate"><span className="mr-2 opacity-60">{layer.type}</span>{layer.name}</span>
                      <span className="flex items-center gap-2 text-xs opacity-60">{layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} z{layer.z}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-w-0 rounded-2xl border bg-background/80 p-3 sm:rounded-3xl sm:p-4">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                  <div><p className="flex items-center gap-2 text-base font-semibold"><MousePointer2 className="h-4 w-4" /> Canvas setup</p><p className="text-sm text-muted-foreground">Kéo layer trực tiếp trên canvas. Không cần nhìn qua khung preview nhỏ.</p></div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => { window.location.href = "/leveling/rank-card-editor"; }}><Maximize2 className="mr-2 h-4 w-4" />Mở trình chỉnh sửa fullscreen</Button>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[80px_80px_112px_48px_48px]">
                    <Input type="number" value={layout.width} onChange={e => updateLayout({width: Number(e.target.value)})} className="h-9 w-full sm:w-20" />
                    <Input type="number" value={layout.height} onChange={e => updateLayout({height: Number(e.target.value)})} className="h-9 w-full sm:w-20" />
                    <Select value={layout.background.style} onValueChange={v => updateLayout({background: {...layout.background, style: v}})}><SelectTrigger className="h-9 w-full sm:w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="solid">Solid</SelectItem><SelectItem value="gradient">Gradient</SelectItem></SelectContent></Select>
                    <Input type="color" value={layout.background.color} onChange={e => updateLayout({background: {...layout.background, color: e.target.value}})} className="h-9 w-full p-1 sm:w-12" />
                    <Input type="color" value={layout.background.accent} onChange={e => updateLayout({background: {...layout.background, accent: e.target.value}})} className="h-9 w-full p-1 sm:w-12" />
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="w-full overflow-x-auto pb-2">
                    {renderCanvas(Math.min(1, 760 / layout.width))}
                  </div>
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div><p className="text-sm font-semibold">Bot render</p><p className="text-xs text-muted-foreground">Ảnh PNG bot sẽ gửi thật.</p></div>
                      <Button type="button" size="sm" variant="secondary" onClick={() => renderServerPreview.mutate()} disabled={renderServerPreview.isPending}>{renderServerPreview.isPending ? "Đang render..." : "Render bot"}</Button>
                    </div>
                    <div className="overflow-hidden rounded-xl border bg-slate-950">
                      <img src={serverPreviewUrl || previewUrl} alt="Bot rank card preview" className="block w-full" />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">Canvas bên trái là editor HTML để kéo thả. Bot render này dùng cùng code Python với ảnh gửi Discord.</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Mẹo: kéo để đổi X/Y, chọn layer rồi chỉnh kích thước/màu ở Inspector. Bấm Lưu ảnh rank để bot dùng layout này.</p>
              </div>
              <div className="rounded-2xl border bg-background/80 p-3 sm:rounded-3xl sm:p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div><p className="text-base font-semibold">Inspector</p><p className="text-sm text-muted-foreground">{selectedLayer ? selectedLayer.name : "Chọn block để chỉnh"}</p></div>
                  {selectedLayer && <div className="flex gap-1"><Button type="button" size="icon" variant="outline" onClick={() => updateSelectedLayer({visible: !selectedLayer.visible})}>{selectedLayer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</Button><Button type="button" size="icon" variant="outline" onClick={duplicateSelectedLayer}><Copy className="h-4 w-4" /></Button><Button type="button" size="icon" variant="destructive" onClick={deleteSelectedLayer}><Trash2 className="h-4 w-4" /></Button></div>}
                </div>
                <div className="space-y-3">
                  {selectedLayer ? <>
                    <div><Label>Tên block</Label><Input value={selectedLayer.name} onChange={e => updateSelectedLayer({name: e.target.value})} /></div>
                    <div className="grid gap-2 sm:grid-cols-2"><div><Label>X</Label><Input type="number" value={selectedLayer.x} onChange={e => updateSelectedLayer({x: Number(e.target.value)})} /></div><div><Label>Y</Label><Input type="number" value={selectedLayer.y} onChange={e => updateSelectedLayer({y: Number(e.target.value)})} /></div><div><Label>W</Label><Input type="number" value={selectedLayer.w} onChange={e => updateSelectedLayer({w: Number(e.target.value)})} /></div><div><Label>H</Label><Input type="number" value={selectedLayer.h} onChange={e => updateSelectedLayer({h: Number(e.target.value)})} /></div><div><Label>Z</Label><Input type="number" value={selectedLayer.z} onChange={e => updateSelectedLayer({z: Number(e.target.value)})} /></div><div><Label>Opacity</Label><Input type="number" min={0} max={100} value={selectedLayer.opacity ?? 100} onChange={e => updateSelectedLayer({opacity: Number(e.target.value)})} /></div></div>
                    <div className="grid gap-2 sm:grid-cols-2"><div><Label>Radius</Label><Input type="number" value={selectedLayer.radius ?? 0} onChange={e => updateSelectedLayer({radius: Number(e.target.value)})} /></div><div><Label>Color</Label><Input type="color" value={selectedLayer.color || selectedLayer.fill || "#ffffff"} onChange={e => updateSelectedLayer(selectedLayer.type === "progress" ? {fill: e.target.value} : {color: e.target.value})} /></div></div>
                    {selectedLayer.type === "text" && <div className="grid gap-2 sm:grid-cols-2"><div><Label>Token</Label><Select value={selectedLayer.token || "display_name"} onValueChange={v => updateSelectedLayer({token: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["display_name","username","server","level","rank","xp","progress","percent"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div><div><Label>Font size</Label><Input type="number" value={selectedLayer.font_size || 24} onChange={e => updateSelectedLayer({font_size: Number(e.target.value)})} /></div><div className="flex items-center justify-between rounded-xl border px-3 py-2 sm:col-span-2"><Label>Bold</Label><Switch checked={Boolean(selectedLayer.bold)} onCheckedChange={v => updateSelectedLayer({bold: v})} /></div></div>}
                    <div className="flex items-center justify-between rounded-xl border px-3 py-2"><Label>Visible</Label><Switch checked={selectedLayer.visible} onCheckedChange={v => updateSelectedLayer({visible: v})} /></div>
                  </> : <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Chưa có block nào. Thêm block mẫu ở panel bên trái.</div>}
                </div>
              </div>
            </div>}
        </div>
            {layout && <Dialog open={canvasDialogOpen} onOpenChange={setCanvasDialogOpen}>
              <DialogContent className="fixed inset-0 left-0 top-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_1fr] overflow-hidden rounded-none border-0 p-0 sm:rounded-none">
                <DialogHeader className="border-b px-4 py-3 sm:px-6">
                  <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-center sm:justify-between">
                    <div><DialogTitle>Canvas Rank Card</DialogTitle><p className="text-sm text-muted-foreground">Kiểu Canva mobile: canvas fit màn hình, pinch/zoom bằng nút, kéo nền để pan, kéo layer để chỉnh.</p></div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setCanvasZoom((z) => Math.max(0.25, Number((z - 0.1).toFixed(2))))}><ZoomOut className="mr-1 h-4 w-4" />Thu</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setCanvasZoom(0.45)}><RotateCcw className="mr-1 h-4 w-4" />Fit</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setCanvasZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))))}><ZoomIn className="mr-1 h-4 w-4" />Phóng</Button>
                      <Badge variant="secondary" className="h-9 px-3 text-sm">{Math.round(canvasZoom * 100)}%</Badge>
                    </div>
                  </div>
                </DialogHeader>
                <div
                  ref={viewportRef}
                  className={`relative overflow-auto bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,.12),transparent_30%),#020617] p-3 touch-none ${panState ? "cursor-grabbing" : "cursor-grab"}`}
                  onPointerDown={startPan}
                  onPointerMove={movePan}
                  onPointerUp={endPan}
                  onPointerCancel={endPan}
                >
                  <div className="flex min-h-full min-w-max items-center justify-center p-4 sm:p-8 pointer-events-none">
                    <div className="pointer-events-auto">
                    {renderCanvas(canvasZoom, true)}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>}

      </TabsContent>

      <TabsContent value="config"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings className="w-4 h-4" /> Cấu hình XP</CardTitle><CardDescription>Điều chỉnh tốc độ và thông báo level-up.</CardDescription></CardHeader><CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-2xl border p-4"><div><p className="font-medium">Enable leveling</p><p className="text-sm text-muted-foreground">Tính XP từ tin nhắn.</p></div><Switch checked={form.enabled} onCheckedChange={v => setForm({...form, enabled: v})} /></div>
        <div className="grid md:grid-cols-3 gap-4"><div><Label>XP tối thiểu</Label><Input type="number" value={form.xp_min} onChange={e => setForm({...form, xp_min: Number(e.target.value)})} /></div><div><Label>XP tối đa</Label><Input type="number" value={form.xp_max} onChange={e => setForm({...form, xp_max: Number(e.target.value)})} /></div><div><Label>Cooldown giây</Label><Input type="number" value={form.cooldown_seconds} onChange={e => setForm({...form, cooldown_seconds: Number(e.target.value)})} /></div></div>
        <div className="grid md:grid-cols-2 gap-4"><div><Label>Chế độ level-up</Label><Select value={form.level_up_mode} onValueChange={v => setForm({...form, level_up_mode: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="current">Kênh hiện tại</SelectItem><SelectItem value="fixed">Kênh cố định</SelectItem><SelectItem value="dm">DM user</SelectItem><SelectItem value="off">Tắt thông báo</SelectItem></SelectContent></Select></div><div><Label>Kênh level-up</Label><ChannelSelect value={form.level_up_channel_id || ""} onChange={v => setForm({...form, level_up_channel_id: v})} filter="text" /></div></div>
        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><p className="flex items-center gap-2 font-medium"><MessageSquareText className="h-4 w-4" /> Nội dung thông báo level-up</p><p className="text-sm text-muted-foreground">Tiêu đề, mô tả, màu, text fallback và biến như {'{user.mention}'}, {'{level}'} nằm trong Embed Builder event Level Up.</p></div>
            <Button className="w-full md:w-auto" type="button" variant="secondary" onClick={() => { window.location.href = "/embeds?event=level_up"; }}>Mở Embed Builder</Button>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3"><div className="flex items-center justify-between rounded-2xl border p-3"><Label>XP từ slash commands</Label><Switch checked={form.gain_xp_from_commands} onCheckedChange={v => setForm({...form, gain_xp_from_commands: v})} /></div><div className="flex items-center justify-between rounded-2xl border p-3"><Label>Whitelist channel mode</Label><Switch checked={form.use_channel_whitelist} onCheckedChange={v => setForm({...form, use_channel_whitelist: v})} /></div><div className="flex items-center justify-between rounded-2xl border p-3"><Label>Xoá reward role cũ</Label><Switch checked={form.remove_old_reward_roles} onCheckedChange={v => setForm({...form, remove_old_reward_roles: v})} /></div></div>
        <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>Save config</Button>
      </CardContent></Card></TabsContent>

      <TabsContent value="filters" className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="h-4 w-4" /> Filters XP</CardTitle><CardDescription>Quản lý nơi/user không được nhận XP. Whitelist mode sẽ chỉ cho XP trong kênh được chọn.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><div><Label className="flex items-center gap-2"><Hash className="h-4 w-4" /> Ignored channels</Label><p className="text-sm text-muted-foreground">Tin nhắn trong các kênh này không nhận XP.</p></div><Badge variant="outline">{form.ignored_channels?.length || 0}</Badge></div>
              <MultiChannelSelect value={form.ignored_channels || []} onChange={v => setForm({...form, ignored_channels: v})} filter="text" placeholder="Thêm ignored channel..." />
            </div>
            <div className="rounded-2xl border p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><div><Label className="flex items-center gap-2"><Shield className="h-4 w-4" /> Ignored roles</Label><p className="text-sm text-muted-foreground">Member có một trong các role này sẽ không nhận XP.</p></div><Badge variant="outline">{form.ignored_roles?.length || 0}</Badge></div>
              <MultiRoleSelect value={form.ignored_roles || []} onChange={v => setForm({...form, ignored_roles: v})} placeholder="Thêm ignored role..." />
            </div>
            <div className="rounded-2xl border p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><div><Label className="flex items-center gap-2"><User className="h-4 w-4" /> Ignored users</Label><p className="text-sm text-muted-foreground">Dán Discord user ID để loại user khỏi hệ thống XP.</p></div><Badge variant="outline">{form.ignored_users?.length || 0}</Badge></div>
              <IdListEditor value={form.ignored_users || []} onChange={v => setForm({...form, ignored_users: v})} />
            </div>
            <div className="rounded-2xl border p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><div><Label>Whitelist channels</Label><p className="text-sm text-muted-foreground">Khi bật whitelist mode, chỉ các kênh này được nhận XP.</p></div><Switch checked={form.use_channel_whitelist} onCheckedChange={v => setForm({...form, use_channel_whitelist: v})} /></div>
              <MultiChannelSelect value={form.whitelist_channels || []} onChange={v => setForm({...form, whitelist_channels: v})} filter="text" placeholder="Thêm whitelist channel..." />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>Lưu filters</Button>
              <Button variant="outline" onClick={() => setForm({...form, ignored_channels: [], ignored_roles: [], ignored_users: [], whitelist_channels: []})}>Xóa tất cả filters</Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="leaderboard"><Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><ListOrdered className="w-4 h-4" /> Leaderboard</CardTitle><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="sm"><RotateCcw className="h-3.5 w-3.5 mr-1.5" />Reset BXH</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reset BXH Level?</AlertDialogTitle><AlertDialogDescription>BXH sẽ chỉ tính những member hoạt động sau thời điểm này. Dữ liệu XP vẫn được giữ nguyên.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => resetLeaderboard.mutate()}>Xác nhận reset</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>{leaderboard?.reset_at && <CardDescription>Reset lần cuối: {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(leaderboard.reset_at))}</CardDescription>}</CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>User</TableHead><TableHead>Level</TableHead><TableHead>XP</TableHead><TableHead>Tiến độ</TableHead><TableHead>Tin nhắn</TableHead></TableRow></TableHeader><TableBody>{leaderboard?.items?.map(i => <TableRow key={i.discord_id}><TableCell>#{i.rank}</TableCell><TableCell className="font-medium">{i.username || i.discord_id}</TableCell><TableCell>{i.level}</TableCell><TableCell>{i.xp.toLocaleString()}</TableCell><TableCell><Progress value={Math.min(100, ((i.xp || 0) % 10000) / 100)} className="h-2" /></TableCell><TableCell>{i.message_count}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></TabsContent>

      <TabsContent value="rewards"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Gift className="w-4 h-4" /> Role Rewards</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid md:grid-cols-[120px_1fr_120px] gap-3 items-end"><div><Label>Level</Label><Input type="number" value={reward.level} onChange={e => setReward({...reward, level: Number(e.target.value)})} /></div><div><Label>Role</Label><RoleSelect value={reward.role_id} onChange={v => setReward({...reward, role_id: v})} /></div><Button onClick={() => addReward.mutate()} disabled={!reward.role_id}>Add</Button></div><Table><TableHeader><TableRow><TableHead>Level</TableHead><TableHead>Role</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{rewards.map(r => <TableRow key={r.id}><TableCell>{r.level}</TableCell><TableCell>{r.role_name || r.role_id}</TableCell><TableCell className="text-right"><Button variant="destructive" size="sm" onClick={() => delReward.mutate(r.id)}>Delete</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card></TabsContent>

      <TabsContent value="multipliers"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Zap className="w-4 h-4" /> Multipliers</CardTitle><CardDescription>Global, channel hoặc role multiplier sẽ nhân XP nhận được.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid md:grid-cols-5 gap-3 items-end"><div><Label>Loại</Label><Select value={multi.type} onValueChange={v => setMulti({...multi, type: v, target_id: ""})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="global">Global</SelectItem><SelectItem value="channel">Channel</SelectItem><SelectItem value="role">Role</SelectItem></SelectContent></Select></div><div className="md:col-span-2"><Label>Target</Label>{multi.type === "channel" ? <ChannelSelect value={multi.target_id} onChange={v => setMulti({...multi, target_id: v})} filter="text" /> : multi.type === "role" ? <RoleSelect value={multi.target_id} onChange={v => setMulti({...multi, target_id: v})} /> : <Input disabled value="Toàn server" />}</div><div><Label>Multiplier</Label><Input type="number" step="0.1" value={multi.multiplier} onChange={e => setMulti({...multi, multiplier: Number(e.target.value)})} /></div><Button onClick={() => addMulti.mutate()}>Add</Button></div><Table><TableHeader><TableRow><TableHead>Loại</TableHead><TableHead>Target</TableHead><TableHead>Multiplier</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{multipliers.map(m => <TableRow key={m.id}><TableCell>{m.type}</TableCell><TableCell>{m.target_name || m.target_id || "Global"}</TableCell><TableCell>x{m.multiplier}</TableCell><TableCell className="text-right"><Button variant="destructive" size="sm" onClick={() => delMulti.mutate(m.id)}>Delete</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card></TabsContent>
    </Tabs>
  </div>;
}

export function RankCardEditor() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rankCard, setRankCard] = useState<RankCardConfig | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState("display");
  const [zoom, setZoom] = useState(0.48);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [panState, setPanState] = useState<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const [dragState, setDragState] = useState<{ id: string; pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number; scale: number } | null>(null);

  const { data: rankCardConfig } = useQuery<RankCardConfig>({ queryKey: ["leveling_rank_card_config"], queryFn: () => apiFetch("/api/leveling/rank-card/config").then(r => r.json()) });
  useEffect(() => { if (rankCardConfig) setRankCard({ ...rankCardConfig, layout_config: rankCardConfig.layout_config?.layers?.length ? rankCardConfig.layout_config : defaultLayout() }); }, [rankCardConfig]);

  const layout = rankCard?.layout_config;
  const selectedLayer = layout?.layers.find((layer) => layer.id === selectedLayerId) || layout?.layers[0];
  const updateLayer = (id: string, patch: Partial<RankCardLayer>) => {
    if (!rankCard) return;
    setRankCard({ ...rankCard, layout_config: { ...rankCard.layout_config, layers: rankCard.layout_config.layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer) } });
  };
  const updateSelectedLayer = (patch: Partial<RankCardLayer>) => { if (selectedLayer) updateLayer(selectedLayer.id, patch); };
  const addLayer = (type: RankLayerType) => {
    if (!rankCard) return;
    const layer: RankCardLayer = { id: `${type}-${Date.now()}`, type, name: type === "text" ? "Text layer" : type === "rect" ? "Shape" : type === "avatar" ? "Avatar" : "Progress", x: 120, y: 80, w: type === "text" ? 260 : 180, h: type === "text" ? 42 : 70, z: rankCard.layout_config.layers.length + 1, visible: true, color: "#FFFFFF", opacity: 100, radius: type === "avatar" ? 90 : 18, token: type === "text" ? "display_name" : undefined, font_size: 28, bold: type === "text", track: "#FFFFFF", fill: rankCard.accent };
    setRankCard({ ...rankCard, layout_config: { ...rankCard.layout_config, layers: [...rankCard.layout_config.layers, layer] } });
    setSelectedLayerId(layer.id);
  };
  const saveRankCard = useMutation({
    mutationFn: () => apiFetch("/api/leveling/rank-card/config", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(rankCard) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: (data) => { setRankCard(data); qc.invalidateQueries({ queryKey: ["leveling_rank_card_config"] }); toast({ title: "Saved", description: "Ảnh rank card đã được cập nhật." }); },
    onError: () => toast({ variant: "destructive", title: "Error", description: "Lưu rank card thất bại." }),
  });

  const startDragLayer = (event: PointerEvent<HTMLDivElement>, layer: RankCardLayer) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setSelectedLayerId(layer.id); setDragState({ id: layer.id, pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startX: layer.x, startY: layer.y, scale: 1 / zoom }); };
  const moveDragLayer = (event: PointerEvent<HTMLDivElement>) => { if (!dragState || dragState.pointerId !== event.pointerId) return; updateLayer(dragState.id, { x: Math.round(dragState.startX + (event.clientX - dragState.startClientX) * dragState.scale), y: Math.round(dragState.startY + (event.clientY - dragState.startClientY) * dragState.scale) }); };
  const endDragLayer = (event: PointerEvent<HTMLDivElement>) => { if (!dragState || dragState.pointerId !== event.pointerId) return; setDragState(null); };
  const startPan = (event: PointerEvent<HTMLDivElement>) => { if (!viewportRef.current || event.target !== event.currentTarget) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setPanState({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: viewportRef.current.scrollLeft, top: viewportRef.current.scrollTop }); };
  const movePan = (event: PointerEvent<HTMLDivElement>) => { if (!panState || panState.pointerId !== event.pointerId || !viewportRef.current) return; viewportRef.current.scrollLeft = panState.left - (event.clientX - panState.x); viewportRef.current.scrollTop = panState.top - (event.clientY - panState.y); };
  const endPan = (event: PointerEvent<HTMLDivElement>) => { if (!panState || panState.pointerId !== event.pointerId) return; setPanState(null); };

  if (!rankCard || !layout) return <div className="flex h-screen items-center justify-center">Đang tải editor...</div>;

  return <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-950 text-white">
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-slate-950/95 px-3 py-2 backdrop-blur sm:px-4">
      <div className="flex min-w-0 items-center gap-2"><Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white"><Link to="/leveling/rank-card"><ArrowLeft className="h-4 w-4" /></Link></Button><div className="min-w-0"><p className="truncate text-sm font-semibold">Rank Card Studio</p><p className="text-[11px] text-white/50">Canva-style fullscreen editor</p></div></div>
      <div className="flex items-center gap-1"><Button size="sm" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.1).toFixed(2))))}><ZoomOut className="h-4 w-4" /></Button><Button size="sm" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => setZoom(0.48)}>Fit</Button><Button size="sm" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))))}><ZoomIn className="h-4 w-4" /></Button><Button size="sm" onClick={() => saveRankCard.mutate()} disabled={saveRankCard.isPending}><Save className="mr-1 h-4 w-4" />Save</Button></div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="order-2 max-h-[28dvh] shrink-0 overflow-y-auto border-t border-white/10 bg-slate-900/95 p-3 md:order-1 md:max-h-none md:w-64 md:border-r md:border-t-0">
        <div className="mb-3 grid grid-cols-4 gap-2 md:grid-cols-2"><Button size="sm" variant="secondary" onClick={() => addLayer("text")}><Type className="h-3 w-3" /></Button><Button size="sm" variant="secondary" onClick={() => addLayer("rect")}><Square className="h-3 w-3" /></Button><Button size="sm" variant="secondary" onClick={() => addLayer("avatar")}><CircleUserRound className="h-3 w-3" /></Button><Button size="sm" variant="secondary" onClick={() => addLayer("progress")}><Zap className="h-3 w-3" /></Button></div>
        <div className="flex gap-2 overflow-x-auto md:block md:space-y-1">{[...layout.layers].sort((a,b)=>b.z-a.z).map(layer => <button key={layer.id} onClick={() => setSelectedLayerId(layer.id)} className={`min-w-40 rounded-xl px-3 py-2 text-left text-xs md:w-full ${selectedLayer?.id === layer.id ? "bg-blue-500 text-white" : "bg-white/5 text-white/75"}`}><span className="block truncate font-medium">{layer.name}</span><span className="text-white/45">{layer.type} · z{layer.z}</span></button>)}</div>
      </aside>
      <main ref={viewportRef} className={`order-1 min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,.18),transparent_35%),#020617] touch-none ${panState ? "cursor-grabbing" : "cursor-grab"}`} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}>
        <div className="flex min-h-full min-w-max items-center justify-center p-8 pointer-events-none"><div className="pointer-events-auto"><div className="relative touch-none overflow-hidden rounded-[28px] bg-slate-950 shadow-2xl ring-1 ring-white/10" style={{ width: layout.width * zoom, height: layout.height * zoom, minWidth: layout.width * zoom, background: layout.background.style === "gradient" ? `radial-gradient(circle at 18% 10%, ${layout.background.accent}55, transparent 30%), linear-gradient(135deg, ${layout.background.color}, #020617)` : layout.background.color }} onPointerMove={moveDragLayer} onPointerUp={endDragLayer} onPointerCancel={endDragLayer}><div className="absolute left-0 top-0 origin-top-left" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>{[...layout.layers].sort((a,b)=>a.z-b.z).map(layer => <CanvasLayerPreview key={layer.id} layer={layer} layout={layout} selected={selectedLayer?.id === layer.id} onPointerDown={(e) => startDragLayer(e, layer)} />)}</div></div></div></div>
      </main>
      <aside className="order-3 max-h-[32dvh] shrink-0 overflow-y-auto border-t border-white/10 bg-slate-900/95 p-3 md:max-h-none md:w-72 md:border-l md:border-t-0">
        {selectedLayer && <div className="space-y-3 text-white"><div><Label>Tên layer</Label><Input value={selectedLayer.name} onChange={e => updateSelectedLayer({name: e.target.value})} className="bg-white/10 text-white" /></div><div className="grid grid-cols-3 gap-2"><Input type="number" value={selectedLayer.x} onChange={e => updateSelectedLayer({x:Number(e.target.value)})} className="bg-white/10 text-white" /><Input type="number" value={selectedLayer.y} onChange={e => updateSelectedLayer({y:Number(e.target.value)})} className="bg-white/10 text-white" /><Input type="number" value={selectedLayer.z} onChange={e => updateSelectedLayer({z:Number(e.target.value)})} className="bg-white/10 text-white" /><Input type="number" value={selectedLayer.w} onChange={e => updateSelectedLayer({w:Number(e.target.value)})} className="bg-white/10 text-white" /><Input type="number" value={selectedLayer.h} onChange={e => updateSelectedLayer({h:Number(e.target.value)})} className="bg-white/10 text-white" /><Input type="color" value={selectedLayer.color || selectedLayer.fill || "#ffffff"} onChange={e => updateSelectedLayer(selectedLayer.type === "progress" ? {fill:e.target.value} : {color:e.target.value})} className="bg-white/10" /></div><div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"><Label>Visible</Label><Switch checked={selectedLayer.visible} onCheckedChange={v => updateSelectedLayer({visible:v})} /></div></div>}
      </aside>
    </div>
  </div>;
}
