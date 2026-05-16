"""Public API — no auth required. Bot status, commands list."""
from fastapi import APIRouter

router = APIRouter(prefix="/public")


@router.get("/status")
async def public_status():
    """Trả về tình trạng bot công khai — không cần auth."""
    try:
        from src.bot.manager import bot as _bot
        if _bot and _bot.is_ready():
            user = _bot.user
            guild_count = len(_bot.guilds)
            member_count = sum(g.member_count or 0 for g in _bot.guilds)
            latency_ms = round(_bot.latency * 1000, 1)

            # Shard info
            shard_info = []
            if hasattr(_bot, "shards") and _bot.shards:
                for shard_id, shard in _bot.shards.items():
                    shard_info.append({
                        "id": shard_id,
                        "latency_ms": round(shard.latency * 1000, 1) if shard.latency and shard.latency == shard.latency else None,
                        "guild_count": sum(1 for g in _bot.guilds if g.shard_id == shard_id),
                    })
            else:
                shard_info = [{"id": 0, "latency_ms": latency_ms, "guild_count": guild_count}]

            return {
                "online": True,
                "username": user.name if user else None,
                "avatar_url": str(user.display_avatar.url) if user and user.display_avatar else None,
                "guild_count": guild_count,
                "member_count": member_count,
                "latency_ms": latency_ms,
                "shard_count": _bot.shard_count or 1,
                "shards": shard_info,
            }
    except Exception:
        pass

    return {
        "online": False,
        "username": None,
        "avatar_url": None,
        "guild_count": None,
        "member_count": None,
        "latency_ms": None,
        "shard_count": None,
        "shards": [],
    }


@router.get("/commands")
async def public_commands():
    """Danh sách slash commands theo category."""
    categories = [
        {
            "name": "🛒 Shop",
            "commands": [
                {"name": "/shop", "description": "Xem danh sách sản phẩm"},
                {"name": "/mua", "description": "Mua sản phẩm"},
                {"name": "/donhang", "description": "Xem đơn hàng của bạn"},
                {"name": "/topshop", "description": "Bảng xếp hạng người mua"},
            ],
        },
        {
            "name": "🎫 Ticket",
            "commands": [
                {"name": "/ticket", "description": "Mở ticket hỗ trợ"},
                {"name": "/close", "description": "Đóng ticket hiện tại"},
                {"name": "/claim", "description": "Nhận ticket để xử lý"},
                {"name": "/transcript", "description": "Xuất lịch sử ticket"},
            ],
        },
        {
            "name": "🎉 Giveaway",
            "commands": [
                {"name": "/giveaway start", "description": "Tạo giveaway mới"},
                {"name": "/giveaway end", "description": "Kết thúc giveaway"},
                {"name": "/giveaway reroll", "description": "Chọn lại người thắng"},
                {"name": "/giveaway list", "description": "Xem danh sách giveaway"},
            ],
        },
        {
            "name": "🔨 Kiểm duyệt",
            "commands": [
                {"name": "/ban", "description": "Cấm thành viên khỏi server"},
                {"name": "/kick", "description": "Kick thành viên"},
                {"name": "/timeout", "description": "Timeout thành viên"},
                {"name": "/unban", "description": "Bỏ cấm thành viên"},
                {"name": "/warn", "description": "Cảnh cáo thành viên"},
            ],
        },
        {
            "name": "🎙️ TempVoice",
            "commands": [
                {"name": "/voice rename", "description": "Đổi tên kênh voice"},
                {"name": "/voice limit", "description": "Đặt giới hạn thành viên"},
                {"name": "/voice lock", "description": "Khoá kênh voice"},
                {"name": "/voice kick", "description": "Kick người khỏi kênh"},
            ],
        },
        {
            "name": "⚙️ Tiện ích",
            "commands": [
                {"name": "/embed", "description": "Tạo embed tùy chỉnh"},
                {"name": "/sticky", "description": "Ghim tin nhắn sticky"},
                {"name": "/invite", "description": "Thống kê lượt mời"},
                {"name": "/prefix", "description": "Đổi prefix bot"},
            ],
        },
    ]
    return {"categories": categories}
