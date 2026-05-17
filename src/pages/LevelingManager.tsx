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
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ChannelSelect, MultiChannelSelect } from "@/components/ChannelSelect";
import { MultiRoleSelect, RoleSelect } from "@/components/RoleSelect";
import { Filter, Gift, Hash, ImagePlus, ListOrdered, Settings, Shield, Sparkles, User, X, Zap, Layers, MousePointer2, Type, Square, CircleUserRound, Wand2, MessageSquareText, Maximize2, ZoomIn, ZoomOut, RotateCcw, ArrowLeft, Save, Copy, Trash2, Eye, EyeOff, Plus, RefreshCw, Upload, Mic, Star, Calendar, BarChart3, MessageCircle } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { useT } from "@/i18n";

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
  // Voice XP
  voice_xp_enabled: boolean;
  voice_xp_per_minute: number;
  voice_afk_timeout: number;
  voice_solo_xp: boolean;
  voice_stream_bonus: number;
  voice_camera_bonus: number;
  voice_ignored_channels: string[];
  // Weekly
  weekly_reset_day: number;
}
interface LeaderboardItem { rank: number; discord_id: string; username?: string; xp: number; level: number; message_count: number; voice_xp: number; voice_minutes: number; weekly_xp: number; rep_score: number }
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
  { type: "text", name: "Display name", desc: "Large display name", layer: { type: "text", name: "Display name", x: 278, y: 72, w: 455, h: 54, visible: true, token: "display_name", color: "#FFFFFF", font_size: 44, bold: true, opacity: 100 } },
  { type: "text", name: "Username", desc: "Small username", layer: { type: "text", name: "Username", x: 278, y: 124, w: 420, h: 28, visible: true, token: "username", color: "#BAC3DA", font_size: 22, opacity: 96 } },
  { type: "text", name: "Server", desc: "Name server", layer: { type: "text", name: "Server", x: 278, y: 160, w: 420, h: 24, visible: true, token: "server", color: "#8490AA", font_size: 17, opacity: 90 } },
  { type: "avatar", name: "Avatar", desc: "Avatar user", layer: { type: "avatar", name: "Avatar", x: 62, y: 70, w: 178, h: 178, visible: true, radius: 90, shape: "circle", stroke: "#FFFFFF", stroke_width: 4 } },
  { type: "progress", name: "Progress bar", desc: "XP progress bar", layer: { type: "progress", name: "Progress bar", x: 278, y: 232, w: 626, h: 34, visible: true, radius: 17, track: "#FFFFFF", fill: "#7C8CFF", opacity: 100 } },
  { type: "rect", name: "Glass panel", desc: "Glass background", layer: { type: "rect", name: "Glass panel", x: 28, y: 28, w: 924, h: 264, visible: true, color: "#FFFFFF", radius: 34, opacity: 14, stroke: "#FFFFFF", stroke_width: 1 } },
  { type: "rect", name: "Stat capsule", desc: "Ô rank/level", layer: { type: "rect", name: "Stat capsule", x: 650, y: 96, w: 138, h: 70, visible: true, color: "#FFFFFF", radius: 22, opacity: 10, stroke: "#FFFFFF", stroke_width: 1 } },
  { type: "text", name: "Rank text", desc: "Text #rank", layer: { type: "text", name: "Rank text", x: 668, y: 126, w: 96, h: 38, visible: true, token: "rank", color: "#FFFFFF", font_size: 34, bold: true, opacity: 100 } },
  { type: "text", name: "Level text", desc: "Text level", layer: { type: "text", name: "Level text", x: 824, y: 126, w: 96, h: 38, visible: true, token: "level", color: "#FFFFFF", font_size: 34, bold: true, opacity: 100 } },
  { type: "text", name: "XP text", desc: "Text XP/progress", layer: { type: "text", name: "XP text", x: 278, y: 202, w: 320, h: 24, visible: true, token: "progress", color: "#E2E7F4", font_size: 17, opacity: 96 } },
];



function IdListEditor({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const { t } = useT();
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
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Discord ID" />
        <Button type="button" variant="secondary" onClick={add}>{t("lv_addReward")}</Button>
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
  const { t } = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<LevelingConfig | null>(null);
  const [reward, setReward] = useState({ level: 1, role_id: "", role_name: "", dm_user: false });

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
    onError: () => toast({ variant: "destructive", title: t("error"), description: t("toast_renderFailed") }),
  });

  const saveRankCard = useMutation({
    mutationFn: () => apiFetch("/api/leveling/rank-card/config", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(rankCard) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: (data) => { setRankCard(data); setPreviewVersion((v) => v + 1); qc.invalidateQueries({ queryKey: ["leveling_rank_card_config"] }); toast({ title: t("toast_saved"), description: t("toast_rankCardSaved") }); },
    onError: () => toast({ variant: "destructive", title: t("error"), description: t("toast_rankCardFailed") }),
  });

  const saveConfig = useMutation({
    mutationFn: () => apiFetch("/api/leveling/config", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(form) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leveling_config"] }); toast({ title: t("toast_saved"), description: t("toast_levelingSaved") }); },
    onError: () => toast({ variant: "destructive", title: t("error"), description: t("toast_configFailed") }),
  });
  const addReward = useMutation({
    mutationFn: () => apiFetch("/api/leveling/rewards", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(reward) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leveling_rewards"] }); setReward({ level: 1, role_id: "", role_name: "", dm_user: false }); },
  });
  const delReward = useMutation({ mutationFn: (id: number) => apiFetch(`/api/leveling/rewards/${id}`, { method: "DELETE", credentials: "include" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["leveling_rewards"] }) });
  const addMulti = useMutation({
    mutationFn: () => apiFetch("/api/leveling/multipliers", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(multi) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leveling_multipliers"] }); setMulti({ type: "global", target_id: "", target_name: "", multiplier: 1, priority: 0, enabled: true }); },
  });
  const delMulti = useMutation({ mutationFn: (id: number) => apiFetch(`/api/leveling/multipliers/${id}`, { method: "DELETE", credentials: "include" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["leveling_multipliers"] }) });
  const resetLeaderboard = useMutation({
    mutationFn: () => apiFetch("/api/leveling/leaderboard/reset", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leveling_leaderboard"] }); toast({ title: t("toast_saved"), description: t("toast_levelReset") }); },
    onError: () => toast({ variant: "destructive", title: t("error"), description: t("toast_resetFailed") }),
  });

  if (!form) return <div>{t("loading")}</div>;

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
      {!section && <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:flex sm:flex-wrap sm:justify-start"><TabsTrigger value="rank-card" className="text-xs sm:text-sm">{t("lv_rankCard")}</TabsTrigger><TabsTrigger value="config" className="text-xs sm:text-sm">{t("lv_xpConfig")}</TabsTrigger><TabsTrigger value="voice-xp" className="text-xs sm:text-sm"><Mic className="mr-1 h-3.5 w-3.5" />{t("lv_voiceXp")}</TabsTrigger><TabsTrigger value="filters" className="text-xs sm:text-sm">{t("lv_filters")}</TabsTrigger><TabsTrigger value="leaderboard" className="text-xs sm:text-sm">{t("lv_leaderboard")}</TabsTrigger><TabsTrigger value="rewards" className="text-xs sm:text-sm">{t("lv_rewards")}</TabsTrigger><TabsTrigger value="multipliers" className="text-xs sm:text-sm">{t("lv_multipliers")}</TabsTrigger><TabsTrigger value="analytics" className="text-xs sm:text-sm"><BarChart3 className="mr-1 h-3.5 w-3.5" />{t("lv_analytics")}</TabsTrigger></TabsList>}

      <TabsContent value="rank-card" className="space-y-4">
        {rankCard && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-500" /> {t("lv_rankCard")}</CardTitle>
                  <CardDescription>{t("lv_canvasDesc")}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => saveRankCard.mutate()} disabled={saveRankCard.isPending}><Save className="mr-1.5 h-4 w-4" />{saveRankCard.isPending ? t("saving") : t("save")}</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setRankCard({ ...rankCard, layout_config: defaultLayout() }); }}><RotateCcw className="mr-1.5 h-4 w-4" />{t("reset")}</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
                {/* LEFT: controls */}
                <div className="space-y-5">
                  {/* Colors */}
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Wand2 className="h-4 w-4 text-violet-500" /> {t("lv_colors")}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex items-center gap-3">
                        <input type="color" value={rankCard.accent} onChange={e => setRankCard({ ...rankCard, accent: e.target.value })} className="h-10 w-12 cursor-pointer rounded-lg border bg-transparent p-0.5" />
                        <div><Label className="text-xs">{t("lv_accentColor")}</Label><p className="font-mono text-xs text-muted-foreground">{rankCard.accent}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="color" value={rankCard.secondary_accent} onChange={e => setRankCard({ ...rankCard, secondary_accent: e.target.value })} className="h-10 w-12 cursor-pointer rounded-lg border bg-transparent p-0.5" />
                        <div><Label className="text-xs">{t("lv_secondaryColor")}</Label><p className="font-mono text-xs text-muted-foreground">{rankCard.secondary_accent}</p></div>
                      </div>
                    </div>
                  </div>

                  {/* Background Gallery */}
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><ImagePlus className="h-4 w-4 text-sky-500" /> {t("lv_uploadBg")}</p>
                    <div className="space-y-3">
                      {/* Upload button */}
                      <button type="button" onClick={() => bgInputRef.current?.click()} disabled={bgUploading}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 py-4 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground disabled:opacity-60">
                        {bgUploading ? <><RefreshCw className="h-4 w-4 animate-spin" />{t("loading")}...</> : <><Upload className="h-4 w-4" />{t("lv_uploadBg")} (PNG/JPG, max 10MB)</>}
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
                          toast({ variant: "destructive", title: t("toast_uploadFailed"), description: err instanceof Error ? err.message : t("toast_uploadFailed") });
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
                            <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">{t("lv_none")}</span>
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
                                <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">{t("enabled")}</span>
                              )}
                              <button type="button" onClick={async () => {
                                await apiFetch(`/api/leveling/rank-card/background/${bg.slug}`, { method: "DELETE", credentials: "include" });
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

                  {/* Toggles display */}
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="mb-3 text-sm font-semibold">{t("lv_showProgressBar")}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {([
                        ["show_rank", t("rank")],
                        ["show_level", t("level")],
                        ["show_progress_bar", t("lv_showProgressBar")],
                        ["show_percent", t("lv_showPercent")],
                        ["show_total_xp", t("lv_showTotalXp")],
                        ["show_username", t("member")],
                        ["show_server", t("lv_showServer")],
                        ["show_avatar_ring", t("lv_showAvatarRing")],
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
                    <p className="mb-3 text-sm font-semibold">{t("lv_rankCard")}</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div><Label className="text-xs">{t("rank")}</Label><Input value={rankCard.rank_label} onChange={e => setRankCard({ ...rankCard, rank_label: e.target.value })} placeholder={t("rank")} /></div>
                      <div><Label className="text-xs">{t("level")}</Label><Input value={rankCard.level_label} onChange={e => setRankCard({ ...rankCard, level_label: e.target.value })} placeholder={t("level")} /></div>
                      <div><Label className="text-xs">XP</Label><Input value={rankCard.xp_label} onChange={e => setRankCard({ ...rankCard, xp_label: e.target.value })} placeholder="XP" /></div>
                    </div>
                  </div>

                  {/* Avatar size slider */}
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="mb-3 text-sm font-semibold">{t("lv_sizeAvatar")}</p>
                    <div className="flex items-center gap-4">
                      <Slider min={60} max={130} step={2} value={[rankCard.avatar_size]} onValueChange={([v]) => setRankCard({ ...rankCard, avatar_size: v })} className="flex-1" />
                      <span className="w-10 text-right text-sm font-mono">{rankCard.avatar_size}px</span>
                    </div>
                  </div>

                  {/* Gradient Theme */}
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="mb-3 text-sm font-semibold">{t("lv_gradientTheme")}</p>
                    <p className="mb-2 text-xs text-muted-foreground">{t("lv_gradientDesc")}</p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {[
                        { key: "", label: t("lv_none"), colors: ["#3A3A45", "#24242B"] },
                        { key: "sunset", label: t("lv_sunset"), colors: ["#FF5E4D", "#FF9A00"] },
                        { key: "ocean", label: t("lv_ocean"), colors: ["#0096C7", "#00458E"] },
                        { key: "forest", label: t("lv_forest"), colors: ["#228B22", "#006400"] },
                        { key: "neon", label: t("lv_neon"), colors: ["#FF00FF", "#00FFFF"] },
                        { key: "pastel", label: t("lv_pastel"), colors: ["#FFB3BA", "#BAE1FF"] },
                        { key: "midnight", label: t("lv_midnight"), colors: ["#191970", "#483D8B"] },
                        { key: "aurora", label: t("lv_aurora"), colors: ["#00D2BE", "#5F2CFF"] },
                        { key: "fire", label: t("lv_fire"), colors: ["#FF4500", "#FFA500"] },
                      ].map(th => (
                        <button key={th.key} type="button" onClick={() => setRankCard({ ...rankCard, gradient_theme: th.key })}
                          className={`relative overflow-hidden rounded-xl border-2 p-2 text-center text-[10px] font-medium transition ${(rankCard as any).gradient_theme === th.key ? "border-primary ring-2 ring-primary/40" : "border-transparent hover:border-muted-foreground/40"}`}
                          style={{ background: `linear-gradient(135deg, ${th.colors[0]}, ${th.colors[1]})` }}>
                          <span className="relative text-white drop-shadow">{th.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Avatar Effect & Frame */}
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="mb-3 text-sm font-semibold">{t("lv_avatarStyle")}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">{t("lv_avatarEffect")}</Label>
                        <Select value={(rankCard as any).avatar_effect || "glow"} onValueChange={v => setRankCard({ ...rankCard, avatar_effect: v } as any)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="glow">{t("lv_glow")}</SelectItem>
                            <SelectItem value="shadow">{t("lv_shadow")}</SelectItem>
                            <SelectItem value="ring_pulse">{t("lv_ringPulse")}</SelectItem>
                            <SelectItem value="none">{t("lv_none")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">{t("lv_avatarFrame")}</Label>
                        <Select value={(rankCard as any).frame || "none"} onValueChange={v => setRankCard({ ...rankCard, frame: v } as any)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("lv_none")}</SelectItem>
                            <SelectItem value="gold">{t("lv_gold")}</SelectItem>
                            <SelectItem value="diamond">{t("lv_diamond")}</SelectItem>
                            <SelectItem value="fire">{t("lv_fire")}</SelectItem>
                            <SelectItem value="rainbow">{t("lv_rainbow")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: live preview */}
                <div className="flex flex-col gap-3">
                  <div className="sticky top-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{t("preview")} (Bot)</p>
                      <div className="flex items-center gap-2">
                        {isAutoSyncing && <span className="flex items-center gap-1 text-xs text-muted-foreground"><RefreshCw className="h-3 w-3 animate-spin" />{t("lv_rendering")}...</span>}
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
                    <p className="mt-2 text-xs text-muted-foreground">{t("lv_canvasDesc")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="hidden">
            {rankCard && <div className="grid gap-3 rounded-2xl border bg-background/70 p-3 sm:rounded-3xl sm:p-4 xl:grid-cols-[1fr_1fr_auto]">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div><Label>{t("lv_accentColor")}</Label><Input type="color" value={rankCard.accent} onChange={e => setRankCard({...rankCard, accent: e.target.value})} className="h-10" /></div>
                <div><Label>{t("lv_secondaryColor")}</Label><Input type="color" value={rankCard.secondary_accent} onChange={e => setRankCard({...rankCard, secondary_accent: e.target.value})} className="h-10" /></div>
                <div><Label>{t("lv_uploadBg")}</Label><Select value={rankCard.background} onValueChange={v => setRankCard({...rankCard, background: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aurora">{t("lv_aurora")}</SelectItem><SelectItem value="midnight">{t("lv_midnight")}</SelectItem><SelectItem value="sunset">{t("lv_sunset")}</SelectItem><SelectItem value="mono">Mono</SelectItem></SelectContent></Select></div>
                <div><Label>{t("lv_canvasEditor")}</Label><Select value={rankCard.panel_style} onValueChange={v => setRankCard({...rankCard, panel_style: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="glass">Glass</SelectItem><SelectItem value="solid">Solid</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div><Label>{t("lv_showProgressBar")}</Label><Input value={rankCard.display_name} onChange={e => setRankCard({...rankCard, display_name: e.target.value})} /></div>
                <div><Label>{t("lv_showServer")}</Label><Input value={rankCard.server} onChange={e => setRankCard({...rankCard, server: e.target.value})} /></div>
                <div><Label>{t("rank")}</Label><Input value={rankCard.rank_label} onChange={e => setRankCard({...rankCard, rank_label: e.target.value})} /></div>
                <div><Label>{t("level")}</Label><Input value={rankCard.level_label} onChange={e => setRankCard({...rankCard, level_label: e.target.value})} /></div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end xl:justify-end">
                <Button className="w-full sm:w-auto" onClick={() => saveRankCard.mutate()} disabled={saveRankCard.isPending}>{t("save")}</Button>
                <Button className="w-full sm:w-auto" variant="secondary" onClick={() => renderServerPreview.mutate()} disabled={renderServerPreview.isPending}><Sparkles className="mr-2 h-4 w-4" />{renderServerPreview.isPending ? t("lv_rendering") : t("lv_renderBot")}</Button>
                <Button className="w-full sm:w-auto" variant="outline" onClick={() => rankCard && setRankCard({...rankCard, layout_config: defaultLayout()})}><Wand2 className="mr-2 h-4 w-4" />{t("reset")}</Button>
              </div>
            </div>}
            {rankCard && layout && <div className="grid gap-4 xl:min-h-[560px] xl:grid-cols-[240px_minmax(0,1fr)_300px]">
              <div className="rounded-2xl border bg-background/80 p-3 sm:rounded-3xl">
                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2"><Layers className="h-4 w-4" /><p className="text-sm font-semibold">{t("lv_canvasEditor")}</p></div>
                  <Badge variant="outline">{layout.layers.length}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => addLayer("text")}><Type className="mr-1 h-3 w-3" />Text</Button>
                  <Button size="sm" variant="secondary" onClick={() => addLayer("rect")}><Square className="mr-1 h-3 w-3" />Shape</Button>
                  <Button size="sm" variant="secondary" onClick={() => addLayer("avatar")}><CircleUserRound className="mr-1 h-3 w-3" />Avatar</Button>
                  <Button size="sm" variant="secondary" onClick={() => addLayer("progress")}><Zap className="mr-1 h-3 w-3" />Bar</Button>
                </div>
                <div className="mt-4 rounded-2xl border bg-muted/20 p-2">
                  <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">{t("lv_canvasEditor")}</p>
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
                  <div><p className="flex items-center gap-2 text-base font-semibold"><MousePointer2 className="h-4 w-4" /> {t("lv_canvasEditor")}</p><p className="text-sm text-muted-foreground">{t("lv_canvasDesc")}</p></div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => { window.location.href = "/leveling/rank-card-editor"; }}><Maximize2 className="mr-2 h-4 w-4" />{t("lv_canvasEditor")}</Button>
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
                      <div><p className="text-sm font-semibold">{t("lv_renderBot")}</p><p className="text-xs text-muted-foreground">{t("lv_canvasDesc")}</p></div>
                      <Button type="button" size="sm" variant="secondary" onClick={() => renderServerPreview.mutate()} disabled={renderServerPreview.isPending}>{renderServerPreview.isPending ? t("lv_rendering") : t("lv_renderBot")}</Button>
                    </div>
                    <div className="overflow-hidden rounded-xl border bg-slate-950">
                      <img src={serverPreviewUrl || previewUrl} alt="Bot rank card preview" className="block w-full" />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">{t("lv_canvasDesc")}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{t("lv_canvasDesc")}</p>
              </div>
              <div className="rounded-2xl border bg-background/80 p-3 sm:rounded-3xl sm:p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div><p className="text-base font-semibold">{t("lv_canvasEditor")}</p><p className="text-sm text-muted-foreground">{selectedLayer ? selectedLayer.name : t("lv_canvasDesc")}</p></div>
                  {selectedLayer && <div className="flex gap-1"><Button type="button" size="icon" variant="outline" onClick={() => updateSelectedLayer({visible: !selectedLayer.visible})}>{selectedLayer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</Button><Button type="button" size="icon" variant="outline" onClick={duplicateSelectedLayer}><Copy className="h-4 w-4" /></Button><Button type="button" size="icon" variant="destructive" onClick={deleteSelectedLayer}><Trash2 className="h-4 w-4" /></Button></div>}
                </div>
                <div className="space-y-3">
                  {selectedLayer ? <>
                    <div><Label>{t("name")}</Label><Input value={selectedLayer.name} onChange={e => updateSelectedLayer({name: e.target.value})} /></div>
                    <div className="grid gap-2 sm:grid-cols-2"><div><Label>X</Label><Input type="number" value={selectedLayer.x} onChange={e => updateSelectedLayer({x: Number(e.target.value)})} /></div><div><Label>Y</Label><Input type="number" value={selectedLayer.y} onChange={e => updateSelectedLayer({y: Number(e.target.value)})} /></div><div><Label>W</Label><Input type="number" value={selectedLayer.w} onChange={e => updateSelectedLayer({w: Number(e.target.value)})} /></div><div><Label>H</Label><Input type="number" value={selectedLayer.h} onChange={e => updateSelectedLayer({h: Number(e.target.value)})} /></div><div><Label>Z</Label><Input type="number" value={selectedLayer.z} onChange={e => updateSelectedLayer({z: Number(e.target.value)})} /></div><div><Label>Opacity</Label><Input type="number" min={0} max={100} value={selectedLayer.opacity ?? 100} onChange={e => updateSelectedLayer({opacity: Number(e.target.value)})} /></div></div>
                    <div className="grid gap-2 sm:grid-cols-2"><div><Label>Radius</Label><Input type="number" value={selectedLayer.radius ?? 0} onChange={e => updateSelectedLayer({radius: Number(e.target.value)})} /></div><div><Label>Color</Label><Input type="color" value={selectedLayer.color || selectedLayer.fill || "#ffffff"} onChange={e => updateSelectedLayer(selectedLayer.type === "progress" ? {fill: e.target.value} : {color: e.target.value})} /></div></div>
                    {selectedLayer.type === "text" && <div className="grid gap-2 sm:grid-cols-2"><div><Label>Token</Label><Select value={selectedLayer.token || "display_name"} onValueChange={v => updateSelectedLayer({token: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["display_name","username","server","level","rank","xp","progress","percent"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div><div><Label>Font size</Label><Input type="number" value={selectedLayer.font_size || 24} onChange={e => updateSelectedLayer({font_size: Number(e.target.value)})} /></div><div className="flex items-center justify-between rounded-xl border px-3 py-2 sm:col-span-2"><Label>Bold</Label><Switch checked={Boolean(selectedLayer.bold)} onCheckedChange={v => updateSelectedLayer({bold: v})} /></div></div>}
                    <div className="flex items-center justify-between rounded-xl border px-3 py-2"><Label>{t("lv_showProgressBar")}</Label><Switch checked={selectedLayer.visible} onCheckedChange={v => updateSelectedLayer({visible: v})} /></div>
                  </> : <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">{t("noData")}</div>}
                </div>
              </div>
            </div>}
        </div>
            {layout && <Dialog open={canvasDialogOpen} onOpenChange={setCanvasDialogOpen}>
              <DialogContent className="fixed inset-0 left-0 top-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_1fr] overflow-hidden rounded-none border-0 p-0 sm:rounded-none">
                <DialogHeader className="border-b px-4 py-3 sm:px-6">
                  <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-center sm:justify-between">
                    <div><DialogTitle>{t("lv_canvasEditor")}</DialogTitle><p className="text-sm text-muted-foreground">{t("lv_canvasDesc")}</p></div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setCanvasZoom((z) => Math.max(0.25, Number((z - 0.1).toFixed(2))))}><ZoomOut className="mr-1 h-4 w-4" />{t("lv_canvasEditor")}</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setCanvasZoom(0.45)}><RotateCcw className="mr-1 h-4 w-4" />{t("reset")}</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setCanvasZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))))}><ZoomIn className="mr-1 h-4 w-4" />{t("lv_canvasEditor")}</Button>
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

      <TabsContent value="config"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings className="w-4 h-4" /> {t("lv_xpConfig")}</CardTitle><CardDescription>{t("lv_adjustXpDesc")}</CardDescription></CardHeader><CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-2xl border p-4"><div><p className="font-medium">{t("enabled")}</p><p className="text-sm text-muted-foreground">{t("lv_adjustXpDesc")}</p></div><Switch checked={form.enabled} onCheckedChange={v => setForm({...form, enabled: v})} /></div>
        <div className="grid md:grid-cols-3 gap-4"><div><Label>{t("lv_xpMin")}</Label><Input type="number" value={form.xp_min} onChange={e => setForm({...form, xp_min: Number(e.target.value)})} /></div><div><Label>{t("lv_xpMax")}</Label><Input type="number" value={form.xp_max} onChange={e => setForm({...form, xp_max: Number(e.target.value)})} /></div><div><Label>{t("lv_cooldownSeconds")}</Label><Input type="number" value={form.cooldown_seconds} onChange={e => setForm({...form, cooldown_seconds: Number(e.target.value)})} /></div></div>
        <div className="grid md:grid-cols-2 gap-4"><div><Label>{t("lv_notifyMode")}</Label><Select value={form.level_up_mode} onValueChange={v => setForm({...form, level_up_mode: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="current">{t("channel")}</SelectItem><SelectItem value="fixed">{t("lv_levelUpChannel")}</SelectItem><SelectItem value="dm">DM</SelectItem><SelectItem value="off">{t("disabled")}</SelectItem></SelectContent></Select></div><div><Label>{t("lv_levelUpChannel")}</Label><ChannelSelect value={form.level_up_channel_id || ""} onChange={v => setForm({...form, level_up_channel_id: v})} filter="text" /></div></div>
        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><p className="flex items-center gap-2 font-medium"><MessageSquareText className="h-4 w-4" /> {t("lv_notifyMode")}</p><p className="text-sm text-muted-foreground">{t("lv_adjustXpDesc")}</p></div>
            <Button className="w-full md:w-auto" type="button" variant="secondary" onClick={() => { window.location.href = "/embeds?event=level_up"; }}>{t("embedBuilder_preview")}</Button>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3"><div className="flex items-center justify-between rounded-2xl border p-3"><Label>{t("lv_xpFromSlash")}</Label><Switch checked={form.gain_xp_from_commands} onCheckedChange={v => setForm({...form, gain_xp_from_commands: v})} /></div><div className="flex items-center justify-between rounded-2xl border p-3"><Label>{t("automod_whitelistChannelMode")}</Label><Switch checked={form.use_channel_whitelist} onCheckedChange={v => setForm({...form, use_channel_whitelist: v})} /></div><div className="flex items-center justify-between rounded-2xl border p-3"><Label>{t("lv_rewardDm")}</Label><Switch checked={form.remove_old_reward_roles} onCheckedChange={v => setForm({...form, remove_old_reward_roles: v})} /></div></div>
        <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>{saveConfig.isPending ? t("saving") : t("save")}</Button>
      </CardContent></Card></TabsContent>

      <TabsContent value="voice-xp"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Mic className="h-4 w-4" /> {t("lv_voiceXp")}</CardTitle><CardDescription>{t("lv_voiceXpDesc")}</CardDescription></CardHeader><CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-2xl border p-4"><div><p className="font-medium">{t("lv_voiceXpEnabled")}</p><p className="text-sm text-muted-foreground">{t("lv_voiceXpDesc")}</p></div><Switch checked={form.voice_xp_enabled ?? true} onCheckedChange={v => setForm({...form, voice_xp_enabled: v})} /></div>
        <div className="grid md:grid-cols-3 gap-4">
          <div><Label>{t("lv_xpPerMinute")}</Label><Input type="number" min={1} max={100} value={form.voice_xp_per_minute ?? 5} onChange={e => setForm({...form, voice_xp_per_minute: Number(e.target.value)})} /></div>
          <div><Label>{t("lv_afkTimeout")}</Label><Input type="number" min={1} max={60} value={form.voice_afk_timeout ?? 5} onChange={e => setForm({...form, voice_afk_timeout: Number(e.target.value)})} /><p className="mt-1 text-xs text-muted-foreground">{t("lv_afkTimeoutDesc")}</p></div>
          <div><Label>{t("lv_weeklyResetDay")}</Label><Select value={String(form.weekly_reset_day ?? 1)} onValueChange={v => setForm({...form, weekly_reset_day: Number(v)})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">{t("day_monday")}</SelectItem><SelectItem value="1">{t("day_tuesday")}</SelectItem><SelectItem value="2">{t("day_wednesday")}</SelectItem><SelectItem value="3">{t("day_thursday")}</SelectItem><SelectItem value="4">{t("day_friday")}</SelectItem><SelectItem value="5">{t("day_saturday")}</SelectItem><SelectItem value="6">{t("day_sunday")}</SelectItem></SelectContent></Select></div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><Label>{t("lv_streamBonus")}</Label><Input type="number" step={0.1} min={1} max={5} value={form.voice_stream_bonus ?? 1.5} onChange={e => setForm({...form, voice_stream_bonus: Number(e.target.value)})} /><p className="mt-1 text-xs text-muted-foreground">{t("lv_streamBonusDesc")}</p></div>
          <div><Label>{t("lv_cameraBonus")}</Label><Input type="number" step={0.1} min={1} max={5} value={form.voice_camera_bonus ?? 1.2} onChange={e => setForm({...form, voice_camera_bonus: Number(e.target.value)})} /><p className="mt-1 text-xs text-muted-foreground">{t("lv_cameraBonusDesc")}</p></div>
        </div>
        <div className="flex items-center justify-between rounded-2xl border p-4"><div><p className="font-medium">{t("lv_soloXp")}</p><p className="text-sm text-muted-foreground">{t("lv_voiceXpDesc")}</p></div><Switch checked={form.voice_solo_xp ?? false} onCheckedChange={v => setForm({...form, voice_solo_xp: v})} /></div>
        <div className="rounded-2xl border p-4">
          <div className="mb-3"><Label className="flex items-center gap-2"><Mic className="h-4 w-4" /> {t("lv_ignoredVoiceChannels")}</Label><p className="text-sm text-muted-foreground">{t("lv_voiceXpDesc")}</p></div>
          <MultiChannelSelect value={form.voice_ignored_channels || []} onChange={v => setForm({...form, voice_ignored_channels: v})} filter="voice" placeholder={t("lv_addIgnoredVoiceChannel")} />
        </div>
        <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>{saveConfig.isPending ? t("saving") : t("save")}</Button>
      </CardContent></Card></TabsContent>

      <TabsContent value="filters" className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="h-4 w-4" /> {t("lv_filters")}</CardTitle><CardDescription>{t("lv_adjustXpDesc")}</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><div><Label className="flex items-center gap-2"><Hash className="h-4 w-4" /> {t("lv_ignoredChannels")}</Label><p className="text-sm text-muted-foreground">{t("lv_adjustXpDesc")}</p></div><Badge variant="outline">{form.ignored_channels?.length || 0}</Badge></div>
              <MultiChannelSelect value={form.ignored_channels || []} onChange={v => setForm({...form, ignored_channels: v})} filter="text" placeholder={t("lv_addIgnoredChannel")} />
            </div>
            <div className="rounded-2xl border p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><div><Label className="flex items-center gap-2"><Shield className="h-4 w-4" /> {t("lv_ignoredRoles")}</Label><p className="text-sm text-muted-foreground">{t("lv_adjustXpDesc")}</p></div><Badge variant="outline">{form.ignored_roles?.length || 0}</Badge></div>
              <MultiRoleSelect value={form.ignored_roles || []} onChange={v => setForm({...form, ignored_roles: v})} placeholder={t("lv_addIgnoredRole")} />
            </div>
            <div className="rounded-2xl border p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><div><Label className="flex items-center gap-2"><User className="h-4 w-4" /> {t("lv_ignoredChannels")}</Label><p className="text-sm text-muted-foreground">{t("lv_adjustXpDesc")}</p></div><Badge variant="outline">{form.ignored_users?.length || 0}</Badge></div>
              <IdListEditor value={form.ignored_users || []} onChange={v => setForm({...form, ignored_users: v})} />
            </div>
            <div className="rounded-2xl border p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><div><Label>{t("automod_whitelistChannels")}</Label><p className="text-sm text-muted-foreground">{t("lv_adjustXpDesc")}</p></div><Switch checked={form.use_channel_whitelist} onCheckedChange={v => setForm({...form, use_channel_whitelist: v})} /></div>
              <MultiChannelSelect value={form.whitelist_channels || []} onChange={v => setForm({...form, whitelist_channels: v})} filter="text" placeholder={t("lv_addIgnoredChannel")} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>{saveConfig.isPending ? t("saving") : t("save")}</Button>
              <Button variant="outline" onClick={() => setForm({...form, ignored_channels: [], ignored_roles: [], ignored_users: [], whitelist_channels: []})}>{t("delete")}</Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="leaderboard"><Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><ListOrdered className="w-4 h-4" /> {t("lv_leaderboard")}</CardTitle><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="sm"><RotateCcw className="h-3.5 w-3.5 mr-1.5" />{t("lv_resetLeaderboard")}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("lv_resetLeaderboard")}?</AlertDialogTitle><AlertDialogDescription>{t("lv_confirmResetDesc")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => resetLeaderboard.mutate()}>{t("lv_resetLeaderboard")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>{leaderboard?.reset_at && <CardDescription>{t("lv_leaderboard")}</CardDescription>}</div></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>{t("rank")}</TableHead><TableHead>{t("member")}</TableHead><TableHead>{t("level")}</TableHead><TableHead>XP</TableHead><TableHead><span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{t("messages")}</span></TableHead><TableHead><span className="flex items-center gap-1"><Mic className="h-3.5 w-3.5" />{t("lv_voiceXpLabel")}</span></TableHead><TableHead><span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{t("lv_reputation")}</span></TableHead><TableHead><span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{t("lv_weekly")}</span></TableHead></TableRow></TableHeader><TableBody>{leaderboard?.items?.map(i => <TableRow key={i.discord_id}><TableCell>#{i.rank}</TableCell><TableCell className="font-medium">{i.username || i.discord_id}</TableCell><TableCell>{i.level}</TableCell><TableCell>{i.xp.toLocaleString()}</TableCell><TableCell>{i.message_count}</TableCell><TableCell>{(i.voice_minutes || 0) >= 60 ? `${Math.floor((i.voice_minutes || 0) / 60)}h ${(i.voice_minutes || 0) % 60}m` : `${i.voice_minutes || 0}m`}</TableCell><TableCell>{i.rep_score || 0}</TableCell><TableCell>{(i.weekly_xp || 0).toLocaleString()}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></TabsContent>

      <TabsContent value="rewards"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Gift className="w-4 h-4" /> {t("lv_rewards")}</CardTitle><CardDescription>{t("lv_canvasDesc")}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid md:grid-cols-[120px_1fr_auto_120px] gap-3 items-end"><div><Label>{t("lv_rewardLevel")}</Label><Input type="number" value={reward.level} onChange={e => setReward({...reward, level: Number(e.target.value)})} /></div><div><Label>{t("lv_rewardRole")}</Label><RoleSelect value={reward.role_id} onChange={v => setReward({...reward, role_id: v})} /></div><div className="flex items-center gap-2 pb-1"><Switch checked={reward.dm_user} onCheckedChange={v => setReward({...reward, dm_user: v})} /><Label className="text-xs whitespace-nowrap">{t("lv_rewardDm")}</Label></div><Button onClick={() => addReward.mutate()} disabled={!reward.role_id}>{t("lv_addReward")}</Button></div><Table><TableHeader><TableRow><TableHead>{t("lv_rewardLevel")}</TableHead><TableHead>{t("lv_rewardRole")}</TableHead><TableHead>DM</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{rewards.map(r => <TableRow key={r.id}><TableCell>{r.level}</TableCell><TableCell>{r.role_name || r.role_id}</TableCell><TableCell>{r.dm_user ? "✓" : "—"}</TableCell><TableCell className="text-right"><Button variant="destructive" size="sm" onClick={() => delReward.mutate(r.id)}>{t("delete")}</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card></TabsContent>

      <TabsContent value="multipliers"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Zap className="w-4 h-4" /> {t("lv_multipliers")}</CardTitle><CardDescription>{t("lv_canvasDesc")}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid md:grid-cols-5 gap-3 items-end"><div><Label>{t("lv_multiplierType")}</Label><Select value={multi.type} onValueChange={v => setMulti({...multi, type: v, target_id: ""})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="global">{t("lv_globalMultiplier")}</SelectItem><SelectItem value="channel">{t("lv_channelMultiplier")}</SelectItem><SelectItem value="role">{t("lv_roleMultiplier")}</SelectItem></SelectContent></Select></div><div className="md:col-span-2"><Label>{t("lv_rewardRole")}</Label>{multi.type === "channel" ? <ChannelSelect value={multi.target_id} onChange={v => setMulti({...multi, target_id: v})} filter="text" /> : multi.type === "role" ? <RoleSelect value={multi.target_id} onChange={v => setMulti({...multi, target_id: v})} /> : <Input disabled value={t("lv_globalMultiplier")} />}</div><div><Label>{t("lv_multiplierValue")}</Label><Input type="number" step="0.1" value={multi.multiplier} onChange={e => setMulti({...multi, multiplier: Number(e.target.value)})} /></div><Button onClick={() => addMulti.mutate()}>{t("lv_addReward")}</Button></div><Table><TableHeader><TableRow><TableHead>{t("lv_multiplierType")}</TableHead><TableHead>{t("lv_rewardRole")}</TableHead><TableHead>{t("lv_multiplierValue")}</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{multipliers.map(m => <TableRow key={m.id}><TableCell>{m.type}</TableCell><TableCell>{m.target_name || m.target_id || t("lv_globalMultiplier")}</TableCell><TableCell>x{m.multiplier}</TableCell><TableCell className="text-right"><Button variant="destructive" size="sm" onClick={() => delMulti.mutate(m.id)}>{t("delete")}</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card></TabsContent>

      <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
    </Tabs>
  </div>;
}

/* ── Analytics Tab ─────────────────────────────────────────────────────────── */

interface AnalyticsData {
  total_members: number; total_xp: number; total_text_xp: number; total_voice_xp: number;
  avg_level: number; active_today: number; active_week: number;
  total_messages: number; total_voice_minutes: number;
  level_distribution: { level: number; count: number }[];
  hourly_activity: { hour: number; count: number }[];
  xp_by_day: { date: string; text_xp: number; voice_xp: number; total: number; active_members: number }[];
  top_members: { discord_id: string; username: string; xp: number; level: number; message_count: number; voice_xp: number; voice_minutes: number; rep_score: number }[];
}

function AnalyticsTab() {
  const { t } = useT();
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["leveling_analytics"],
    queryFn: () => apiFetch("/api/leveling/analytics").then(r => r.json()),
  });

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">{t("loading")}</div>;
  if (!analytics) return <div className="text-center py-12 text-muted-foreground">{t("noData")}</div>;

  const maxLevelCount = Math.max(1, ...analytics.level_distribution.map(d => d.count));
  const maxHourly = Math.max(1, ...analytics.hourly_activity.map(d => d.count));

  return <div className="space-y-4">
    {/* Summary Cards */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{analytics.total_members.toLocaleString()}</p><p className="text-xs text-muted-foreground">{t("lv_totalMembers")}</p></CardContent></Card>
      <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{analytics.avg_level}</p><p className="text-xs text-muted-foreground">{t("lv_avgLevel")}</p></CardContent></Card>
      <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{analytics.active_today}</p><p className="text-xs text-muted-foreground">{t("lv_activeToday")}</p></CardContent></Card>
      <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{analytics.active_week}</p><p className="text-xs text-muted-foreground">{t("lv_activeThisWeek")}</p></CardContent></Card>
    </div>

    {/* XP Breakdown */}
    <div className="grid md:grid-cols-3 gap-3">
      <Card><CardContent className="p-4 text-center"><p className="text-xl font-bold">{analytics.total_xp.toLocaleString()}</p><p className="text-xs text-muted-foreground">{t("lv_totalXp")}</p></CardContent></Card>
      <Card><CardContent className="p-4 text-center"><p className="text-xl font-bold text-blue-400">{analytics.total_text_xp.toLocaleString()}</p><p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><MessageCircle className="h-3 w-3" />{t("lv_textXp")}</p></CardContent></Card>
      <Card><CardContent className="p-4 text-center"><p className="text-xl font-bold text-green-400">{analytics.total_voice_xp.toLocaleString()}</p><p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Mic className="h-3 w-3" />{t("lv_voiceXpLabel")}</p></CardContent></Card>
    </div>

    {/* Level Distribution */}
    <Card>
      <CardHeader><CardTitle className="text-sm">{t("lv_levelDistribution")}</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-32">
          {analytics.level_distribution.slice(0, 30).map(d => (
            <div key={d.level} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-violet-500/80 rounded-t" style={{ height: `${Math.max(4, (d.count / maxLevelCount) * 100)}%` }} title={`Lv.${d.level}: ${d.count} members`} />
              <span className="text-[10px] text-muted-foreground">{d.level}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* Hourly Activity Heatmap */}
    <Card>
      <CardHeader><CardTitle className="text-sm">{t("lv_hourlyActivity")}</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-24">
          {analytics.hourly_activity.map(d => (
            <div key={d.hour} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t transition-all" style={{
                height: `${Math.max(4, (d.count / maxHourly) * 100)}%`,
                backgroundColor: `hsl(${200 + (d.count / maxHourly) * 140}, 70%, 55%)`,
                opacity: Math.max(0.3, d.count / maxHourly),
              }} title={`${d.hour}:00 — ${d.count} active`} />
              <span className="text-[10px] text-muted-foreground">{d.hour}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* Top Members */}
    <Card>
      <CardHeader><CardTitle className="text-sm">{t("lv_topMembers")}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t("member")}</TableHead><TableHead>{t("level")}</TableHead><TableHead>XP</TableHead><TableHead><span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{t("messages")}</span></TableHead><TableHead><span className="flex items-center gap-1"><Mic className="h-3.5 w-3.5" />{t("lv_voiceXpLabel")}</span></TableHead><TableHead><span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{t("lv_reputation")}</span></TableHead></TableRow></TableHeader>
          <TableBody>{analytics.top_members.map((m, i) => (
            <TableRow key={m.discord_id}>
              <TableCell>{i + 1}</TableCell>
              <TableCell className="font-medium">{m.username || m.discord_id}</TableCell>
              <TableCell>{m.level}</TableCell>
              <TableCell>{m.xp.toLocaleString()}</TableCell>
              <TableCell>{m.message_count.toLocaleString()}</TableCell>
              <TableCell>{(m.voice_minutes || 0) >= 60 ? `${Math.floor(m.voice_minutes / 60)}h` : `${m.voice_minutes}m`}</TableCell>
              <TableCell>{m.rep_score}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>;
}

export function RankCardEditor() {
  const { t } = useT();
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
    onSuccess: (data) => { setRankCard(data); qc.invalidateQueries({ queryKey: ["leveling_rank_card_config"] }); toast({ title: t("toast_saved"), description: t("toast_rankCardSaved") }); },
    onError: () => toast({ variant: "destructive", title: t("error"), description: t("toast_rankCardFailed") }),
  });

  const startDragLayer = (event: PointerEvent<HTMLDivElement>, layer: RankCardLayer) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setSelectedLayerId(layer.id); setDragState({ id: layer.id, pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startX: layer.x, startY: layer.y, scale: 1 / zoom }); };
  const moveDragLayer = (event: PointerEvent<HTMLDivElement>) => { if (!dragState || dragState.pointerId !== event.pointerId) return; updateLayer(dragState.id, { x: Math.round(dragState.startX + (event.clientX - dragState.startClientX) * dragState.scale), y: Math.round(dragState.startY + (event.clientY - dragState.startClientY) * dragState.scale) }); };
  const endDragLayer = (event: PointerEvent<HTMLDivElement>) => { if (!dragState || dragState.pointerId !== event.pointerId) return; setDragState(null); };
  const startPan = (event: PointerEvent<HTMLDivElement>) => { if (!viewportRef.current || event.target !== event.currentTarget) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setPanState({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: viewportRef.current.scrollLeft, top: viewportRef.current.scrollTop }); };
  const movePan = (event: PointerEvent<HTMLDivElement>) => { if (!panState || panState.pointerId !== event.pointerId || !viewportRef.current) return; viewportRef.current.scrollLeft = panState.left - (event.clientX - panState.x); viewportRef.current.scrollTop = panState.top - (event.clientY - panState.y); };
  const endPan = (event: PointerEvent<HTMLDivElement>) => { if (!panState || panState.pointerId !== event.pointerId) return; setPanState(null); };

  if (!rankCard || !layout) return <div className="flex h-screen items-center justify-center">{t("loading")}</div>;

  return <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-950 text-white">
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-slate-950/95 px-3 py-2 backdrop-blur sm:px-4">
      <div className="flex min-w-0 items-center gap-2"><Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white"><Link to="/leveling/rank-card"><ArrowLeft className="h-4 w-4" /></Link></Button><div className="min-w-0"><p className="truncate text-sm font-semibold">{t("lv_rankCard")}</p><p className="text-[11px] text-white/50">{t("lv_canvasDesc")}</p></div></div>
      <div className="flex items-center gap-1"><Button size="sm" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.1).toFixed(2))))}><ZoomOut className="h-4 w-4" /></Button><Button size="sm" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => setZoom(0.48)}>{t("reset")}</Button><Button size="sm" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))))}><ZoomIn className="h-4 w-4" /></Button><Button size="sm" onClick={() => saveRankCard.mutate()} disabled={saveRankCard.isPending}><Save className="mr-1 h-4 w-4" />{saveRankCard.isPending ? t("saving") : t("save")}</Button></div>
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
        {selectedLayer && <div className="space-y-3 text-white"><div><Label>{t("name")}</Label><Input value={selectedLayer.name} onChange={e => updateSelectedLayer({name: e.target.value})} className="bg-white/10 text-white" /></div><div className="grid grid-cols-3 gap-2"><Input type="number" value={selectedLayer.x} onChange={e => updateSelectedLayer({x:Number(e.target.value)})} className="bg-white/10 text-white" /><Input type="number" value={selectedLayer.y} onChange={e => updateSelectedLayer({y:Number(e.target.value)})} className="bg-white/10 text-white" /><Input type="number" value={selectedLayer.z} onChange={e => updateSelectedLayer({z:Number(e.target.value)})} className="bg-white/10 text-white" /><Input type="number" value={selectedLayer.w} onChange={e => updateSelectedLayer({w:Number(e.target.value)})} className="bg-white/10 text-white" /><Input type="number" value={selectedLayer.h} onChange={e => updateSelectedLayer({h:Number(e.target.value)})} className="bg-white/10 text-white" /><Input type="color" value={selectedLayer.color || selectedLayer.fill || "#ffffff"} onChange={e => updateSelectedLayer(selectedLayer.type === "progress" ? {fill:e.target.value} : {color:e.target.value})} className="bg-white/10" /></div><div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"><Label>{t("lv_showProgressBar")}</Label><Switch checked={selectedLayer.visible} onCheckedChange={v => updateSelectedLayer({visible:v})} /></div></div>}
      </aside>
    </div>
  </div>;
}
