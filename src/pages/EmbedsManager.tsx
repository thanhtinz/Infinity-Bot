import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart, CheckCircle, Package, Timer, Star, Gift,
  Trophy, UserPlus, ShieldAlert, RotateCcw, Plus, Trash2,
  ChevronDown, ChevronUp, Image, Variable,
  Ticket, TicketX, UserCheck, FileText, UserMinus, Ban,
  Clock, UserPlus2, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

interface EmbedTemplate {
  id: number;
  name: string;
  event_type: string;
  title: string;
  description: string;
  color: string;
  author: string;
  author_icon_url: string;
  footer: string;
  thumbnail_url: string;
  image_url: string;
  fields: EmbedField[];
  enabled: boolean;
}

type FormState = Omit<EmbedTemplate, "id"> & { existingId?: number };

// ─── Event definitions ───────────────────────────────────────────────────────

interface EmbedEventDef {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}

const EMBED_EVENTS: EmbedEventDef[] = [
  { key: "don_hang_moi",      label: "Đơn hàng mới",           icon: ShoppingCart, desc: "Khi admin tạo đơn /tao_don" },
  { key: "thanh_toan",        label: "Thanh toán thành công",  icon: CheckCircle,  desc: "Khi PayOS webhook PAID" },
  { key: "giao_hang",         label: "Giao hàng",              icon: Package,      desc: "Khi admin giao hàng" },
  { key: "don_hang_het_han",  label: "Đơn hàng hết hạn",      icon: Timer,        desc: "Khi đơn quá 15 phút chưa thanh toán" },
  { key: "feedback",          label: "Feedback khách hàng",    icon: Star,         desc: "Khi user dùng /feedback" },
  { key: "giveaway",          label: "Giveaway bắt đầu",       icon: Gift,         desc: "Khi tạo /giveaway" },
  { key: "ket_qua_giveaway",  label: "Kết quả Giveaway",       icon: Trophy,       desc: "Khi giveaway kết thúc, công bố winner" },
  { key: "welcome",           label: "Chào mừng thành viên",   icon: UserPlus,     desc: "Khi member join server" },
  { key: "canh_bao",          label: "Cảnh báo thành viên",    icon: ShieldAlert,  desc: "Khi admin dùng /warn" },
  { key: "ticket_mo",         label: "Mở Ticket",              icon: Ticket,       desc: "Khi user tạo ticket mới" },
  { key: "ticket_dong",       label: "Đóng Ticket",            icon: TicketX,      desc: "Khi ticket bị đóng" },
  { key: "ticket_nhan",       label: "Nhận Ticket",            icon: UserCheck,    desc: "Khi staff nhận ticket (claim)" },
  { key: "ticket_transcript", label: "Transcript",             icon: FileText,     desc: "Khi xuất transcript ticket" },
  { key: "kick",              label: "Kick thành viên",        icon: UserMinus,    desc: "Khi bot kick user" },
  { key: "ban",               label: "Ban thành viên",         icon: Ban,          desc: "Khi bot ban user" },
  { key: "timeout",           label: "Timeout thành viên",     icon: Clock,        desc: "Khi bot timeout user" },
  { key: "invite_join",       label: "Tham gia qua Invite",    icon: UserPlus2,    desc: "Khi user join qua link invite" },
];

// ─── Event groups ────────────────────────────────────────────────────────────

const EVENT_GROUPS: { label: string; keys: string[] }[] = [
  { label: "Đơn hàng",    keys: ["don_hang_moi", "thanh_toan", "giao_hang", "don_hang_het_han"] },
  { label: "Cộng đồng",   keys: ["giveaway", "ket_qua_giveaway", "welcome", "feedback"] },
  { label: "Ticket",      keys: ["ticket_mo", "ticket_dong", "ticket_nhan", "ticket_transcript"] },
  { label: "Kiểm duyệt", keys: ["canh_bao", "kick", "ban", "timeout", "invite_join"] },
];

// ─── Hardcoded defaults ─────────────────────────────────────────────────────

const DEFAULTS: Record<string, Omit<EmbedTemplate, "id" | "event_type" | "name">> = {
  don_hang_moi: {
    title: "Đơn hàng mới",
    description: "Vui lòng thanh toán để hoàn tất đơn hàng.\nHết hạn sau 15 phút.",
    color: "#F0B232",
    author: "",
    author_icon_url: "",
    footer: "Đang chờ thanh toán...",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "ID Đơn", value: "#{order.id}", inline: true },
      { name: "Khách hàng", value: "{user.mention}", inline: true },
      { name: "Sản phẩm", value: "{product.name}", inline: false },
      { name: "Số tiền", value: "{order.total} VNĐ", inline: true },
    ],
    enabled: true,
  },
  thanh_toan: {
    title: "Thanh toán thành công",
    description: "Cảm ơn {user.mention}! Đơn hàng #{order.id} đã được thanh toán.",
    color: "#57F287",
    author: "",
    author_icon_url: "",
    footer: "Cảm ơn bạn đã mua hàng!",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Sản phẩm", value: "{product.name}", inline: true },
      { name: "Số tiền", value: "{order.total} VNĐ", inline: true },
    ],
    enabled: true,
  },
  giao_hang: {
    title: "Đơn hàng đã được giao",
    description: "Đơn hàng #{order.id} của bạn đã được giao thành công!",
    color: "#5865F2",
    author: "",
    author_icon_url: "",
    footer: "Cảm ơn bạn đã mua hàng!",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Sản phẩm", value: "{product.name}", inline: true },
      { name: "Ngày giao", value: "{date}", inline: true },
    ],
    enabled: true,
  },
  don_hang_het_han: {
    title: "Đơn hàng đã hết hạn",
    description: "Đơn hàng #{order.id} của bạn đã hết hạn do chưa thanh toán sau 15 phút.",
    color: "#ED4245",
    author: "",
    author_icon_url: "",
    footer: "Tạo đơn mới để tiếp tục mua hàng.",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Sản phẩm", value: "{product.name}", inline: true },
    ],
    enabled: true,
  },
  feedback: {
    title: "Feedback mới",
    description: "{user} đã gửi đánh giá cho {product.name}",
    color: "#FEE75C",
    author: "",
    author_icon_url: "",
    footer: "Feedback system",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Xếp hạng", value: "{stars}", inline: true },
      { name: "Nội dung", value: "{content}", inline: false },
    ],
    enabled: true,
  },
  giveaway: {
    title: "GIVEAWAY",
    description: "{prize}\n\nNhấn nút bên dưới để tham gia!\nKết thúc: {ends_at}",
    color: "#FF73FA",
    author: "Tổ chức bởi {host}",
    author_icon_url: "",
    footer: "Kết thúc lúc {ends_at}",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Số người thắng", value: "{winners_count}", inline: true },
    ],
    enabled: true,
  },
  ket_qua_giveaway: {
    title: "Kết quả Giveaway",
    description: "Giveaway đã kết thúc!\nPhần thưởng: {prize}",
    color: "#FF73FA",
    author: "",
    author_icon_url: "",
    footer: "Chúc mừng người chiến thắng!",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Người thắng", value: "{winners}", inline: false },
    ],
    enabled: true,
  },
  welcome: {
    title: "Chào mừng đến với {server}!",
    description: "Xin chào {user.mention}, chúc bạn có thời gian vui vẻ tại đây!",
    color: "#57F287",
    author: "",
    author_icon_url: "",
    footer: "Thành viên thứ {member_count}",
    thumbnail_url: "",
    image_url: "",
    fields: [],
    enabled: true,
  },
  canh_bao: {
    title: "Cảnh báo",
    description: "{user.mention} đã nhận cảnh báo.",
    color: "#FEE75C",
    author: "",
    author_icon_url: "",
    footer: "Hãy tuân thủ nội quy server",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Lý do", value: "{reason}", inline: false },
      { name: "Tổng cảnh báo", value: "{warn_count}", inline: true },
    ],
    enabled: true,
  },
  ticket_mo: {
    title: "🎫 Ticket #{ticket_id} đã được tạo",
    description: "Xin chào {user.mention}!\nTicket của bạn đã được tạo.\nVui lòng mô tả vấn đề để được hỗ trợ.",
    color: "#5865F2",
    author: "",
    author_icon_url: "",
    footer: "Hỗ trợ sẽ đến sớm!",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Ticket ID", value: "#{ticket_id}", inline: true },
    ],
    enabled: true,
  },
  ticket_dong: {
    title: "🔒 Ticket đã đóng",
    description: "Ticket #{ticket_id} của {user.mention} đã được đóng.",
    color: "#ED4245",
    author: "",
    author_icon_url: "",
    footer: "",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Lý do", value: "{close_reason}", inline: false },
    ],
    enabled: true,
  },
  ticket_nhan: {
    title: "✋ Ticket đã được nhận",
    description: "{staff.mention} đã nhận ticket #{ticket_id}.",
    color: "#57F287",
    author: "",
    author_icon_url: "",
    footer: "Chúng tôi sẽ hỗ trợ bạn sớm nhất!",
    thumbnail_url: "",
    image_url: "",
    fields: [],
    enabled: true,
  },
  ticket_transcript: {
    title: "📄 Transcript Ticket #{ticket_id}",
    description: "Transcript của ticket {user.mention} đã được lưu.",
    color: "#5865F2",
    author: "",
    author_icon_url: "",
    footer: "",
    thumbnail_url: "",
    image_url: "",
    fields: [],
    enabled: true,
  },
  kick: {
    title: "👢 Đã kick khỏi server",
    description: "{user.mention} đã bị kick khỏi server.",
    color: "#ED4245",
    author: "",
    author_icon_url: "",
    footer: "",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Lý do", value: "{reason}", inline: false },
      { name: "Mod", value: "{mod}", inline: true },
    ],
    enabled: true,
  },
  ban: {
    title: "🔨 Đã bị cấm vĩnh viễn",
    description: "{user.mention} đã bị ban khỏi server.",
    color: "#ED4245",
    author: "",
    author_icon_url: "",
    footer: "",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Lý do", value: "{reason}", inline: false },
      { name: "Mod", value: "{mod}", inline: true },
    ],
    enabled: true,
  },
  timeout: {
    title: "⏰ Đã bị timeout",
    description: "{user.mention} đã bị timeout.",
    color: "#FEE75C",
    author: "",
    author_icon_url: "",
    footer: "",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Thời gian", value: "{duration}", inline: true },
      { name: "Lý do", value: "{reason}", inline: false },
    ],
    enabled: true,
  },
  invite_join: {
    title: "👋 Thành viên mới tham gia",
    description: "{user.mention} đã tham gia server qua lời mời của {inviter}.",
    color: "#57F287",
    author: "",
    author_icon_url: "",
    footer: "Thành viên thứ {member_count}",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Invite code", value: "{invite_code}", inline: true },
    ],
    enabled: true,
  },
};

// ─── Variables reference ─────────────────────────────────────────────────────

const VARIABLES: { token: string; desc: string }[] = [
  { token: "{user}",           desc: "Tên người dùng" },
  { token: "{user.mention}",   desc: "@mention người dùng" },
  { token: "{user.id}",        desc: "Discord ID" },
  { token: "{order.id}",       desc: "Mã đơn hàng (#12345)" },
  { token: "{order.total}",    desc: "Tổng tiền (100,000)" },
  { token: "{product.name}",   desc: "Tên sản phẩm" },
  { token: "{package}",        desc: "Nội dung gói (cho đơn custom)" },
  { token: "{date}",           desc: "Ngày giờ hiện tại" },
  { token: "{server}",         desc: "Tên server" },
  { token: "{member_count}",   desc: "Số thành viên (welcome)" },
  { token: "{prize}",          desc: "Phần thưởng (giveaway)" },
  { token: "{ends_at}",        desc: "Thời gian kết thúc (giveaway)" },
  { token: "{host}",           desc: "Người tổ chức (giveaway)" },
  { token: "{winners_count}",  desc: "Số người thắng (giveaway)" },
  { token: "{winners}",        desc: "Tên người thắng (ket_qua_giveaway)" },
  { token: "{reason}",         desc: "Lý do cảnh báo (canh_bao)" },
  { token: "{warn_count}",     desc: "Tổng số cảnh báo (canh_bao)" },
  { token: "{stars}",          desc: "Số sao (feedback)" },
  { token: "{content}",        desc: "Nội dung feedback" },
  { token: "{ticket_id}",      desc: "ID ticket" },
  { token: "{close_reason}",   desc: "Lý do đóng ticket" },
  { token: "{staff.mention}",  desc: "Staff nhận ticket" },
  { token: "{duration}",       desc: "Thời gian timeout" },
  { token: "{mod}",            desc: "Tên mod thực hiện" },
  { token: "{invite_code}",    desc: "Mã invite" },
  { token: "{inviter}",        desc: "Người mời" },
];

// ─── Dummy data for preview ─────────────────────────────────────────────────

const DUMMY: Record<string, string> = {
  "{user}": "Nguyễn Văn A",
  "{user.mention}": "@NguyễnVănA",
  "{user.id}": "123456789012345678",
  "{order.id}": "#12345",
  "{order.total}": "100,000",
  "{product.name}": "Gói VIP 30 ngày",
  "{package}": "VIP 30 ngày + Bonus",
  "{date}": "14/05/2026 15:30",
  "{server}": "Shop ABC",
  "{member_count}": "1,234",
  "{prize}": "Nitro 3 tháng",
  "{ends_at}": "14/05/2026 20:00",
  "{host}": "@Admin",
  "{winners_count}": "2",
  "{winners}": "@User1, @User2",
  "{reason}": "Vi phạm nội quy",
  "{warn_count}": "3",
  "{stars}": "⭐⭐⭐⭐⭐",
  "{content}": "Sản phẩm rất tốt, giao hàng nhanh!",
  "{ticket_id}": "42",
  "{close_reason}": "Đã giải quyết",
  "{staff.mention}": "@ModTran",
  "{duration}": "10 phút",
  "{mod}": "Mod Trần",
  "{invite_code}": "abc123",
  "{inviter}": "@Admin",
};

function replaceVars(text: string): string {
  return text.replace(/\{[\w.]+\}/g, (m) => DUMMY[m] ?? m);
}

function parseBold(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ─── Helper: build form from defaults ────────────────────────────────────────

function defaultForm(eventKey: string): FormState {
  const d = DEFAULTS[eventKey];
  const ev = EMBED_EVENTS.find((e) => e.key === eventKey);
  return {
    name: ev?.label ?? eventKey,
    event_type: eventKey,
    title: d.title,
    description: d.description,
    color: d.color,
    author: d.author,
    author_icon_url: d.author_icon_url,
    footer: d.footer,
    thumbnail_url: d.thumbnail_url,
    image_url: d.image_url,
    fields: d.fields.map((f) => ({ ...f })),
    enabled: d.enabled,
    existingId: undefined,
  };
}

// ─── Discord Preview Component ───────────────────────────────────────────────

function DiscordPreview({ form }: { form: FormState }) {
  const inlineFields = form.fields.filter((f) => f.inline);
  const blockFields = form.fields.filter((f) => !f.inline);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="rounded-lg bg-[#313338] p-4 font-sans text-sm">
      {/* Bot message header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-lg"
          style={{ backgroundColor: form.color || "#5865F2" }}
        >
          🤖
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#F2F3F5] text-sm">Dashboard Bot</span>
            <span className="bg-[#5865F2] text-white text-[10px] font-medium px-1 py-0.5 rounded leading-none">
              BOT
            </span>
            <span className="text-xs text-[#949BA4] ml-1">
              Hôm nay lúc {timeStr}
            </span>
          </div>
        </div>
      </div>

      {/* Embed card */}
      <div className="flex gap-3 pl-[52px]">
        <div
          className="relative max-w-[520px] min-w-[200px] rounded bg-[#2B2D31] overflow-hidden"
          style={{ borderLeft: `4px solid ${form.color || "#5865F2"}` }}
        >
          {/* Inner grid: content | thumbnail */}
          <div className="flex">
            {/* Content side */}
            <div className="flex-1 p-4 space-y-2 min-w-0">
              {/* Author */}
              {(form.author || form.author_icon_url) && (
                <div className="flex items-center gap-2">
                  {form.author_icon_url && (
                    <img
                      src={form.author_icon_url}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  {form.author && (
                    <span className="text-xs font-medium text-[#B5BAC1]">
                      {replaceVars(form.author)}
                    </span>
                  )}
                </div>
              )}

              {/* Title */}
              {form.title && (
                <div className="font-semibold text-[#0A66C2] leading-snug">
                  {parseBold(replaceVars(form.title))}
                </div>
              )}

              {/* Description */}
              {form.description && (
                <div className="whitespace-pre-wrap text-[#B5BAC1] text-sm leading-relaxed">
                  {parseBold(replaceVars(form.description))}
                </div>
              )}

              {/* Block fields */}
              {blockFields.length > 0 && (
                <div className="space-y-1 pt-1">
                  {blockFields.map((f, i) => (
                    <div key={`b${i}`}>
                      <div className="font-semibold text-[#F2F3F5] text-sm">
                        {replaceVars(f.name)}
                      </div>
                      <div className="text-[#B5BAC1] text-sm">
                        {replaceVars(f.value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Inline fields grid */}
              {inlineFields.length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 pt-1">
                  {inlineFields.map((f, i) => (
                    <div key={`i${i}`} className="min-w-0">
                      <div className="font-semibold text-[#F2F3F5] text-sm truncate">
                        {replaceVars(f.name)}
                      </div>
                      <div className="text-[#B5BAC1] text-sm truncate">
                        {replaceVars(f.value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Large image */}
              {form.image_url && (
                <div className="pt-1">
                  <img
                    src={form.image_url}
                    alt="Embed"
                    className="max-w-full rounded"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}

              {/* Footer + timestamp */}
              {form.footer && (
                <div className="flex items-center gap-2 pt-1 text-xs text-[#B5BAC1]">
                  <span>{replaceVars(form.footer)}</span>
                  <span>•</span>
                  <span>Hôm nay lúc {timeStr}</span>
                </div>
              )}
            </div>

            {/* Thumbnail */}
            {form.thumbnail_url && (
              <div className="shrink-0 p-4 pl-0 self-start">
                <img
                  src={form.thumbnail_url}
                  alt="Thumbnail"
                  className="w-20 h-20 rounded object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function EmbedsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Selected event
  const [selectedKey, setSelectedKey] = useState<string>(EMBED_EVENTS[0].key);

  // Form state
  const [form, setForm] = useState<FormState>(defaultForm(EMBED_EVENTS[0].key));

  // Collapsible sections
  const [imagesOpen, setImagesOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(true);
  const [authorOpen, setAuthorOpen] = useState(false);
  const [varsOpen, setVarsOpen] = useState(false);

  // Reset dialog
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // ── Fetch embeds ──
  const { data: embeds = [], isLoading } = useQuery<EmbedTemplate[]>({
    queryKey: ["embeds"],
    queryFn: () => fetch("/api/embeds", { credentials: "include" }).then((r) => r.json()),
    staleTime: 300_000,
  });

  // Map of saved templates by event_type
  const savedMap = useMemo(() => {
    const m = new Map<string, EmbedTemplate>();
    for (const e of embeds) m.set(e.event_type, e);
    return m;
  }, [embeds]);

  // ── Save mutation ──
  const saveMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      const body = {
        event_type: payload.event_type,
        name: payload.name,
        title: payload.title,
        description: payload.description,
        color: payload.color,
        author: payload.author,
        author_icon_url: payload.author_icon_url,
        footer: payload.footer,
        thumbnail_url: payload.thumbnail_url,
        image_url: payload.image_url,
        fields: payload.fields,
        enabled: payload.enabled,
      };
      if (payload.existingId) {
        const res = await fetch(`/api/embeds/${payload.existingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Lưu thất bại");
        return res.json();
      } else {
        const res = await fetch("/api/embeds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Lưu thất bại");
        return res.json();
      }
    },
    onSuccess: (data) => {
      toast({ title: "Đã lưu", description: "Embed đã được lưu thành công." });
      queryClient.invalidateQueries({ queryKey: ["embeds"] });
      setForm((f) => ({ ...f, existingId: data.id ?? f.existingId }));
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể lưu embed. Vui lòng thử lại.", variant: "destructive" });
    },
  });

  // ── Select event ──
  const selectEvent = (key: string) => {
    setSelectedKey(key);
    const saved = savedMap.get(key);
    if (saved) {
      setForm({
        name: saved.name,
        event_type: saved.event_type,
        title: saved.title,
        description: saved.description,
        color: saved.color,
        author: saved.author,
        author_icon_url: saved.author_icon_url ?? "",
        footer: saved.footer,
        thumbnail_url: saved.thumbnail_url,
        image_url: saved.image_url,
        fields: saved.fields.map((f) => ({ ...f })),
        enabled: saved.enabled,
        existingId: saved.id,
      });
    } else {
      setForm(defaultForm(key));
    }
    setImagesOpen(false);
    setFieldsOpen(true);
    setAuthorOpen(false);
    setVarsOpen(false);
  };

  // ── Reset ──
  const handleReset = () => {
    setForm(defaultForm(selectedKey));
    setResetDialogOpen(false);
  };

  // ── Field helpers ──
  const addField = () => {
    if (form.fields.length >= 10) return;
    setForm((f) => ({ ...f, fields: [...f.fields, { name: "", value: "", inline: false }] }));
  };
  const removeField = (idx: number) => {
    setForm((f) => ({ ...f, fields: f.fields.filter((_, i) => i !== idx) }));
  };
  const updateField = (idx: number, key: keyof EmbedField, val: string | boolean) => {
    setForm((f) => ({
      ...f,
      fields: f.fields.map((field, i) => (i === idx ? { ...field, [key]: val } : field)),
    }));
  };

  const currentEvent = EMBED_EVENTS.find((e) => e.key === selectedKey);

  return (
    <div className="flex flex-col lg:flex-row gap-0 h-[calc(100vh-8rem)]">
      {/* ── Left Panel: Event List ── */}
      <div className="lg:w-[280px] shrink-0 border-b lg:border-b-0 lg:border-r bg-card">
        {/* Mobile: dropdown selector */}
        <div className="lg:hidden p-3">
          <Select value={selectedKey} onValueChange={(v) => selectEvent(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn event...">
                {currentEvent && (() => {
                  const Icon = currentEvent.icon;
                  return (
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      {currentEvent.label}
                    </span>
                  );
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EVENT_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel className="text-xs uppercase tracking-wide">{group.label}</SelectLabel>
                  {group.keys.map((key) => {
                    const ev = EMBED_EVENTS.find((e) => e.key === key);
                    if (!ev) return null;
                    const Icon = ev.icon;
                    const saved = savedMap.has(ev.key);
                    return (
                      <SelectItem key={ev.key} value={ev.key}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          {ev.label}
                          {saved && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop: vertical list grouped by category */}
        <div className="hidden lg:flex flex-col p-3 gap-1 overflow-y-auto h-full">
          <div className="px-2 pb-2">
            <h2 className="text-sm font-semibold text-foreground">Embed Events</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Chọn event để tùy chỉnh</p>
          </div>
          {isLoading
            ? Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="p-3 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-36" />
                </div>
              ))
            : EVENT_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="px-2 pt-2 pb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {group.label}
                    </span>
                  </div>
                  {group.keys.map((key) => {
                    const ev = EMBED_EVENTS.find((e) => e.key === key);
                    if (!ev) return null;
                    const Icon = ev.icon;
                    const active = selectedKey === ev.key;
                    const saved = savedMap.has(ev.key);
                    return (
                      <button
                        key={ev.key}
                        onClick={() => selectEvent(ev.key)}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all w-full",
                          active
                            ? "border-primary/50 bg-primary/5 shadow-sm"
                            : "border-transparent hover:bg-muted/80"
                        )}
                      >
                        <div className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                          active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-sm font-medium truncate", active ? "text-foreground" : "text-muted-foreground")}>
                              {ev.label}
                            </span>
                            {saved ? (
                              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0 text-[10px] px-1.5 py-0 h-4 shrink-0">
                                Đã tùy chỉnh
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                                Mặc định
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{ev.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
        </div>
      </div>

      {/* ── Middle Panel: Editor ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 lg:p-6 space-y-5">
          {/* Section header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {currentEvent && (() => {
                const Icon = currentEvent.icon;
                return <Icon className="h-5 w-5 text-primary" />;
              })()}
              <h2 className="text-lg font-semibold">{currentEvent?.label}</h2>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetDialogOpen(true)}
                className="text-muted-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reset về mặc định
              </Button>
              <div className="flex items-center gap-2">
                <Label htmlFor="embed-enabled" className="text-sm text-muted-foreground cursor-pointer">
                  {form.enabled ? "Bật" : "Tắt"}
                </Label>
                <Switch
                  id="embed-enabled"
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="embed-title">Tiêu đề</Label>
            <Input
              id="embed-title"
              placeholder="Nhập tiêu đề embed..."
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="embed-desc">Mô tả</Label>
            <Textarea
              id="embed-desc"
              placeholder="Nhập mô tả embed..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              className="resize-y"
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Màu sắc</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="h-8 w-8 rounded cursor-pointer border-0 p-0"
              />
              <Input
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="w-28 font-mono text-sm"
                maxLength={7}
              />
              <div
                className="h-8 w-8 rounded-md border"
                style={{ backgroundColor: form.color }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="space-y-1.5">
            <Label htmlFor="embed-footer">Chân trang</Label>
            <Input
              id="embed-footer"
              placeholder="Nội dung chân trang"
              value={form.footer}
              onChange={(e) => setForm((f) => ({ ...f, footer: e.target.value }))}
            />
          </div>

          <Separator />

          {/* ── Collapsible: Author ── */}
          <div className="rounded-lg border">
            <button
              className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors rounded-lg"
              onClick={() => setAuthorOpen(!authorOpen)}
            >
              <span className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                Tác giả
              </span>
              {authorOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {authorOpen && (
              <div className="px-3 pb-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tên tác giả</Label>
                  <Input
                    placeholder="Tên tác giả (hiển thị phía trên tiêu đề)"
                    value={form.author}
                    onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Icon URL</Label>
                  <Input
                    placeholder="https://example.com/icon.png"
                    value={form.author_icon_url}
                    onChange={(e) => setForm((f) => ({ ...f, author_icon_url: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Collapsible: Images ── */}
          <div className="rounded-lg border">
            <button
              className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors rounded-lg"
              onClick={() => setImagesOpen(!imagesOpen)}
            >
              <span className="flex items-center gap-2">
                <Image className="h-4 w-4 text-muted-foreground" />
                Hình ảnh
              </span>
              {imagesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {imagesOpen && (
              <div className="px-3 pb-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Thumbnail URL</Label>
                  <Input
                    placeholder="https://example.com/thumb.png"
                    value={form.thumbnail_url}
                    onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Image URL</Label>
                  <Input
                    placeholder="https://example.com/image.png"
                    value={form.image_url}
                    onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Collapsible: Fields ── */}
          <div className="rounded-lg border">
            <button
              className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors rounded-lg"
              onClick={() => setFieldsOpen(!fieldsOpen)}
            >
              <span className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
                  {form.fields.length}
                </span>
                Fields
              </span>
              {fieldsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {fieldsOpen && (
              <div className="px-3 pb-3 space-y-3">
                {form.fields.map((field, i) => (
                  <div key={i} className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Field {i + 1}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeField(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Tên field"
                        value={field.name}
                        onChange={(e) => updateField(i, "name", e.target.value)}
                        className="text-sm"
                      />
                      <Input
                        placeholder="Giá trị"
                        value={field.value}
                        onChange={(e) => updateField(i, "value", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={field.inline}
                        onChange={(e) => updateField(i, "inline", e.target.checked)}
                        className="rounded border-input"
                      />
                      Inline (hiển thị cùng dòng)
                    </label>
                  </div>
                ))}
                {form.fields.length < 10 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addField}
                    className="w-full border-dashed"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Thêm field
                  </Button>
                )}
                {form.fields.length >= 10 && (
                  <p className="text-xs text-muted-foreground text-center">Đã đạt giới hạn 10 fields</p>
                )}
              </div>
            )}
          </div>

          {/* ── Variables Reference ── */}
          <div className="rounded-lg border bg-muted/20">
            <button
              className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors rounded-lg"
              onClick={() => setVarsOpen(!varsOpen)}
            >
              <span className="flex items-center gap-2">
                <Variable className="h-4 w-4 text-muted-foreground" />
                Variables
                <span className="text-xs text-muted-foreground font-normal">({VARIABLES.length} biến)</span>
              </span>
              {varsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {varsOpen && (
              <div className="px-3 pb-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {VARIABLES.map((v) => (
                    <div key={v.token} className="flex items-baseline gap-2 text-xs py-0.5">
                      <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-primary">
                        {v.token}
                      </code>
                      <span className="text-muted-foreground truncate">{v.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ── Save Button ── */}
          <Button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
            className="w-full"
            size="lg"
          >
            {saveMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </div>

      {/* ── Right Panel: Discord Preview ── */}
      {/* Mobile preview */}
      <div className="lg:hidden p-4 border-t">
        <h3 className="text-sm font-semibold mb-2">Xem trước Discord</h3>
        <DiscordPreview form={form} />
        <p className="text-[11px] text-muted-foreground italic mt-2">
          * Preview sử dụng dữ liệu giả để minh họa
        </p>
      </div>
      {/* Desktop preview */}
      <div className="hidden lg:flex lg:w-[400px] shrink-0 flex-col border-l bg-card">
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Xem trước Discord</h3>
            </div>
            <DiscordPreview form={form} />
            <p className="text-[11px] text-muted-foreground italic">
              * Preview sử dụng dữ liệu giả để minh họa
            </p>
          </div>
        </div>
      </div>

      {/* ── Reset Confirm Dialog ── */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset về mặc định?</AlertDialogTitle>
            <AlertDialogDescription>
              Embed &quot;{currentEvent?.label}&quot; sẽ được đặt lại về nội dung mặc định. Các thay đổi chưa lưu sẽ bị mất.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
