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


def build_embed(
    event_type: str,
    db: Session,
    vars: dict | None = None,
) -> discord.Embed:
    """
    Load template từ DB (hoặc dùng default), apply variable substitution, trả về discord.Embed.

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

    if tmpl and tmpl.enabled:
        # Dùng template tùy chỉnh
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
        # Dùng default
        d = DEFAULTS.get(event_type, {})
        color = _hex_to_int(d.get("color", "#5865F2"))
        embed = discord.Embed(
            title=_sub(d.get("title"), vars),
            description=_sub(d.get("description"), vars),
            color=color,
        )
        if d.get("footer"):
            embed.set_footer(text=_sub(d.get("footer"), vars))
        for f in d.get("fields", []):
            embed.add_field(
                name=_sub(f.get("name", ""), vars),
                value=_sub(f.get("value", ""), vars) or "\u200b",
                inline=f.get("inline", True),
            )

    embed.timestamp = datetime.datetime.utcnow()
    return embed
