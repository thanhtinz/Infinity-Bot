import { useState, useEffect, useMemo } from "react";
import type { ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Settings2,
  Sliders,
  Clock,
  Hash,
  Save,
  FolderOpen,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { ChannelSelect } from "@/components/ChannelSelect";
import { MultiRoleSelect } from "@/components/RoleSelect";
// ─── Types ───────────────────────────────────────────────────────────────────

interface TicketConfigData {
  id?: number;
  guild_id?: string;
  category_id?: string;
  log_channel_id?: string;
  support_role_ids?: string[];
  ticket_limit?: number;
  cooldown_minutes?: number;
  auto_close_hours?: number;
  naming_format?: string;
  open_message_title?: string;
  open_message_body?: string;
  close_message_title?: string;
  close_message_body?: string;
  claim_message_title?: string;
  claim_message_body?: string;
}

interface ConfigForm {
  log_channel_id: string;
  category_id: string;
  support_role_ids: string;
  ticket_limit: number;
  cooldown_minutes: number;
  auto_close_hours: number;
  auto_close_enabled: boolean;
  naming_format: string;
  open_message_title: string;
  open_message_body: string;
  close_message_title: string;
  close_message_body: string;
  claim_message_title: string;
  claim_message_body: string;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULTS: ConfigForm = {
  log_channel_id: "",
  category_id: "",
  support_role_ids: "",
  ticket_limit: 1,
  cooldown_minutes: 0,
  auto_close_hours: 0,
  auto_close_enabled: false,
  naming_format: "ticket-{number}",
  open_message_title: "",
  open_message_body: "",
  close_message_title: "",
  close_message_body: "",
  claim_message_title: "",
  claim_message_body: "",
};

function configToForm(cfg: TicketConfigData | null): ConfigForm {
  if (!cfg) return { ...DEFAULTS };
  return {
    log_channel_id: cfg.log_channel_id ?? "",
    category_id: cfg.category_id ?? "",
    support_role_ids: (cfg.support_role_ids ?? []).join(", "),
    ticket_limit: cfg.ticket_limit ?? 1,
    cooldown_minutes: cfg.cooldown_minutes ?? 0,
    auto_close_hours: cfg.auto_close_hours ?? 0,
    auto_close_enabled: (cfg.auto_close_hours ?? 0) > 0,
    naming_format: cfg.naming_format || "ticket-{number}",
    open_message_title: cfg.open_message_title ?? "",
    open_message_body: cfg.open_message_body ?? "",
    close_message_title: cfg.close_message_title ?? "",
    close_message_body: cfg.close_message_body ?? "",
    claim_message_title: cfg.claim_message_title ?? "",
    claim_message_body: cfg.claim_message_body ?? "",
  };
}

function formToPayload(form: ConfigForm): TicketConfigData {
  return {
    log_channel_id: form.log_channel_id || undefined,
    category_id: form.category_id || undefined,
    support_role_ids: form.support_role_ids
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    ticket_limit: form.ticket_limit,
    cooldown_minutes: form.cooldown_minutes,
    auto_close_hours: form.auto_close_enabled ? form.auto_close_hours : 0,
    naming_format: form.naming_format,
    open_message_title: form.open_message_title || undefined,
    open_message_body: form.open_message_body || undefined,
    close_message_title: form.close_message_title || undefined,
    close_message_body: form.close_message_body || undefined,
    claim_message_title: form.claim_message_title || undefined,
    claim_message_body: form.claim_message_body || undefined,
  };
}

function previewName(format: string): string {
  return format
    .replace(/\{number\}/g, "0042")
    .replace(/\{username\}/g, "john")
    .replace(/\{date\}/g, new Date().toLocaleDateString("vi-VN"));
}

// ─── Discord Message Preview ─────────────────────────────────────────────────

function MessagePreview({ title, body, color }: { title: string; body: string; color: string }) {
  if (!title && !body) return null;
  return (
    <div className="rounded-md overflow-hidden text-sm mt-2" style={{ backgroundColor: "#2b2d31" }}>
      <div className="px-3 py-2">
        <div className="flex items-start gap-2.5">
          <div className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: color, color: "#fff" }}>TB</div>
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-xs" style={{ color }}>TicketBot</span>
            <div className="mt-1 rounded overflow-hidden max-w-[320px]" style={{ backgroundColor: "#2b2d31" }}>
              <div className="flex">
                <div className="w-1 shrink-0 rounded-l" style={{ backgroundColor: color }} />
                <div className="p-2 flex-1 min-w-0">
                  {title && <p className="font-semibold text-xs" style={{ color: "#dbdee1" }}>{title}</p>}
                  {body && <p className="text-[11px] mt-0.5 whitespace-pre-wrap" style={{ color: "#949ba4" }}>{body}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section Card ────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

// ─── Field helpers ───────────────────────────────────────────────────────────

function IconInput({
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
}: {
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type={type}
        className="pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
      />
    </div>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-4">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            {i < 3 && <Skeleton className="h-10 w-full" />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function TicketConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<ConfigForm>({ ...DEFAULTS });
  const [loadedForm, setLoadedForm] = useState<ConfigForm>({ ...DEFAULTS });

  // ─── Fetch config ──────────────────────────────────────────────────────

  const { data: config, isLoading } = useQuery<TicketConfigData | null>({
    queryKey: ["ticket-config"],
    queryFn: async () => {
      const res = await fetch("/api/ticket-config", {
        credentials: "include",
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Không thể tải cấu hình ticket");
      return res.json();
    },
  });

  // ─── Populate form when config loads ───────────────────────────────────

  useEffect(() => {
    const initial = configToForm(config ?? null);
    setForm(initial);
    setLoadedForm(initial);
  }, [config]);

  // ─── Dirty check ───────────────────────────────────────────────────────

  const isDirty = useMemo(() => {
    return (
      form.log_channel_id !== loadedForm.log_channel_id ||
      form.category_id !== loadedForm.category_id ||
      form.support_role_ids !== loadedForm.support_role_ids ||
      form.ticket_limit !== loadedForm.ticket_limit ||
      form.cooldown_minutes !== loadedForm.cooldown_minutes ||
      form.auto_close_enabled !== loadedForm.auto_close_enabled ||
      form.auto_close_hours !== loadedForm.auto_close_hours ||
      form.naming_format !== loadedForm.naming_format ||
      form.open_message_title !== loadedForm.open_message_title ||
      form.open_message_body !== loadedForm.open_message_body ||
      form.close_message_title !== loadedForm.close_message_title ||
      form.close_message_body !== loadedForm.close_message_body ||
      form.claim_message_title !== loadedForm.claim_message_title ||
      form.claim_message_body !== loadedForm.claim_message_body
    );
  }, [form, loadedForm]);

  // ─── Save mutation ─────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (data: ConfigForm) => {
      const payload = formToPayload(data);
      const res = await fetch("/api/ticket-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Lưu thất bại");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Đã lưu cấu hình ticket" });
      qc.invalidateQueries({ queryKey: ["ticket-config"] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Lưu thất bại",
        description: "Vui lòng thử lại",
      });
    },
  });

  // ─── Field setter ──────────────────────────────────────────────────────

  const set = <K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleNumberInput = (
    key: keyof ConfigForm,
    e: ChangeEvent<HTMLInputElement>,
    min: number,
    max: number,
  ) => {
    const raw = parseInt(e.target.value);
    if (isNaN(raw)) {
      set(key, min as never);
      return;
    }
    set(key, Math.min(max, Math.max(min, raw)) as never);
  };

  // ─── Render ────────────────────────────────────────────────────────────

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Cấu hình Ticket
          </h1>
          <p className="text-sm text-muted-foreground">
            Thiết lập hệ thống ticket cho server Discord
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <Badge variant="secondary" className="text-xs">
              Có thay đổi chưa lưu
            </Badge>
          )}
          <Button
            size="sm"
            disabled={!isDirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate(form)}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saveMutation.isPending ? "Đang lưu..." : "Lưu cấu hình"}
          </Button>
        </div>
      </div>

      {/* ── Section 1: Channels & Roles ── */}
      <SectionCard
        icon={Settings2}
        title="Channel & Role"
        description="Cấu hình channel và role cho hệ thống ticket"
      >
        <div className="space-y-2">
          <Label htmlFor="log-channel">Log Channel ID</Label>
          <ChannelSelect
            filter="text"
            value={form.log_channel_id}
            onChange={(v) => set("log_channel_id", v === "__clear__" ? "" : v)}
            placeholder="Chọn kênh log..."
          />
          <p className="text-xs text-muted-foreground">
            Channel ghi lại lịch sử các ticket
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category-id">Default Category ID</Label>
          <ChannelSelect
            filter="category"
            value={form.category_id}
            onChange={(v) => set("category_id", v === "__clear__" ? "" : v)}
            placeholder="Chọn category..."
          />
          <p className="text-xs text-muted-foreground">
            Category Discord chứa channel ticket
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="support-roles">Support Role IDs</Label>
          <MultiRoleSelect
            value={form.support_role_ids
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)}
            onChange={(v) => set("support_role_ids", v.join(", "))}
            placeholder="Chọn roles hỗ trợ..."
          />
          <p className="text-xs text-muted-foreground">
            Các role có quyền xem và xử lý ticket (phân cách bằng dấu phẩy)
          </p>
        </div>
      </SectionCard>

      {/* ── Section 2: Giới hạn & Cooldown ── */}
      <SectionCard
        icon={Sliders}
        title="Giới hạn & Cooldown"
        description="Kiểm soát tần suất tạo ticket"
      >
        <div className="space-y-2">
          <Label>Ticket limit per user</Label>
          <div className="flex items-center gap-4">
            <Slider
              value={[form.ticket_limit]}
              onValueChange={([v]) => set("ticket_limit", v)}
              min={1}
              max={10}
              step={1}
              className="flex-1"
            />
            <span className="text-sm font-semibold tabular-nums w-6 text-center">
              {form.ticket_limit}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Số ticket tối đa mỗi người có thể mở cùng lúc
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cooldown">Cooldown (phút)</Label>
          <Input
            id="cooldown"
            type="number"
            min={0}
            placeholder="0"
            value={form.cooldown_minutes}
            onChange={(e) =>
              handleNumberInput("cooldown_minutes", e, 0, 10080)
            }
          />
          <p className="text-xs text-muted-foreground">
            Thời gian chờ giữa 2 lần tạo ticket (phút, 0 = tắt)
          </p>
        </div>
      </SectionCard>

      {/* ── Section 3: Tự động đóng ── */}
      <SectionCard
        icon={Clock}
        title="Tự động đóng"
        description="Tự động đóng ticket không hoạt động"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label>Bật tự động đóng</Label>
            <p className="text-xs text-muted-foreground">
              Tự động đóng ticket khi không có hoạt động
            </p>
          </div>
          <Switch
            checked={form.auto_close_enabled}
            onCheckedChange={(checked) => {
              set("auto_close_enabled", checked);
              if (!checked) set("auto_close_hours", 0);
              else if (form.auto_close_hours === 0) set("auto_close_hours", 24);
            }}
          />
        </div>

        {form.auto_close_enabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="auto-close-hours">Đóng sau (giờ)</Label>
              <Input
                id="auto-close-hours"
                type="number"
                min={1}
                max={720}
                value={form.auto_close_hours}
                onChange={(e) =>
                  handleNumberInput("auto_close_hours", e, 1, 720)
                }
              />
            </div>
            {form.auto_close_hours > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Ticket sẽ tự động đóng sau {form.auto_close_hours} giờ không
                  có tin nhắn
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </SectionCard>

      {/* ── Section 4: Định dạng tên ── */}
      <SectionCard
        icon={Hash}
        title="Định dạng tên"
        description="Tùy chỉnh cách đặt tên channel ticket"
      >
        <div className="space-y-2">
          <Label htmlFor="naming-format">Naming format</Label>
          <Input
            id="naming-format"
            placeholder="ticket-{number}"
            value={form.naming_format}
            onChange={(e) => set("naming_format", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Biến hỗ trợ:{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">
              {`{number}`}
            </code>{" "}
            — số thứ tự,{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">
              {`{username}`}
            </code>{" "}
            — tên user,{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">
              {`{date}`}
            </code>{" "}
            — ngày tạo
          </p>
        </div>

        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground mb-1">Xem trước</p>
          <p className="text-sm font-mono font-medium tracking-tight">
            {previewName(form.naming_format || "ticket-{number}")}
          </p>
        </div>
      </SectionCard>

      {/* ── Section 5: Tin nhắn tự động ── */}
      <SectionCard
        icon={MessageSquare}
        title="Tin nhắn tự động"
        description="Cấu hình nội dung embed gửi khi ticket được mở, đóng, claim"
      >
        {/* Khi mở ticket */}
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <p className="text-sm font-medium">Khi mở ticket</p>
          </div>
          <div className="space-y-2">
            <Label>Tiêu đề</Label>
            <Input
              placeholder="Ví dụ: Ticket đã được tạo"
              value={form.open_message_title}
              onChange={(e) => set("open_message_title", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Nội dung</Label>
            <Textarea
              placeholder="Xin chào {user}, ticket #{ticket_id} đã được tạo..."
              value={form.open_message_body}
              onChange={(e) => set("open_message_body", e.target.value)}
              rows={3}
            />
          </div>
          <MessagePreview title={form.open_message_title} body={form.open_message_body} color="#57f287" />
        </div>

        {/* Khi đóng ticket */}
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-destructive" />
            <p className="text-sm font-medium">Khi đóng ticket</p>
          </div>
          <div className="space-y-2">
            <Label>Tiêu đề</Label>
            <Input
              placeholder="Ví dụ: Ticket đã đóng"
              value={form.close_message_title}
              onChange={(e) => set("close_message_title", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Nội dung</Label>
            <Textarea
              placeholder="Ticket #{ticket_id} đã được đóng bởi {staff}..."
              value={form.close_message_body}
              onChange={(e) => set("close_message_body", e.target.value)}
              rows={3}
            />
          </div>
          <MessagePreview title={form.close_message_title} body={form.close_message_body} color="#ed4245" />
        </div>

        {/* Khi claim ticket */}
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <p className="text-sm font-medium">Khi claim ticket</p>
          </div>
          <div className="space-y-2">
            <Label>Tiêu đề</Label>
            <Input
              placeholder="Ví dụ: Ticket đã được nhận"
              value={form.claim_message_title}
              onChange={(e) => set("claim_message_title", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Nội dung</Label>
            <Textarea
              placeholder="{staff} đã nhận hỗ trợ ticket #{ticket_id}..."
              value={form.claim_message_body}
              onChange={(e) => set("claim_message_body", e.target.value)}
              rows={3}
            />
          </div>
          <MessagePreview title={form.claim_message_title} body={form.claim_message_body} color="#5865F2" />
        </div>

        {/* Variables hint */}
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">
            Biến hỗ trợ:{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">{"{user}"}</code> — người tạo,{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">{"{staff}"}</code> — nhân viên,{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">{"{ticket_id}"}</code> — mã ticket,{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">{"{channel}"}</code> — kênh
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
