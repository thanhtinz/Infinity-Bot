import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ChevronDown, ChevronRight, Image, Variable,
  Ticket, TicketX, UserCheck, FileText, UserMinus, Ban,
  Clock, UserPlus2, Users, QrCode, Eye, Tag, UserX,
  ShieldOff, Pin, Mic, Medal, LayoutGrid, MessageSquare,
  UserRoundX, LogOut, Pencil, Volume2, VolumeX, ArrowRightLeft,
  LogIn, Hash, ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/EmojiPicker";

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
  { key: "qr_thanh_toan",     label: "QR Thanh toán",          icon: QrCode,       desc: "Gửi ảnh QR PayOS cho khách" },
  { key: "thanh_toan",        label: "Thanh toán thành công",  icon: CheckCircle,  desc: "Khi PayOS webhook PAID" },
  { key: "giao_hang",         label: "Giao hàng",              icon: Package,      desc: "Khi admin giao hàng" },
  { key: "don_hang_het_han",  label: "Đơn hàng hết hạn",      icon: Timer,        desc: "Khi đơn quá 15 phút chưa thanh toán" },
  { key: "don_hang_chi_tiet", label: "Chi tiết đơn hàng",      icon: Eye,          desc: "Khi xem thông tin 1 đơn hàng" },
  { key: "san_pham",          label: "Thông tin sản phẩm",     icon: Package,      desc: "Embed hiển thị sản phẩm" },
  { key: "coupon",            label: "Mã giảm giá",            icon: Tag,          desc: "Khi tạo/áp dụng coupon" },
  { key: "ban_shop",          label: "Cấm mua hàng",           icon: UserX,        desc: "Khi user bị cấm mua hàng" },
  { key: "unban_shop",        label: "Bỏ cấm mua hàng",       icon: ShieldOff,    desc: "Khi user được bỏ cấm shop" },
  { key: "feedback",          label: "Feedback khách hàng",    icon: Star,         desc: "Khi user dùng /feedback" },
  { key: "giveaway",          label: "Giveaway bắt đầu",       icon: Gift,         desc: "Khi tạo /giveaway" },
  { key: "ket_qua_giveaway",  label: "Kết quả Giveaway",       icon: Trophy,       desc: "Khi giveaway kết thúc, công bố winner" },
  { key: "giveaway_banned",   label: "Cấm Giveaway",           icon: UserRoundX,   desc: "Khi user bị cấm tham gia giveaway" },

  { key: "canh_bao",          label: "Cảnh báo thành viên",    icon: ShieldAlert,  desc: "Khi admin dùng /warn" },
  { key: "ticket_mo",         label: "Mở Ticket",              icon: Ticket,       desc: "Khi user tạo ticket mới" },
  { key: "ticket_dong",       label: "Đóng Ticket",            icon: TicketX,      desc: "Khi ticket bị đóng" },
  { key: "ticket_nhan",       label: "Nhận Ticket",            icon: UserCheck,    desc: "Khi staff nhận ticket (claim)" },
  { key: "ticket_unclaim",    label: "Bỏ nhận Ticket",         icon: UserMinus,    desc: "Khi staff bỏ claim ticket" },
  { key: "ticket_transcript", label: "Transcript",             icon: FileText,     desc: "Khi xuất transcript ticket" },
  { key: "ticket_panel",      label: "Panel Ticket",           icon: LayoutGrid,   desc: "Embed panel chứa buttons tạo ticket" },
  { key: "ticket_feedback",   label: "Feedback Ticket",        icon: MessageSquare, desc: "Yêu cầu đánh giá sau đóng ticket" },
  { key: "kick",              label: "Kick thành viên",        icon: UserMinus,    desc: "Khi bot kick user" },
  { key: "ban",               label: "Ban thành viên",         icon: Ban,          desc: "Khi bot ban user" },
  { key: "unban",             label: "Unban thành viên",       icon: ShieldOff,    desc: "Khi bot unban user" },
  { key: "timeout",           label: "Timeout thành viên",     icon: Clock,        desc: "Khi bot timeout user" },
  { key: "invite_join",       label: "Tham gia qua Invite",    icon: UserPlus2,    desc: "Khi user join qua link invite" },
  { key: "invite_leaderboard",label: "BXH Mời",               icon: Medal,        desc: "Embed bảng xếp hạng invite" },
  { key: "sticky_message",    label: "Sticky Message",         icon: Pin,          desc: "Nội dung sticky gửi trong channel" },
  { key: "tempvoice_create",  label: "Tạo Voice tạm",         icon: Mic,          desc: "Khi user tạo temp voice channel" },
  // Phase 3
  { key: "dm_welcome",        label: "DM Chào mừng",          icon: MessageSquare, desc: "Tin nhắn DM khi member join" },
  // Phase 4 — Logging
  { key: "log_message_delete",     label: "Log: Xóa tin nhắn",       icon: Trash2,          desc: "Khi tin nhắn bị xóa" },
  { key: "log_message_edit",       label: "Log: Sửa tin nhắn",       icon: Pencil,          desc: "Khi tin nhắn được sửa" },
  { key: "log_message_bulk_delete",label: "Log: Xóa hàng loạt",      icon: Trash2,          desc: "Khi xóa nhiều tin nhắn cùng lúc" },
  { key: "log_voice_join",         label: "Log: Vào voice",           icon: Volume2,         desc: "Khi user vào voice channel" },
  { key: "log_voice_leave",        label: "Log: Rời voice",           icon: VolumeX,         desc: "Khi user rời voice channel" },
  { key: "log_voice_move",         label: "Log: Chuyển voice",        icon: ArrowRightLeft,  desc: "Khi user chuyển voice channel" },
  { key: "log_member_join",        label: "Log: Thành viên mới",      icon: LogIn,           desc: "Khi member tham gia server" },
  { key: "log_member_leave",       label: "Log: Thành viên rời",      icon: LogOut,          desc: "Khi member rời server" },
  { key: "log_nickname_change",    label: "Log: Đổi nickname",        icon: Pencil,          desc: "Khi member đổi nickname" },
  { key: "log_role_update",        label: "Log: Thay đổi role",       icon: ShieldAlert,     desc: "Khi role của member thay đổi" },
  { key: "log_channel_create",     label: "Log: Tạo kênh",            icon: Hash,            desc: "Khi kênh mới được tạo" },
  { key: "log_channel_delete",     label: "Log: Xóa kênh",            icon: Hash,            desc: "Khi kênh bị xóa" },
];

// ─── Event groups ────────────────────────────────────────────────────────────

const EVENT_GROUPS: { label: string; keys: string[] }[] = [
  { label: "Đơn hàng",    keys: ["don_hang_moi", "qr_thanh_toan", "thanh_toan", "giao_hang", "don_hang_het_han", "don_hang_chi_tiet", "san_pham", "coupon", "ban_shop", "unban_shop"] },
  { label: "Cộng đồng",   keys: ["giveaway", "ket_qua_giveaway", "giveaway_banned", "feedback", "dm_welcome"] },
  { label: "Ticket",      keys: ["ticket_mo", "ticket_dong", "ticket_nhan", "ticket_unclaim", "ticket_transcript", "ticket_panel", "ticket_feedback"] },
  { label: "Kiểm duyệt", keys: ["canh_bao", "kick", "ban", "unban", "timeout", "invite_join", "invite_leaderboard"] },
  { label: "Tiện ích",    keys: ["sticky_message", "tempvoice_create"] },
  { label: "Logging",     keys: ["log_message_delete", "log_message_edit", "log_message_bulk_delete", "log_voice_join", "log_voice_leave", "log_voice_move", "log_member_join", "log_member_leave", "log_nickname_change", "log_role_update", "log_channel_create", "log_channel_delete"] },
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
  qr_thanh_toan: {
    title: "💳 Thanh toán đơn hàng #{order.id}",
    description: "Quét mã QR bên dưới để thanh toán.\nĐơn hàng sẽ hết hạn sau **15 phút**.",
    color: "#5865F2",
    author: "",
    author_icon_url: "",
    footer: "Quét QR bằng app ngân hàng",
    thumbnail_url: "",
    image_url: "{qr_url}",
    fields: [
      { name: "Số tiền", value: "{order.total} VNĐ", inline: true },
      { name: "Nội dung CK", value: "{transfer_content}", inline: true },
    ],
    enabled: true,
  },
  don_hang_chi_tiet: {
    title: "📋 Chi tiết đơn hàng #{order.id}",
    description: "Thông tin chi tiết đơn hàng.",
    color: "#5865F2",
    author: "",
    author_icon_url: "",
    footer: "",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Khách hàng", value: "{user.mention}", inline: true },
      { name: "Trạng thái", value: "{order.status}", inline: true },
      { name: "Sản phẩm", value: "{product.name}", inline: false },
      { name: "Số tiền", value: "{order.total} VNĐ", inline: true },
      { name: "Ngày tạo", value: "{order.created_at}", inline: true },
    ],
    enabled: true,
  },
  san_pham: {
    title: "🛍️ {product.name}",
    description: "{product.description}",
    color: "#5865F2",
    author: "",
    author_icon_url: "",
    footer: "",
    thumbnail_url: "{product.image_url}",
    image_url: "",
    fields: [
      { name: "Giá", value: "{product.price} VNĐ", inline: true },
      { name: "Tồn kho", value: "{product.stock}", inline: true },
    ],
    enabled: true,
  },
  coupon: {
    title: "🏷️ Mã giảm giá",
    description: "Mã **{coupon.code}** đã được áp dụng!",
    color: "#FEE75C",
    author: "",
    author_icon_url: "",
    footer: "",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Giảm", value: "{coupon.discount}", inline: true },
      { name: "Hạn sử dụng", value: "{coupon.expires_at}", inline: true },
    ],
    enabled: true,
  },
  ban_shop: {
    title: "🚫 Cấm mua hàng",
    description: "{user.mention} đã bị cấm mua hàng.",
    color: "#ED4245",
    author: "",
    author_icon_url: "",
    footer: "",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Lý do", value: "{reason}", inline: false },
      { name: "Người thực hiện", value: "{moderator}", inline: true },
    ],
    enabled: true,
  },
  unban_shop: {
    title: "✅ Bỏ cấm mua hàng",
    description: "{user.mention} đã được bỏ cấm mua hàng.",
    color: "#57F287",
    author: "",
    author_icon_url: "",
    footer: "",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Người thực hiện", value: "{moderator}", inline: true },
    ],
    enabled: true,
  },
  giveaway_banned: {
    title: "⛔ Cấm tham gia Giveaway",
    description: "{user.mention} đã bị cấm tham gia giveaway.",
    color: "#ED4245",
    author: "",
    author_icon_url: "",
    footer: "",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Lý do", value: "{reason}", inline: false },
    ],
    enabled: true,
  },
  unban: {
    title: "🔓 Unban thành viên",
    description: "{user.mention} đã được unban.",
    color: "#57F287",
    author: "",
    author_icon_url: "",
    footer: "",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Người thực hiện", value: "{moderator}", inline: true },
    ],
    enabled: true,
  },
  ticket_unclaim: {
    title: "↩️ Bỏ nhận Ticket",
    description: "{staff.mention} đã bỏ nhận ticket này.",
    color: "#95A5A6",
    author: "",
    author_icon_url: "",
    footer: "Ticket #{ticket.id}",
    thumbnail_url: "",
    image_url: "",
    fields: [],
    enabled: true,
  },
  ticket_panel: {
    title: "🎫 Hỗ trợ",
    description: "Chọn loại hỗ trợ bên dưới để tạo ticket.",
    color: "#5865F2",
    author: "",
    author_icon_url: "",
    footer: "",
    thumbnail_url: "",
    image_url: "",
    fields: [],
    enabled: true,
  },
  ticket_feedback: {
    title: "⭐ Đánh giá hỗ trợ",
    description: "Ticket #{ticket.id} đã được đóng.\nVui lòng đánh giá chất lượng hỗ trợ!",
    color: "#FEE75C",
    author: "",
    author_icon_url: "",
    footer: "",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "Staff", value: "{staff.mention}", inline: true },
    ],
    enabled: true,
  },
  invite_leaderboard: {
    title: "🏆 Bảng xếp hạng mời",
    description: "Top người mời nhiều nhất server.",
    color: "#FEE75C",
    author: "",
    author_icon_url: "",
    footer: "Cập nhật lúc {date}",
    thumbnail_url: "",
    image_url: "",
    fields: [
      { name: "🥇 Top 1", value: "{top1}", inline: true },
      { name: "🥈 Top 2", value: "{top2}", inline: true },
      { name: "🥉 Top 3", value: "{top3}", inline: true },
    ],
    enabled: true,
  },
  sticky_message: {
    title: "{sticky.title}",
    description: "{sticky.content}",
    color: "#5865F2",
    author: "",
    author_icon_url: "",
    footer: "Sticky Message",
    thumbnail_url: "",
    image_url: "",
    fields: [],
    enabled: true,
  },
  tempvoice_create: {
    title: "🔊 Voice tạm đã tạo",
    description: "{user.mention} đã tạo kênh voice **{channel.name}**.",
    color: "#5865F2",
    author: "", author_icon_url: "", footer: "", thumbnail_url: "", image_url: "",
    fields: [],
    enabled: true,
  },
  dm_welcome: {
    title: "👋 Chào mừng!",
    description: "Xin chào {user.mention}! Cảm ơn bạn đã tham gia **{server}**.",
    color: "#5865F2",
    author: "", author_icon_url: "", footer: "", thumbnail_url: "", image_url: "",
    fields: [],
    enabled: true,
  },
  log_message_delete: {
    title: "🗑️ Tin nhắn bị xóa",
    description: "Tin nhắn của {user.mention} trong {channel} đã bị xóa.",
    color: "#ED4245",
    author: "", author_icon_url: "", footer: "", thumbnail_url: "", image_url: "",
    fields: [{ name: "Nội dung", value: "{content}", inline: false }],
    enabled: true,
  },
  log_message_edit: {
    title: "✏️ Tin nhắn được sửa",
    description: "{user.mention} đã sửa tin nhắn trong {channel}.",
    color: "#FEE75C",
    author: "", author_icon_url: "", footer: "", thumbnail_url: "", image_url: "",
    fields: [
      { name: "Trước", value: "{before}", inline: false },
      { name: "Sau", value: "{after}", inline: false },
    ],
    enabled: true,
  },
  log_message_bulk_delete: {
    title: "🗑️ Xóa hàng loạt",
    description: "**{count}** tin nhắn đã bị xóa trong {channel}.",
    color: "#ED4245",
    author: "", author_icon_url: "", footer: "", thumbnail_url: "", image_url: "",
    fields: [],
    enabled: true,
  },
  log_voice_join: {
    title: "🔊 Vào voice",
    description: "{user.mention} đã vào {channel}.",
    color: "#57F287",
    author: "", author_icon_url: "", footer: "", thumbnail_url: "", image_url: "",
    fields: [],
    enabled: true,
  },
  log_voice_leave: {
    title: "🔇 Rời voice",
    description: "{user.mention} đã rời {channel}.",
    color: "#ED4245",
    author: "", author_icon_url: "", footer: "", thumbnail_url: "", image_url: "",
    fields: [],
    enabled: true,
  },
  log_voice_move: {
    title: "🔀 Chuyển voice",
    description: "{user.mention} đã chuyển từ {from} sang {to}.",
    color: "#FEE75C",
    author: "", author_icon_url: "", footer: "", thumbnail_url: "", image_url: "",
    fields: [],
    enabled: true,
  },
  log_member_join: {
    title: "📥 Thành viên mới",
    description: "{user.mention} đã tham gia server.",
    color: "#57F287",
    author: "", author_icon_url: "", footer: "", thumbnail_url: "", image_url: "",
    fields: [
      { name: "Tạo tài khoản", value: "{account_age}", inline: true },
      { name: "Thành viên thứ", value: "{member_count}", inline: true },
    ],
    enabled: true,
  },
  log_member_leave: {
    title: "📤 Thành viên rời",
    description: "{user.mention} đã rời server.",
    color: "#ED4245",
    author: "", author_icon_url: "", footer: "", thumbnail_url: "", image_url: "",
    fields: [
      { name: "Roles", value: "{roles}", inline: false },
      { name: "Còn lại", value: "{member_count} thành viên", inline: true },
    ],
    enabled: true,
  },
  log_nickname_change: {
    title: "📝 Đổi nickname",
    description: "{user.mention} đã đổi nickname.",
    color: "#5865F2",
    author: "", author_icon_url: "", footer: "", thumbnail_url: "", image_url: "",
    fields: [
      { name: "Trước", value: "{before}", inline: true },
      { name: "Sau", value: "{after}", inline: true },
    ],
    enabled: true,
  },
  log_role_update: {
    title: "🎭 Thay đổi role",
    description: "Role của {user.mention} đã được thay đổi.",
    color: "#5865F2",
    author: "", author_icon_url: "", footer: "", thumbnail_url: "", image_url: "",
    fields: [{ name: "Thay đổi", value: "{changes}", inline: false }],
    enabled: true,
  },
  log_channel_create: {
    title: "📺 Kênh mới",
    description: "Kênh {channel} ({type}) đã được tạo.",
    color: "#57F287",
    author: "", author_icon_url: "", footer: "", thumbnail_url: "", image_url: "",
    fields: [],
    enabled: true,
  },
  log_channel_delete: {
    title: "📺 Kênh bị xóa",
    description: "Kênh **{channel.name}** ({type}) đã bị xóa.",
    color: "#ED4245",
    author: "", author_icon_url: "", footer: "", thumbnail_url: "", image_url: "",
    fields: [],
    enabled: true,
  },
};

// ─── Variables reference ─────────────────────────────────────────────────────

const VARIABLES: { token: string; desc: string }[] = [
  { token: "{user}",              desc: "Tên người dùng" },
  { token: "{user.mention}",      desc: "@mention người dùng" },
  { token: "{user.id}",           desc: "Discord ID" },
  { token: "{order.id}",          desc: "Mã đơn hàng (#12345)" },
  { token: "{order.total}",       desc: "Tổng tiền (100,000)" },
  { token: "{order.status}",      desc: "Trạng thái đơn hàng" },
  { token: "{order.created_at}",  desc: "Ngày tạo đơn" },
  { token: "{product.name}",      desc: "Tên sản phẩm" },
  { token: "{product.description}", desc: "Mô tả sản phẩm" },
  { token: "{product.price}",     desc: "Giá sản phẩm" },
  { token: "{product.stock}",     desc: "Số lượng tồn kho" },
  { token: "{product.image_url}", desc: "Ảnh sản phẩm" },
  { token: "{qr_url}",            desc: "URL ảnh QR thanh toán" },
  { token: "{transfer_content}",  desc: "Nội dung chuyển khoản" },
  { token: "{coupon.code}",       desc: "Mã coupon" },
  { token: "{coupon.discount}",   desc: "Giá trị giảm giá" },
  { token: "{coupon.expires_at}", desc: "Hạn sử dụng coupon" },
  { token: "{package}",           desc: "Nội dung gói (cho đơn custom)" },
  { token: "{date}",              desc: "Ngày giờ hiện tại" },
  { token: "{server}",            desc: "Tên server" },
  { token: "{member_count}",      desc: "Số thành viên" },
  { token: "{prize}",             desc: "Phần thưởng (giveaway)" },
  { token: "{ends_at}",           desc: "Thời gian kết thúc (giveaway)" },
  { token: "{host}",              desc: "Người tổ chức (giveaway)" },
  { token: "{winners_count}",     desc: "Số người thắng (giveaway)" },
  { token: "{winners}",           desc: "Tên người thắng (ket_qua_giveaway)" },
  { token: "{reason}",            desc: "Lý do (warn/ban/kick/cấm)" },
  { token: "{warn_count}",        desc: "Tổng số cảnh báo" },
  { token: "{moderator}",         desc: "Người thực hiện (mod)" },
  { token: "{stars}",             desc: "Số sao (feedback)" },
  { token: "{content}",           desc: "Nội dung feedback" },
  { token: "{ticket.id}",         desc: "ID ticket" },
  { token: "{close_reason}",      desc: "Lý do đóng ticket" },
  { token: "{staff.mention}",     desc: "Staff nhận ticket" },
  { token: "{duration}",          desc: "Thời gian timeout" },
  { token: "{mod}",               desc: "Tên mod thực hiện" },
  { token: "{invite_code}",       desc: "Mã invite" },
  { token: "{inviter}",           desc: "Người mời" },
  { token: "{top1}",              desc: "Top 1 BXH mời" },
  { token: "{top2}",              desc: "Top 2 BXH mời" },
  { token: "{top3}",              desc: "Top 3 BXH mời" },
  { token: "{sticky.title}",      desc: "Tiêu đề sticky" },
  { token: "{sticky.content}",    desc: "Nội dung sticky" },
  { token: "{channel.name}",      desc: "Tên kênh voice" },
  { token: "{channel}",           desc: "Mention kênh (log)" },
  { token: "{before}",            desc: "Nội dung trước (edit/nick)" },
  { token: "{after}",             desc: "Nội dung sau (edit/nick)" },
  { token: "{message.url}",       desc: "Link tin nhắn" },
  { token: "{count}",             desc: "Số lượng (bulk delete)" },
  { token: "{from}",              desc: "Kênh voice cũ" },
  { token: "{to}",                desc: "Kênh voice mới" },
  { token: "{account_age}",       desc: "Thời gian tạo tài khoản" },
  { token: "{roles}",             desc: "Danh sách role" },
  { token: "{changes}",           desc: "Thay đổi role" },
  { token: "{type}",              desc: "Loại kênh" },
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
  const [embedOpen, setEmbedOpen] = useState(true);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(true);
  const [authorOpen, setAuthorOpen] = useState(false);
  const [varsOpen, setVarsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* ── Top Bar: Event selector + controls ── */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 px-4 py-2.5 border-b bg-card">
        <div className="w-full sm:w-64 shrink-0">
          <Select value={selectedKey} onValueChange={(v) => selectEvent(v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Chọn event...">
                {currentEvent && (() => {
                  const Icon = currentEvent.icon;
                  return (
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      {currentEvent.label}
                      {savedMap.has(selectedKey) && (
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0 text-[10px] px-1.5 py-0 h-4">
                          Tùy chỉnh
                        </Badge>
                      )}
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

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResetDialogOpen(true)}
            className="text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "..." : "Lưu"}
          </Button>
        </div>
      </div>

      {/* ── Single-column Discohook-style Editor ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-3">

          {/* ── Embed Section — collapsible card with colored left border ── */}
          <div className="rounded-lg border overflow-hidden" style={{ borderLeftWidth: 4, borderLeftColor: form.color || "#5865F2" }}>
            <div
              role="button"
              tabIndex={0}
              className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors cursor-pointer select-none"
              onClick={() => setEmbedOpen(!embedOpen)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEmbedOpen(!embedOpen); } }}
            >
              <span className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", embedOpen && "rotate-180")} />
                Embed — {form.title || "Không có tiêu đề"}
              </span>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Label htmlFor="embed-enabled" className="text-xs text-muted-foreground cursor-pointer">
                  {form.enabled ? "Bật" : "Tắt"}
                </Label>
                <Switch
                  id="embed-enabled"
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                />
              </div>
            </div>
            {embedOpen && (
              <div className="px-4 pb-4 space-y-4">
                {/* Title */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tiêu đề</Label>
                  <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                    <Input
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      placeholder="Nhập tiêu đề embed..."
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    />
                    <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, title: f.title + em }))} />
                  </div>
                </div>
                {/* Description with char count */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Mô tả</Label>
                    <span className="text-[11px] text-muted-foreground">{form.description.length}/4096</span>
                  </div>
                  <div className="flex items-start rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                    <Textarea
                      placeholder="Nhập mô tả embed..."
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      rows={5}
                      className="resize-y flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, description: f.description + em }))} />
                  </div>
                </div>
                {/* Color */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Màu sắc</Label>
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
                      className="w-28 font-mono text-xs"
                      maxLength={7}
                    />
                  </div>
                </div>
                {/* Footer with char count */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Chân trang</Label>
                    <span className="text-[11px] text-muted-foreground">{form.footer.length}/2048</span>
                  </div>
                  <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                    <Input
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      placeholder="Nội dung chân trang"
                      value={form.footer}
                      onChange={(e) => setForm((f) => ({ ...f, footer: e.target.value }))}
                    />
                    <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, footer: f.footer + em }))} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Author — collapsible, no colored border ── */}
          <div className="rounded-lg border">
            <button
              type="button"
              className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
              onClick={() => setAuthorOpen(!authorOpen)}
            >
              <span className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", authorOpen && "rotate-180")} />
                Tác giả
              </span>
            </button>
            {authorOpen && (
              <div className="px-4 pb-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tên tác giả</Label>
                  <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                    <Input
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      placeholder="Tên tác giả (hiển thị phía trên tiêu đề)"
                      value={form.author}
                      onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                    />
                    <EmojiPicker onSelect={(em) => setForm((f) => ({ ...f, author: f.author + em }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Icon URL</Label>
                  <Input
                    placeholder="https://example.com/icon.png"
                    value={form.author_icon_url}
                    onChange={(e) => setForm((f) => ({ ...f, author_icon_url: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Images — collapsible ── */}
          <div className="rounded-lg border">
            <button
              type="button"
              className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
              onClick={() => setImagesOpen(!imagesOpen)}
            >
              <span className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", imagesOpen && "rotate-180")} />
                Hình ảnh
              </span>
            </button>
            {imagesOpen && (
              <div className="px-4 pb-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Thumbnail URL</Label>
                  <Input
                    placeholder="https://example.com/thumb.png"
                    value={form.thumbnail_url}
                    onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Image URL</Label>
                  <Input
                    placeholder="https://example.com/image.png"
                    value={form.image_url}
                    onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Fields — collapsible, with count badge ── */}
          <div className="rounded-lg border">
            <button
              type="button"
              className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
              onClick={() => setFieldsOpen(!fieldsOpen)}
            >
              <span className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", fieldsOpen && "rotate-180")} />
                Fields ({form.fields.length}/25)
              </span>
            </button>
            {fieldsOpen && (
              <div className="px-4 pb-4 space-y-3">
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
                      <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                        <Input
                          placeholder="Tên field"
                          value={field.name}
                          onChange={(e) => updateField(i, "name", e.target.value)}
                          className="text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <EmojiPicker onSelect={(em) => updateField(i, "name", field.name + em)} />
                      </div>
                      <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                        <Input
                          placeholder="Giá trị"
                          value={field.value}
                          onChange={(e) => updateField(i, "value", e.target.value)}
                          className="text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <EmojiPicker onSelect={(em) => updateField(i, "value", field.value + em)} />
                      </div>
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
                {form.fields.length < 25 && (
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
                {form.fields.length >= 25 && (
                  <p className="text-xs text-muted-foreground text-center">Đã đạt giới hạn 25 fields</p>
                )}
              </div>
            )}
          </div>

          {/* ── Variables — collapsible ── */}
          <div className="rounded-lg border">
            <button
              type="button"
              className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
              onClick={() => setVarsOpen(!varsOpen)}
            >
              <span className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", varsOpen && "rotate-180")} />
                Biến hỗ trợ
                <span className="text-xs text-muted-foreground font-normal">({VARIABLES.length})</span>
              </span>
            </button>
            {varsOpen && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
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

          {/* ── Discord Preview — collapsible, always last ── */}
          <div className="rounded-lg border">
            <button
              type="button"
              className="flex w-full items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
              onClick={() => setShowPreview(!showPreview)}
            >
              <span className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", showPreview && "rotate-180")} />
                Xem trước Discord
              </span>
            </button>
            {showPreview && (
              <div className="p-4">
                <DiscordPreview form={form} />
                <p className="text-[11px] text-muted-foreground italic mt-3">* Preview sử dụng dữ liệu giả</p>
              </div>
            )}
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
