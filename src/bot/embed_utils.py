"""
embed_utils.py — Load embed templates từ DB và build discord.Embed với variable substitution.

Dùng trong tất cả bot cogs:
    from src.bot.embed_utils import build_embed, DEFAULTS

    embed = build_embed("don_hang_moi", db_session, vars={...})
"""
import datetime
import discord
from sqlalchemy import select
from sqlalchemy.orm import Session


# ── Default templates (dùng khi chưa có tùy chỉnh trong DB) ──────────────

DEFAULTS: dict[str, dict] = {
    "don_hang_moi": {
        "title": "🛒 Đơn hàng mới",
        "description": "Vui lòng thanh toán để hoàn tất đơn hàng.\n⏰ Hết hạn sau **15 phút**.",
        "color": "#F0B232",
        "footer": "⏳ Đang chờ thanh toán...",
        "fields": [
            {"name": "🔢 ID Đơn", "value": "#{order.id}", "inline": True},
            {"name": "👤 Khách hàng", "value": "{user.mention}", "inline": True},
            {"name": "📦 Sản phẩm", "value": "{product.name}", "inline": False},
            {"name": "💰 Số tiền", "value": "{order.total} VNĐ", "inline": True},
        ],
    },
    "thanh_toan": {
        "title": "✅ Thanh toán thành công",
        "description": "Cảm ơn {user.mention}! Đơn hàng #{order.id} đã được thanh toán.",
        "color": "#57F287",
        "footer": "Infinity Mall",
        "fields": [
            {"name": "📦 Sản phẩm", "value": "{product.name}", "inline": True},
            {"name": "💰 Số tiền", "value": "{order.total} VNĐ", "inline": True},
        ],
    },
    "giao_hang": {
        "title": "📦 Đơn hàng đã được giao",
        "description": "Đơn hàng #{order.id} của bạn đã được giao thành công!",
        "color": "#5865F2",
        "footer": "Infinity Mall — Cảm ơn bạn đã mua hàng!",
        "fields": [
            {"name": "📦 Sản phẩm", "value": "{product.name}", "inline": True},
            {"name": "📅 Ngày giao", "value": "{date}", "inline": True},
        ],
    },
    "feedback": {
        "title": "⭐ Feedback mới",
        "description": "**{user}** đã gửi đánh giá cho **{product.name}**",
        "color": "#FEE75C",
        "footer": "Infinity Mall — Feedback system",
        "fields": [
            {"name": "Xếp hạng", "value": "{stars}", "inline": True},
            {"name": "Nội dung", "value": "{content}", "inline": False},
        ],
    },
    "giveaway": {
        "title": "🎉 GIVEAWAY",
        "description": "{prize}\n\nNhấn nút bên dưới để tham gia!\n⏰ Kết thúc: {ends_at}",
        "color": "#EB459E",
        "footer": "Host: {host} • Số người thắng: {winners_count}",
        "fields": [],
    },
    "welcome": {
        "title": "👋 Chào mừng đến với {server}!",
        "description": "Xin chào {user.mention}! Chúc bạn có thời gian vui vẻ tại server.\n\nDùng `/help` để xem danh sách lệnh bot.",
        "color": "#5865F2",
        "footer": "Infinity Mall",
        "fields": [
            {"name": "Thành viên thứ", "value": "{member_count}", "inline": True},
        ],
    },
    "don_hang_het_han": {
        "title": "⏰ Đơn hàng đã hết hạn",
        "description": "Đơn hàng #{order.id} của bạn đã hết hạn do chưa thanh toán sau 15 phút.",
        "color": "#ED4245",
        "footer": "Tạo đơn mới để tiếp tục mua hàng.",
        "fields": [
            {"name": "📦 Sản phẩm", "value": "{product.name}", "inline": True},
        ],
    },
    "ghi_chu_don_hang": {
        "title": "📝 Ghi chú đơn hàng",
        "description": "Đơn hàng #{order.id} của {user.mention} vừa được cập nhật ghi chú.",
        "color": "#5865F2",
        "footer": "Infinity Mall",
        "fields": [
            {"name": "📦 Sản phẩm", "value": "{product.name}", "inline": True},
            {"name": "📝 Ghi chú", "value": "{note}", "inline": False},
        ],
    },
    "ket_qua_giveaway": {
        "title": "🏆 Kết quả Giveaway",
        "description": "Giveaway đã kết thúc!\nPhần thưởng: **{prize}**",
        "color": "#EB459E",
        "footer": "Chúc mừng người chiến thắng!",
        "fields": [
            {"name": "🎉 Người thắng", "value": "{winners}", "inline": False},
        ],
    },
    "canh_bao": {
        "title": "⚠️ Cảnh báo",
        "description": "{user.mention} đã nhận cảnh báo từ ban quản trị.",
        "color": "#FEE75C",
        "footer": "Hãy tuân thủ nội quy server",
        "fields": [
            {"name": "📋 Lý do", "value": "{reason}", "inline": False},
            {"name": "🔢 Tổng cảnh báo", "value": "{warn_count}", "inline": True},
        ],
    },
    # ── Ticket System ─────────────────────────────────────────────────────────
    "ticket_mo": {
        "title": "🎫 Ticket đã được tạo",
        "description": "Ticket **#{ticket.id}** của {user.mention} đã được tạo.\nStaff sẽ hỗ trợ bạn sớm nhất có thể.",
        "color": "#5865F2",
        "footer": "Dùng nút bên dưới để đóng ticket",
        "fields": [
            {"name": "📋 Chủ đề", "value": "{ticket.subject}", "inline": True},
            {"name": "🔢 Mã ticket", "value": "#{ticket.id}", "inline": True},
        ],
    },
    "ticket_dong": {
        "title": "🔒 Ticket đã đóng",
        "description": "Ticket **#{ticket.id}** đã được đóng bởi {closer.mention}.",
        "color": "#ED4245",
        "footer": "Dùng nút Mở lại để tiếp tục nếu cần",
        "fields": [
            {"name": "📋 Lý do", "value": "{reason}", "inline": False},
            {"name": "⏱️ Thời gian xử lý", "value": "{duration}", "inline": True},
        ],
    },
    "ticket_nhan": {
        "title": "✋ Ticket đã được nhận",
        "description": "{staff.mention} đã nhận ticket **#{ticket.id}** và đang xử lý.",
        "color": "#57F287",
        "footer": "Vui lòng mô tả vấn đề chi tiết",
        "fields": [
            {"name": "👮 Staff", "value": "{staff.name}", "inline": True},
        ],
    },
    "ticket_transcript": {
        "title": "📄 Transcript Ticket",
        "description": "Transcript của ticket **#{ticket.id}** đã được lưu.",
        "color": "#5865F2",
        "footer": "Infinity Mall — Support System",
        "fields": [
            {"name": "👤 Tạo bởi", "value": "{user.name}", "inline": True},
            {"name": "💬 Số tin nhắn", "value": "{message_count}", "inline": True},
        ],
    },
    # ── Moderation ────────────────────────────────────────────────────────────
    "kick": {
        "title": "👟 Đã bị kick",
        "description": "{user.mention} đã bị kick khỏi server **{server}**.",
        "color": "#ED4245",
        "footer": "Hành động được thực hiện bởi ban quản trị",
        "fields": [
            {"name": "📋 Lý do", "value": "{reason}", "inline": False},
            {"name": "👮 Mod", "value": "{mod.name}", "inline": True},
        ],
    },
    "ban": {
        "title": "🔨 Đã bị ban",
        "description": "{user.mention} đã bị ban vĩnh viễn khỏi server **{server}**.",
        "color": "#ED4245",
        "footer": "Kháng cáo nếu bạn cho rằng đây là nhầm lẫn",
        "fields": [
            {"name": "📋 Lý do", "value": "{reason}", "inline": False},
            {"name": "👮 Mod", "value": "{mod.name}", "inline": True},
        ],
    },
    "timeout": {
        "title": "⏱️ Bị timeout",
        "description": "{user.mention} đã bị timeout trong server **{server}**.",
        "color": "#FEE75C",
        "footer": "Hãy tuân thủ nội quy server",
        "fields": [
            {"name": "⏰ Thời gian", "value": "{duration}", "inline": True},
            {"name": "📋 Lý do", "value": "{reason}", "inline": False},
        ],
    },
    # ── Invite / Community ────────────────────────────────────────────────────
    "invite_join": {
        "title": "🎉 Thành viên mới từ invite",
        "description": "{user.mention} đã tham gia qua link của **{inviter.name}**!",
        "color": "#57F287",
        "footer": "Infinity Mall — Invite Tracking",
        "fields": [
            {"name": "🔗 Code invite", "value": "{invite.code}", "inline": True},
            {"name": "📊 Tổng invite của {inviter.name}", "value": "{inviter.total_invites}", "inline": True},
        ],
    },
    "leaderboard": {
        "title": "🏆 Bảng xếp hạng Invite",
        "description": "Top thành viên có nhiều lượt invite nhất trong **{server}**.",
        "color": "#F0B232",
        "footer": "Cập nhật: {updated_at}",
        "fields": [],
    },
    # Alias for dashboard compatibility
    "invite_leaderboard": {
        "title": "🏆 Bảng xếp hạng Invite",
        "description": "Top thành viên có nhiều lượt invite nhất trong **{server}**.",
        "color": "#F0B232",
        "footer": "Cập nhật: {updated_at}",
        "fields": [],
    },
    # ── BXH Chi tiêu / Đơn hàng ─────────────────────────────────────────────
    "bxh_chi_tieu": {
        "title": "🏆 BXH Chi tiêu — {time_label}",
        "description": "{leaderboard_lines}",
        "color": "#F0B232",
        "footer": "Cập nhật: {updated_at}",
        "fields": [],
    },
    "bxh_don_hang": {
        "title": "🏆 BXH Đơn hàng — {time_label}",
        "description": "{leaderboard_lines}",
        "color": "#F0B232",
        "footer": "Cập nhật: {updated_at}",
        "fields": [],
    },
    # ── QR / Payment ──────────────────────────────────────────────────────────
    "qr_thanh_toan": {
        "title": "💳 Thanh toán đơn hàng #{order.id}",
        "description": "Quét mã QR bên dưới để thanh toán.\nĐơn hàng sẽ hết hạn sau **15 phút**.",
        "color": "#5865F2",
        "footer": "Quét QR bằng app ngân hàng",
        "image_url": "{qr_url}",
        "fields": [
            {"name": "💰 Số tiền", "value": "{order.total} VNĐ", "inline": True},
            {"name": "📝 Nội dung CK", "value": "{transfer_content}", "inline": True},
        ],
    },
    # ── Order details ─────────────────────────────────────────────────────────
    "don_hang_chi_tiet": {
        "title": "📋 Chi tiết đơn hàng #{order.id}",
        "description": "Thông tin chi tiết đơn hàng.",
        "color": "#5865F2",
        "fields": [
            {"name": "👤 Khách hàng", "value": "{user.mention}", "inline": True},
            {"name": "📊 Trạng thái", "value": "{order.status}", "inline": True},
            {"name": "📦 Sản phẩm", "value": "{product.name}", "inline": False},
            {"name": "💰 Số tiền", "value": "{order.total} VNĐ", "inline": True},
            {"name": "📅 Ngày tạo", "value": "{order.created_at}", "inline": True},
        ],
    },
    # ── Product ───────────────────────────────────────────────────────────────
    "san_pham": {
        "title": "🛍️ {product.name}",
        "description": "{product.description}",
        "color": "#5865F2",
        "thumbnail_url": "{product.image_url}",
        "fields": [
            {"name": "💰 Giá", "value": "{product.price} VNĐ", "inline": True},
            {"name": "📦 Tồn kho", "value": "{product.stock}", "inline": True},
        ],
    },
    # ── Coupon ────────────────────────────────────────────────────────────────
    "coupon": {
        "title": "🏷️ Mã giảm giá",
        "description": "Mã **{coupon.code}** đã được áp dụng!",
        "color": "#FEE75C",
        "fields": [
            {"name": "💸 Giảm", "value": "{coupon.discount}", "inline": True},
            {"name": "⏰ Hạn sử dụng", "value": "{coupon.expires_at}", "inline": True},
        ],
    },
    # ── Shop ban/unban ────────────────────────────────────────────────────────
    "ban_shop": {
        "title": "🚫 Cấm mua hàng",
        "description": "{user.mention} đã bị cấm mua hàng.",
        "color": "#ED4245",
        "fields": [
            {"name": "📋 Lý do", "value": "{reason}", "inline": False},
            {"name": "👮 Người thực hiện", "value": "{moderator}", "inline": True},
        ],
    },
    "unban_shop": {
        "title": "✅ Bỏ cấm mua hàng",
        "description": "{user.mention} đã được bỏ cấm mua hàng.",
        "color": "#57F287",
        "fields": [
            {"name": "👮 Người thực hiện", "value": "{moderator}", "inline": True},
        ],
    },
    # ── Goodbye ───────────────────────────────────────────────────────────────
    "goodbye": {
        "title": "👋 Tạm biệt",
        "description": "**{user}** đã rời khỏi server.",
        "color": "#95A5A6",
        "footer": "Còn lại {member_count} thành viên",
        "fields": [],
    },
    # ── Giveaway banned ───────────────────────────────────────────────────────
    "giveaway_banned": {
        "title": "⛔ Cấm tham gia Giveaway",
        "description": "{user.mention} đã bị cấm tham gia giveaway.",
        "color": "#ED4245",
        "fields": [
            {"name": "📋 Lý do", "value": "{reason}", "inline": False},
        ],
    },
    # ── Unban ─────────────────────────────────────────────────────────────────
    "unban": {
        "title": "🔓 Unban thành viên",
        "description": "{user.mention} đã được unban khỏi server **{server}**.",
        "color": "#57F287",
        "fields": [
            {"name": "👮 Người thực hiện", "value": "{moderator}", "inline": True},
        ],
    },
    # ── Ticket extras ─────────────────────────────────────────────────────────
    "ticket_unclaim": {
        "title": "↩️ Bỏ nhận Ticket",
        "description": "{staff.mention} đã bỏ nhận ticket **#{ticket.id}**.",
        "color": "#95A5A6",
        "footer": "Ticket #{ticket.id}",
        "fields": [],
    },
    "ticket_panel": {
        "title": "🎫 Hỗ trợ",
        "description": "Chọn loại hỗ trợ bên dưới để tạo ticket.",
        "color": "#5865F2",
        "fields": [],
    },
    "ticket_feedback": {
        "title": "⭐ Đánh giá hỗ trợ",
        "description": "Ticket **#{ticket.id}** đã được đóng.\nVui lòng đánh giá chất lượng hỗ trợ!",
        "color": "#FEE75C",
        "fields": [
            {"name": "👮 Staff", "value": "{staff.mention}", "inline": True},
        ],
    },
    # ── Sticky / TempVoice ────────────────────────────────────────────────────
    "sticky_message": {
        "title": "{sticky.title}",
        "description": "{sticky.content}",
        "color": "#5865F2",
        "footer": "Sticky Message",
        "fields": [],
    },
    "tempvoice_create": {
        "title": "🔊 Voice tạm đã tạo",
        "description": "{user.mention} đã tạo kênh voice **{channel.name}**.",
        "color": "#5865F2",
        "footer": "Dùng nút bên dưới để quản lý phòng",
        "fields": [
            {"name": "Kênh", "value": "{channel.mention}", "inline": True},
            {"name": "Chủ phòng", "value": "{user.mention}", "inline": True},
        ],
    },
    "tempvoice_panel": {
        "title": "🎙️ Điều khiển phòng voice",
        "description": "Panel quản lý phòng voice tạm cho **{server}**.\n\nVào phòng voice của bạn rồi dùng các nút bên dưới để khóa, đổi tên, giới hạn, cấp quyền hoặc chuyển chủ phòng.",
        "color": "#5865F2",
        "footer": "Temp Voice Control Panel",
        "fields": [
            {"name": "Kênh gửi", "value": "{panel.channel}", "inline": True},
            {"name": "Nút bật", "value": "{button.count}", "inline": True},
        ],
    },
    "tempvoice_action": {
        "title": "🎙️ Temp Voice Action",
        "description": "{user.mention} đã **{action}** trong {channel.mention}.",
        "color": "#5865F2",
        "footer": "Temp Voice Logs",
        "fields": [
            {"name": "Mục tiêu", "value": "{target.mention}", "inline": True},
            {"name": "Chi tiết", "value": "{details}", "inline": True},
        ],
    },
    "level_up": {
        "title": "🎉 Level Up!",
        "description": "Chúc mừng {user.mention}, bạn đã lên **Level {level}**!",
        "color": "#57F287",
        "footer": "{server} • Rank #{rank}",
        "fields": [
            {"name": "XP", "value": "{xp}", "inline": True},
            {"name": "Tiến độ", "value": "{progress} ({progress_percent}%)", "inline": True},
            {"name": "Reward", "value": "{reward.role}", "inline": True},
        ],
    },
    "level_reward": {
        "title": "🎁 Level Reward",
        "description": "{user.mention} đã nhận reward **{reward.role}** ở Level {level}.",
        "color": "#57F287",
        "fields": [],
    },
    # ── Phase 3: Welcome extras ───────────────────────────────────────────────
    "dm_welcome": {
        "title": "👋 Chào mừng!",
        "description": "Xin chào {user.mention}! Cảm ơn bạn đã tham gia **{server}**.",
        "color": "#5865F2",
        "fields": [],
    },
    # ── Phase 4: Logging ──────────────────────────────────────────────────────
    "log_message_delete": {
        "title": "🗑️ Tin nhắn bị xóa",
        "description": "Tin nhắn của {user.mention} trong {channel} đã bị xóa.",
        "color": "#ED4245",
        "fields": [
            {"name": "Nội dung", "value": "{content}", "inline": False},
        ],
    },
    "log_message_edit": {
        "title": "✏️ Tin nhắn được sửa",
        "description": "{user.mention} đã sửa tin nhắn trong {channel}. [Nhảy tới]({message.url})",
        "color": "#FEE75C",
        "fields": [
            {"name": "Trước", "value": "{before}", "inline": False},
            {"name": "Sau", "value": "{after}", "inline": False},
        ],
    },
    "log_message_bulk_delete": {
        "title": "🗑️ Xóa hàng loạt",
        "description": "**{count}** tin nhắn đã bị xóa trong {channel}.",
        "color": "#ED4245",
        "fields": [],
    },
    "log_voice_join": {
        "title": "🔊 Vào voice",
        "description": "{user.mention} đã vào {channel}.",
        "color": "#57F287",
        "fields": [],
    },
    "log_voice_leave": {
        "title": "🔇 Rời voice",
        "description": "{user.mention} đã rời {channel}.",
        "color": "#ED4245",
        "fields": [],
    },
    "log_voice_move": {
        "title": "🔀 Chuyển voice",
        "description": "{user.mention} đã chuyển từ {from} sang {to}.",
        "color": "#FEE75C",
        "fields": [],
    },
    "log_member_join": {
        "title": "📥 Thành viên mới",
        "description": "{user.mention} đã tham gia server.",
        "color": "#57F287",
        "fields": [
            {"name": "Tạo tài khoản", "value": "{account_age}", "inline": True},
            {"name": "Thành viên thứ", "value": "{member_count}", "inline": True},
        ],
    },
    "log_member_leave": {
        "title": "📤 Thành viên rời",
        "description": "{user.mention} đã rời server.",
        "color": "#ED4245",
        "fields": [
            {"name": "Roles", "value": "{roles}", "inline": False},
            {"name": "Còn lại", "value": "{member_count} thành viên", "inline": True},
        ],
    },
    "log_nickname_change": {
        "title": "📝 Đổi nickname",
        "description": "{user.mention} đã đổi nickname.",
        "color": "#5865F2",
        "fields": [
            {"name": "Trước", "value": "{before}", "inline": True},
            {"name": "Sau", "value": "{after}", "inline": True},
        ],
    },
    "log_role_update": {
        "title": "🎭 Thay đổi role",
        "description": "Role của {user.mention} đã được thay đổi.",
        "color": "#5865F2",
        "fields": [
            {"name": "Thay đổi", "value": "{changes}", "inline": False},
        ],
    },
    "log_channel_create": {
        "title": "📺 Kênh mới",
        "description": "Kênh {channel} ({type}) đã được tạo.",
        "color": "#57F287",
        "fields": [],
    },
    "log_channel_delete": {
        "title": "📺 Kênh bị xóa",
        "description": "Kênh **{channel.name}** ({type}) đã bị xóa.",
        "color": "#ED4245",
        "fields": [],
    },

    # ── Auto Mod ──────────────────────────────────────────────────────────
    "automod_warn": {
        "title": "⚠️ AutoMod — Cảnh báo",
        "description": "{user.mention} đã bị cảnh báo bởi AutoMod.\n**Lý do:** {reason}",
        "color": "#FEE75C",
        "fields": [{"name": "Kênh", "value": "{channel}", "inline": True}],
    },
    "automod_mute": {
        "title": "🔇 AutoMod — Mute",
        "description": "{user.mention} đã bị mute bởi AutoMod.\n**Lý do:** {reason}",
        "color": "#E67E22",
        "fields": [{"name": "Thời gian", "value": "{duration}", "inline": True}],
    },
    "automod_kick": {
        "title": "👢 AutoMod — Kick",
        "description": "{user.mention} đã bị kick bởi AutoMod.\n**Lý do:** {reason}",
        "color": "#ED4245",
        "fields": [],
    },
    "automod_delete": {
        "title": "🗑️ AutoMod — Xóa tin nhắn",
        "description": "Tin nhắn của {user.mention} đã bị xóa bởi AutoMod.\n**Lý do:** {reason}",
        "color": "#95A5A6",
        "fields": [{"name": "Nội dung", "value": "{content}", "inline": False}],
    },

    # ── Reaction Roles ────────────────────────────────────────────────────
    "reaction_role_panel": {
        "title": "🎭 Chọn Role",
        "description": "React emoji tương ứng để nhận role!",
        "color": "#5865F2",
        "fields": [],
    },

    # ── Starboard ─────────────────────────────────────────────────────────
    "starboard_post": {
        "title": "",
        "description": "{content}",
        "color": "#F1C40F",
        "fields": [{"name": "Nguồn", "value": "[Nhảy tới tin nhắn]({message.url})", "inline": True}],
    },

    # ── AFK ────────────────────────────────────────────────────────────────
    "afk_set": {
        "title": "💤 AFK",
        "description": "{user.mention} đã đặt AFK: **{reason}**",
        "color": "#95A5A6",
        "fields": [],
    },
    "afk_return": {
        "title": "👋 Đã trở lại",
        "description": "{user.mention} đã trở lại! (AFK {duration})",
        "color": "#57F287",
        "fields": [],
    },

    # ── Tương tác — có mục tiêu ───────────────────────────────────────────
    "interact_airkiss":    {"title": "😘 Airkiss!", "description": "{user.mention} gửi nụ hôn gió cho {target.mention}", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_angrystare": {"title": "😠 Angry Stare!", "description": "{user.mention} nhìn giận dữ {target.mention}", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_bite":       {"title": "😬 Bite!", "description": "{user.mention} cắn {target.mention}", "color": "#E67E22", "image_url": "{gif_url}", "fields": []},
    "interact_brofist":    {"title": "🤜 Brofist!", "description": "{user.mention} đấm tay với {target.mention}", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_cuddle":     {"title": "🤗 Cuddle!", "description": "{user.mention} ôm ấp {target.mention}", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_handhold":   {"title": "🤝 Handhold!", "description": "{user.mention} nắm tay {target.mention}", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_hug":        {"title": "🫂 Hug!", "description": "{user.mention} ôm {target.mention}", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_kiss":       {"title": "💋 Kiss!", "description": "{user.mention} hôn {target.mention}", "color": "#E91E63", "image_url": "{gif_url}", "fields": []},
    "interact_lick":       {"title": "👅 Lick!", "description": "{user.mention} liếm {target.mention}", "color": "#E67E22", "image_url": "{gif_url}", "fields": []},
    "interact_nom":        {"title": "😋 Nom!", "description": "{user.mention} ăn {target.mention}", "color": "#E67E22", "image_url": "{gif_url}", "fields": []},
    "interact_nuzzle":     {"title": "🥰 Nuzzle!", "description": "{user.mention} cọ mũi với {target.mention}", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_pat":        {"title": "🤚 Pat!", "description": "{user.mention} xoa đầu {target.mention}", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_pinch":      {"title": "🤏 Pinch!", "description": "{user.mention} véo {target.mention}", "color": "#E67E22", "image_url": "{gif_url}", "fields": []},
    "interact_poke":       {"title": "👉 Poke!", "description": "{user.mention} chọc {target.mention}", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_punch":      {"title": "👊 Punch!", "description": "{user.mention} đấm {target.mention}", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_slap":       {"title": "🫲 Slap!", "description": "{user.mention} tát {target.mention}", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_smack":      {"title": "💥 Smack!", "description": "{user.mention} đánh {target.mention}", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_tickle":     {"title": "🤭 Tickle!", "description": "{user.mention} cù {target.mention}", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_wave":       {"title": "👋 Wave!", "description": "{user.mention} vẫy tay với {target.mention}", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_wink":       {"title": "😉 Wink!", "description": "{user.mention} nháy mắt với {target.mention}", "color": "#9B59B6", "image_url": "{gif_url}", "fields": []},
    "interact_stare":      {"title": "👀 Stare!", "description": "{user.mention} nhìn chằm chằm {target.mention}", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_peek":       {"title": "🫣 Peek!", "description": "{user.mention} nhìn trộm {target.mention}", "color": "#9B59B6", "image_url": "{gif_url}", "fields": []},

    # ── Tương tác — tự thân / biểu cảm ────────────────────────────────────
    "interact_bleh":       {"title": "😝 Bleh!", "description": "{user.mention} le lưỡi", "color": "#E67E22", "image_url": "{gif_url}", "fields": []},
    "interact_blush":      {"title": "😊 Blush!", "description": "{user.mention} đỏ mặt", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_celebrate":  {"title": "🎉 Celebrate!", "description": "{user.mention} ăn mừng", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_cheers":     {"title": "🍻 Cheers!", "description": "{user.mention} nâng ly", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_clap":       {"title": "👏 Clap!", "description": "{user.mention} vỗ tay", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_confused":   {"title": "😕 Confused!", "description": "{user.mention} bối rối", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_cool":       {"title": "😎 Cool!", "description": "{user.mention} ngầu", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_cry":        {"title": "😢 Cry!", "description": "{user.mention} khóc", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_dance":      {"title": "💃 Dance!", "description": "{user.mention} nhảy", "color": "#9B59B6", "image_url": "{gif_url}", "fields": []},
    "interact_drool":      {"title": "🤤 Drool!", "description": "{user.mention} chảy nước miếng", "color": "#E67E22", "image_url": "{gif_url}", "fields": []},
    "interact_evillaugh":  {"title": "😈 Evil Laugh!", "description": "{user.mention} cười ác", "color": "#8E44AD", "image_url": "{gif_url}", "fields": []},
    "interact_facepalm":   {"title": "🤦 Facepalm!", "description": "{user.mention} facepalm", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_happy":      {"title": "😄 Happy!", "description": "{user.mention} vui vẻ", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_headbang":   {"title": "🤘 Headbang!", "description": "{user.mention} headbang", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_huh":        {"title": "❓ Huh?", "description": "{user.mention} hả?", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_laugh":      {"title": "😂 Laugh!", "description": "{user.mention} cười", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_love":       {"title": "❤️ Love!", "description": "{user.mention} yêu", "color": "#E91E63", "image_url": "{gif_url}", "fields": []},
    "interact_mad":        {"title": "😡 Mad!", "description": "{user.mention} giận dữ", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_nervous":    {"title": "😰 Nervous!", "description": "{user.mention} lo lắng", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_no":         {"title": "🙅 No!", "description": "{user.mention} lắc đầu", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_nosebleed":  {"title": "🫠 Nosebleed!", "description": "{user.mention} chảy máu mũi", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_nyah":       {"title": "😜 Nyah~", "description": "{user.mention} nyah~", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_pout":       {"title": "😤 Pout!", "description": "{user.mention} phụng phịu", "color": "#E67E22", "image_url": "{gif_url}", "fields": []},
    "interact_roll":       {"title": "🙄 Roll!", "description": "{user.mention} lăn", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_run":        {"title": "🏃 Run!", "description": "{user.mention} chạy", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_sad":        {"title": "😞 Sad!", "description": "{user.mention} buồn", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_scared":     {"title": "😱 Scared!", "description": "{user.mention} sợ hãi", "color": "#8E44AD", "image_url": "{gif_url}", "fields": []},
    "interact_shout":      {"title": "📢 Shout!", "description": "{user.mention} hét", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_shrug":      {"title": "🤷 Shrug!", "description": "{user.mention} nhún vai", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_shy":        {"title": "🙈 Shy!", "description": "{user.mention} ngại ngùng", "color": "#FF69B4", "image_url": "{gif_url}", "fields": []},
    "interact_sigh":       {"title": "😮‍💨 Sigh!", "description": "{user.mention} thở dài", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_sip":        {"title": "🍵 Sip!", "description": "{user.mention} nhâm nhi", "color": "#2ECC71", "image_url": "{gif_url}", "fields": []},
    "interact_sleep":      {"title": "😴 Sleep!", "description": "{user.mention} ngủ", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_slowclap":   {"title": "👏 Slow Clap!", "description": "{user.mention} vỗ tay chậm", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_smile":      {"title": "😊 Smile!", "description": "{user.mention} cười", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_smug":       {"title": "😏 Smug!", "description": "{user.mention} tự mãn", "color": "#9B59B6", "image_url": "{gif_url}", "fields": []},
    "interact_sneeze":     {"title": "🤧 Sneeze!", "description": "{user.mention} hắt xì", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_sorry":      {"title": "🙏 Sorry!", "description": "{user.mention} xin lỗi", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_stop":       {"title": "🛑 Stop!", "description": "{user.mention} dừng lại", "color": "#E74C3C", "image_url": "{gif_url}", "fields": []},
    "interact_surprised":  {"title": "😲 Surprised!", "description": "{user.mention} ngạc nhiên", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_sweat":      {"title": "😓 Sweat!", "description": "{user.mention} toát mồ hôi", "color": "#3498DB", "image_url": "{gif_url}", "fields": []},
    "interact_thumbsup":   {"title": "👍 Thumbs Up!", "description": "{user.mention} thích", "color": "#2ECC71", "image_url": "{gif_url}", "fields": []},
    "interact_tired":      {"title": "😩 Tired!", "description": "{user.mention} mệt", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_woah":       {"title": "😮 Woah!", "description": "{user.mention} woah", "color": "#9B59B6", "image_url": "{gif_url}", "fields": []},
    "interact_yawn":       {"title": "🥱 Yawn!", "description": "{user.mention} ngáp", "color": "#95A5A6", "image_url": "{gif_url}", "fields": []},
    "interact_yay":        {"title": "🥳 Yay!", "description": "{user.mention} yay!", "color": "#F1C40F", "image_url": "{gif_url}", "fields": []},
    "interact_yes":        {"title": "✅ Yes!", "description": "{user.mention} gật đầu", "color": "#2ECC71", "image_url": "{gif_url}", "fields": []},
    # ── Help ──
    "help_menu": {
        "title": "📋 Trợ giúp — {bot_name}",
        "description": "Xin chào {user.mention}!\nChọn **danh mục** bên dưới để xem danh sách lệnh.",
        "color": "#5865F2",
        "footer": "{bot_name} • Chọn danh mục để tiếp tục",
        "fields": [],
    },
    "help_category": {
        "title": "{category_emoji} {category_name}",
        "description": "Danh sách lệnh trong **{category_name}**:\n{commands_list}",
        "color": "#5865F2",
        "footer": "{bot_name} • Chọn lệnh để xem chi tiết",
        "fields": [],
    },
    "help_command": {
        "title": "{command_emoji} `/{command_name}`",
        "description": "{command_desc}",
        "color": "#57F287",
        "footer": "{bot_name}",
        "fields": [
            {"name": "📌 Cách dùng", "value": "{command_usage}", "inline": False},
        ],
    },
    "bang_gia": {
        "title": "🛒 Bảng Giá Sản Phẩm",
        "description": "Chọn sản phẩm từ menu bên dưới để xem chi tiết và giá các gói.",
        "color": "#5865F2",
        "footer": "Bấm vào tên sản phẩm bên dưới để xem chi tiết",
        "fields": [],
    },
    "san_pham_detail": {
        "title": "📦 {product.name}",
        "description": "{product.description}",
        "color": "#57F287",
        "footer": "Chỉ bạn mới thấy thông tin này • Liên hệ admin để đặt hàng",
        "fields": [],
    },
    # ── Extended Moderation ───────────────────────────────────────────────────
    "softban": {
        "title": "🔨 Softbanned",
        "description": "{user.mention} đã bị softban khỏi server **{server}**.",
        "color": "#ED4245",
        "footer": "Softban — tin nhắn đã bị xóa",
        "fields": [
            {"name": "📋 Lý do", "value": "{reason}", "inline": False},
            {"name": "👮 Mod", "value": "{mod.name}", "inline": True},
        ],
    },
    "mute": {
        "title": "🔇 Đã bị mute",
        "description": "{user.mention} đã bị mute trong server **{server}**.",
        "color": "#5865F2",
        "footer": "Hãy tuân thủ nội quy server",
        "fields": [
            {"name": "⏰ Thời gian", "value": "{duration}", "inline": True},
            {"name": "📋 Lý do", "value": "{reason}", "inline": False},
        ],
    },
    "deafen": {
        "title": "🔇 Đã bị deafen",
        "description": "{user.mention} đã bị deafen trong server **{server}**.",
        "color": "#9B59B6",
        "fields": [
            {"name": "📋 Lý do", "value": "{reason}", "inline": False},
            {"name": "👮 Mod", "value": "{mod.name}", "inline": True},
        ],
    },
    "rolepersist": {
        "title": "📌 Role Persist",
        "description": "Role **{role.name}** đã được gán cố định cho {user.mention}.",
        "color": "#5865F2",
        "fields": [
            {"name": "👮 Mod", "value": "{mod.name}", "inline": True},
        ],
    },
    "temprole": {
        "title": "⏱️ Temporary Role",
        "description": "Role **{role.name}** đã được gán cho {user.mention} trong **{duration}**.",
        "color": "#F0B232",
        "fields": [
            {"name": "👮 Mod", "value": "{mod.name}", "inline": True},
            {"name": "⏰ Hết hạn", "value": "{expires_at}", "inline": True},
        ],
    },
    "lockdown_start": {
        "title": "🔒 Lockdown",
        "description": "Server **{server}** đã vào chế độ lockdown.",
        "color": "#ED4245",
        "fields": [
            {"name": "🔒 Kênh bị khóa", "value": "{count}", "inline": True},
        ],
    },
    "lockdown_end": {
        "title": "🔓 Lockdown End",
        "description": "Server **{server}** đã thoát chế độ lockdown.",
        "color": "#57F287",
        "fields": [
            {"name": "🔓 Kênh được mở", "value": "{count}", "inline": True},
        ],
    },
}


def _sub(text: str | None, vars: dict) -> str:
    """Thay thế biến {key} trong chuỗi."""
    if not text:
        return ""
    for k, v in vars.items():
        text = text.replace(f"{{{k}}}", str(v))
    return text


def _hex_to_int(hex_color: str) -> int:
    """Chuyển #RRGGBB → int cho discord.Color."""
    try:
        return int(hex_color.lstrip("#"), 16)
    except Exception:
        return 0x5865F2


def resolve_image_url(image_url: str | None, db: Session) -> str | None:
    """
    Chuyển relative path (/static/uploads/...) thành full URL dùng được trong Discord.
    Trả về None nếu không có hoặc không hợp lệ.
    """
    if not image_url:
        return None
    if image_url.startswith("http://") or image_url.startswith("https://"):
        return image_url
    if image_url.startswith("/"):
        # Relative path — cần ghép với public_app_url
        from src.models.models import SystemConfig
        config = db.execute(select(SystemConfig).limit(1)).scalars().first()
        base = (config.public_app_url or "").rstrip("/") if config else ""
        if base:
            return base + image_url
    return None


def build_embed(
    event_type: str,
    db: Session,
    vars: dict | None = None,
) -> discord.Embed:
    """
    Load template từ DB (hoặc dùng default), apply variable substitution, trả về discord.Embed.
    Luôn trả về Embed — nếu cần check text mode, dùng build_response() thay thế.
    """
    result = build_response(event_type, db, vars)
    if isinstance(result, discord.Embed):
        return result
    # Fallback: wrap text in a minimal embed
    return discord.Embed(description=result, color=0x5865F2, timestamp=datetime.datetime.utcnow())


def build_response(
    event_type: str,
    db: Session,
    vars: dict | None = None,
) -> discord.Embed | str:
    """
    Load template từ DB (hoặc dùng default), apply variable substitution.
    Trả về discord.Embed nếu response_mode == "embed", hoặc str nếu "text".

    vars có thể chứa bất kỳ key nào. Các biến chuẩn:
        user, user.id, user.mention, order.id, order.total,
        product.name, package, date, server, member_count,
        stars, content, prize, ends_at, host, winners_count
    """
    from src.models.models import EmbedTemplate

    if vars is None:
        vars = {}

    # Điền giá trị mặc định cho biến hay dùng
    vars.setdefault("date", datetime.datetime.now().strftime("%d/%m/%Y %H:%M"))
    vars.setdefault("server", "Server")

    # Tìm template trong DB
    tmpl = db.execute(
        select(EmbedTemplate).where(EmbedTemplate.event_type == event_type)
    ).scalars().first()

    # Check text mode
    response_mode = "embed"
    if tmpl and tmpl.enabled:
        response_mode = getattr(tmpl, "response_mode", "embed") or "embed"

    if response_mode == "text":
        # Text mode: use text_template with variable substitution
        text_tmpl = getattr(tmpl, "text_template", None) or ""
        if not text_tmpl:
            # Fallback: build text from embed title + description
            parts = []
            if tmpl.title:
                parts.append(f"**{_sub(tmpl.title, vars)}**")
            if tmpl.description:
                parts.append(_sub(tmpl.description, vars))
            for f in (tmpl.fields or []):
                fname = _sub(f.get("name", ""), vars)
                fval = _sub(f.get("value", ""), vars)
                if fname and fval:
                    parts.append(f"**{fname}**: {fval}")
            text_tmpl = "\n".join(parts)
        return _sub(text_tmpl, vars)

    # Embed mode (default)
    if tmpl and tmpl.enabled:
        color = _hex_to_int(tmpl.color or "#5865F2")
        embed = discord.Embed(
            title=_sub(tmpl.title, vars) or None,
            description=_sub(tmpl.description, vars) or None,
            color=color,
        )
        if tmpl.author:
            embed.set_author(name=_sub(tmpl.author, vars))
        if tmpl.footer:
            embed.set_footer(text=_sub(tmpl.footer, vars))
        if tmpl.thumbnail_url:
            embed.set_thumbnail(url=_sub(tmpl.thumbnail_url, vars))
        if tmpl.image_url:
            embed.set_image(url=_sub(tmpl.image_url, vars))
        for f in (tmpl.fields or []):
            embed.add_field(
                name=_sub(f.get("name", ""), vars),
                value=_sub(f.get("value", ""), vars) or "\u200b",
                inline=f.get("inline", True),
            )
    else:
        d = DEFAULTS.get(event_type, {})
        color = _hex_to_int(d.get("color", "#5865F2"))
        embed = discord.Embed(
            title=_sub(d.get("title"), vars),
            description=_sub(d.get("description"), vars),
            color=color,
        )
        if d.get("author"):
            embed.set_author(name=_sub(d.get("author"), vars))
        if d.get("footer"):
            embed.set_footer(text=_sub(d.get("footer"), vars))
        if d.get("thumbnail_url"):
            embed.set_thumbnail(url=_sub(d.get("thumbnail_url"), vars))
        if d.get("image_url"):
            embed.set_image(url=_sub(d.get("image_url"), vars))
        for f in d.get("fields", []):
            embed.add_field(
                name=_sub(f.get("name", ""), vars),
                value=_sub(f.get("value", ""), vars) or "\u200b",
                inline=f.get("inline", True),
            )

    embed.timestamp = datetime.datetime.utcnow()
    return embed
