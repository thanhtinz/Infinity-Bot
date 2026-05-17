"""Rank card generator — pixel-matched to reference design."""
from __future__ import annotations

from io import BytesIO
from typing import Any

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# Card dimensions — spec 1280×320
CARD_W = 1280
CARD_H = 320


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    import os
    # Bundled Montserrat variable font (wght axis: 100–900)
    # Pillow's FreeType renders variable fonts at weight index 0 (Regular).
    # We ship a single file and use it for both weights — the bold visual
    # difference is achieved by the index parameter (1 = Bold instance if present).
    base = os.path.join(os.path.dirname(__file__), "fonts", "Montserrat-Variable.ttf")
    if os.path.exists(base):
        # index 0 = lightest (Regular), index 1 = Bold instance when available
        idx = 1 if bold else 0
        try:
            return ImageFont.truetype(base, size, index=idx)
        except Exception:
            try:
                return ImageFont.truetype(base, size, index=0)
            except Exception:
                pass
    # System fallbacks
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def _hex_to_rgb(value: str, fallback: tuple[int, int, int]) -> tuple[int, int, int]:
    try:
        value = value.strip().lstrip("#")
        if len(value) == 3:
            value = "".join(ch * 2 for ch in value)
        return tuple(int(value[i: i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
    except Exception:
        return fallback


def _fit_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> str:
    if draw.textlength(text, font=font) <= max_width:
        return text
    ellipsis = "…"
    while text and draw.textlength(text + ellipsis, font=font) > max_width:
        text = text[:-1]
    return text + ellipsis if text else ellipsis


def _rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def _avatar_image(avatar_bytes: bytes | None, size: int) -> Image.Image:
    if avatar_bytes:
        try:
            return Image.open(BytesIO(avatar_bytes)).convert("RGB").resize((size, size), Image.Resampling.LANCZOS)
        except Exception:
            pass
    av = Image.new("RGB", (size, size), (38, 43, 62))
    d = ImageDraw.Draw(av)
    d.ellipse((12, 12, size - 12, size - 12), fill=(86, 98, 246))
    d.text((size / 2, size / 2), "?", font=_font(size // 2, True), anchor="mm", fill=(255, 255, 255))
    return av


# ─── Layout-based renderer (canvas editor) ───────────────────────────────────

def _make_rank_card_layout(
    *,
    layout_config: dict,
    username: str,
    display_name: str | None,
    avatar_bytes: bytes | None,
    level: int,
    rank: int,
    xp: int,
    progress: int,
    needed: int,
    percent: int | None,
    server: str,
    custom_bg_path: str | None = None,
) -> BytesIO:
    import os
    width  = int(layout_config.get("width")  or CARD_W)
    height = int(layout_config.get("height") or CARD_H)
    bg     = layout_config.get("background") or {}
    bg_color = _hex_to_rgb(bg.get("color", "#303136"), (48, 49, 54))

    if custom_bg_path and os.path.exists(custom_bg_path):
        try:
            img = Image.open(custom_bg_path).convert("RGBA").resize((width, height), Image.Resampling.LANCZOS)
        except Exception:
            img = Image.new("RGBA", (width, height), (*bg_color, 255))
    else:
        img = Image.new("RGBA", (width, height), (*bg_color, 255))
        if bg.get("style") == "gradient":
            _tmp = ImageDraw.Draw(img)
            accent = _hex_to_rgb(bg.get("accent", "#7C8CFF"), (124, 140, 255))
            for y in range(height):
                blend = y / max(1, height - 1)
                color = tuple(int(bg_color[i] * (1 - blend) + accent[i] * blend) for i in range(3))
                _tmp.line((0, y, width, y), fill=(*color, 255))

    draw = ImageDraw.Draw(img)

    variables = {
        "display_name": display_name or username,
        "username": username,
        "server": server,
        "level": str(level),
        "rank": f"#{rank}",
        "xp": f"{xp:,}",
        "progress": f"{progress:,} / {needed:,}",
        "percent": f"{percent if percent is not None else int((max(0, progress) / max(1, needed)) * 100)}%",
    }

    for layer in sorted(layout_config.get("layers") or [], key=lambda item: int(item.get("z", 0))):
        if layer.get("visible") is False:
            continue
        kind    = layer.get("type")
        x, y    = int(layer.get("x", 0)), int(layer.get("y", 0))
        w, h    = int(layer.get("w", 100)), int(layer.get("h", 40))
        radius  = int(layer.get("radius", 16))
        opacity = max(0, min(255, int(layer.get("opacity", 100) * 2.55)))
        if kind == "rect":
            color = _hex_to_rgb(layer.get("color", "#FFFFFF"), (255, 255, 255))
            draw.rounded_rectangle(
                (x, y, x + w, y + h), radius=radius,
                fill=(*color, opacity),
                outline=_hex_to_rgb(layer.get("stroke", "#FFFFFF"), (255, 255, 255)) if layer.get("stroke") else None,
                width=int(layer.get("stroke_width", 1)),
            )
        elif kind == "avatar":
            avatar = _avatar_image(avatar_bytes, min(w, h)).convert("RGBA")
            mask   = _rounded_mask(avatar.size, radius if layer.get("shape") == "rounded" else min(w, h) // 2)
            avatar.putalpha(mask)
            img.alpha_composite(avatar, (x, y))
        elif kind == "progress":
            pct = max(0, min(100, percent if percent is not None else int((max(0, progress) / max(1, needed)) * 100)))
            track = _hex_to_rgb(layer.get("track", "#FFFFFF"), (255, 255, 255))
            fill  = _hex_to_rgb(layer.get("fill",  "#7C8CFF"), (124, 140, 255))
            draw.rounded_rectangle((x, y, x + w, y + h), radius=radius, fill=(*track, 48))
            draw.rounded_rectangle((x, y, x + int(w * pct / 100), y + h), radius=radius, fill=(*fill, opacity))
        elif kind == "text":
            token = layer.get("token")
            text  = variables.get(token, layer.get("text", "Text"))
            font  = _font(int(layer.get("font_size", 24)), bool(layer.get("bold", False)))
            color = _hex_to_rgb(layer.get("color", "#FFFFFF"), (255, 255, 255))
            draw.text((x, y), _fit_text(draw, str(text), font, w), font=font, fill=(*color, opacity))

    out = BytesIO()
    img.save(out, format="PNG", optimize=True)
    out.seek(0)
    return out


# ─── Main rank card (fixed layout, pixel-matched to reference) ────────────────

def make_rank_card(
    *,
    username: str,
    display_name: str | None = None,
    avatar_bytes: bytes | None = None,
    bot_name: str = "",
    bot_avatar_bytes: bytes | None = None,
    level: int = 0,
    rank: int = 1,
    xp: int = 0,
    progress: int = 0,
    needed: int = 1,
    percent: int | None = None,
    server: str = "Server",
    accent: str = "#8B5CF6",
    secondary_accent: str = "#22D3EE",
    background: str = "aurora",
    custom_bg_path: str | None = None,
    panel_style: str = "glass",
    progress_style: str = "gradient",
    avatar_shape: str = "rounded",
    card_radius: int = 18,
    panel_opacity: int = 34,
    glow_strength: float = 1.0,
    avatar_size: int = 90,
    show_avatar_ring: bool = True,
    show_progress_bar: bool = True,
    show_username: bool = True,
    show_server: bool = True,
    show_total_xp: bool = True,
    show_percent: bool = True,
    show_rank: bool = True,
    show_level: bool = True,
    rank_label: str = "Rank",
    level_label: str = "Level",
    xp_label: str = "XP",
    layout_config: dict | None = None,
    # Extended stats
    message_count: int = 0,
    voice_minutes: int = 0,
    voice_xp: int = 0,
    rep_score: int = 0,
    # Visual enhancements
    gradient_theme: str = "",
    avatar_effect: str = "glow",
    badges: list | None = None,
    frame: str = "none",
) -> BytesIO:
    """Rank card PNG — pixel-matched to reference design."""
    import os as _os

    # If a custom canvas layout exists, use the layout renderer
    if layout_config and layout_config.get("layers"):
        return _make_rank_card_layout(
            layout_config=layout_config,
            username=username, display_name=display_name,
            avatar_bytes=avatar_bytes, level=level, rank=rank,
            xp=xp, progress=progress, needed=needed, percent=percent,
            server=server, custom_bg_path=custom_bg_path,
        )

    # ── Spec colours ─────────────────────────────────────────────────────────
    # User-customisable accents; rest are fixed to spec
    accent_rgb    = _hex_to_rgb(accent,          (245, 166, 35))   # #F5A623
    glow_rgb      = _hex_to_rgb("#7A5CFF",        (122, 92, 255))   # glow
    bg_rgb        = _hex_to_rgb("#2B2B32",         (43,  43,  50))
    grad_start    = _hex_to_rgb("#3A3A45",         (58,  58,  69))
    grad_end      = _hex_to_rgb("#24242B",         (36,  36,  43))
    white         = (255, 255, 255)
    secondary_txt = (167, 167, 179)   # #A7A7B3

    pct = percent if percent is not None else int((max(0, progress) / max(1, needed)) * 100)
    pct = max(0, min(100, pct))

    # ── Background — gradient #3A3A45 → #24242B top→bottom ──────────────────
    GRADIENT_THEMES = {
        "sunset":  ((255, 94, 77),  (255, 154, 0)),
        "ocean":   ((0, 150, 199),  (0, 69, 142)),
        "forest":  ((34, 139, 34),  (0, 100, 0)),
        "neon":    ((255, 0, 255),  (0, 255, 255)),
        "pastel":  ((255, 179, 186),(186, 225, 255)),
        "midnight":((25, 25, 112),  (72, 61, 139)),
        "aurora":  ((0, 210, 190),  (95, 44, 255)),
        "fire":    ((255, 69, 0),   (255, 165, 0)),
    }

    if custom_bg_path and _os.path.exists(custom_bg_path):
        try:
            img = Image.open(custom_bg_path).convert("RGBA").resize((CARD_W, CARD_H), Image.Resampling.LANCZOS)
        except Exception:
            img = Image.new("RGBA", (CARD_W, CARD_H), (*bg_rgb, 255))
    elif gradient_theme and gradient_theme in GRADIENT_THEMES:
        # Use gradient theme
        g_start, g_end = GRADIENT_THEMES[gradient_theme]
        img = Image.new("RGBA", (CARD_W, CARD_H), (*bg_rgb, 255))
        grad = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, 0))
        gd = ImageDraw.Draw(grad)
        for y in range(CARD_H):
            t = y / max(1, CARD_H - 1)
            c = tuple(int(g_start[i] * (1 - t) + g_end[i] * t) for i in range(3))
            gd.line((0, y, CARD_W, y), fill=(*c, 180))
        img.alpha_composite(grad)
    else:
        img = Image.new("RGBA", (CARD_W, CARD_H), (*bg_rgb, 255))
        # Diagonal gradient overlay (top-left lighter → bottom-right darker)
        grad = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, 0))
        gd   = ImageDraw.Draw(grad)
        for y in range(CARD_H):
            t = y / max(1, CARD_H - 1)
            c = tuple(int(grad_start[i] * (1 - t) + grad_end[i] * t) for i in range(3))
            gd.line((0, y, CARD_W, y), fill=(*c, 255))  # type: ignore[arg-type]
        img.alpha_composite(grad)

    # Semi-transparent dark overlay (15%)
    overlay = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, int(255 * 0.15)))
    img.alpha_composite(overlay)

    # Avatar glow — soft purple radial behind avatar (spec: glow:#7A5CFF, blur:40)
    av_cx, av_cy = 32 + 90, 70 + 90          # avatar center
    if avatar_effect != "none":
        glow_layer = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, 0))
        gd2 = ImageDraw.Draw(glow_layer)
        GLOW_R = 120
        if avatar_effect == "shadow":
            # Drop shadow below/right
            gd2.ellipse(
                (av_cx - GLOW_R + 10, av_cy - GLOW_R + 10, av_cx + GLOW_R + 10, av_cy + GLOW_R + 10),
                fill=(0, 0, 0, 100),
            )
            glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(30))
        elif avatar_effect == "ring_pulse":
            # Colored ring pulse effect
            for r_offset in range(3):
                ring_r = GLOW_R + r_offset * 15
                gd2.ellipse(
                    (av_cx - ring_r, av_cy - ring_r, av_cx + ring_r, av_cy + ring_r),
                    outline=(*accent_rgb, max(20, 80 - r_offset * 25)), width=3,
                )
        else:  # "glow" (default)
            gd2.ellipse(
                (av_cx - GLOW_R, av_cy - GLOW_R, av_cx + GLOW_R, av_cy + GLOW_R),
                fill=(*glow_rgb, 80),
            )
            glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(40))
        img.alpha_composite(glow_layer)

    draw = ImageDraw.Draw(img)

    # ── User Avatar  x:32 y:70 w:180 h:180 radius:20 border:4 ───────────────
    AV_X, AV_Y, AV_SIZE, AV_R = 32, 70, 180, 20
    BORDER = 4

    av_img  = _avatar_image(avatar_bytes, AV_SIZE).convert("RGBA")
    av_mask = _rounded_mask((AV_SIZE, AV_SIZE), AV_R)
    av_img.putalpha(av_mask)
    img.alpha_composite(av_img, (AV_X, AV_Y))

    # Border ring
    if show_avatar_ring:
        draw.rounded_rectangle(
            (AV_X - BORDER, AV_Y - BORDER, AV_X + AV_SIZE + BORDER, AV_Y + AV_SIZE + BORDER),
            radius=AV_R + BORDER,
            outline=(*accent_rgb, 200),
            width=BORDER,
        )

    # Avatar frame
    FRAME_COLORS = {
        "gold": (255, 215, 0), "diamond": (185, 242, 255),
        "fire": (255, 69, 0), "rainbow": None,
    }
    if frame and frame != "none" and frame in FRAME_COLORS:
        frame_w = 6
        if frame == "rainbow":
            rainbow = [(255,0,0),(255,127,0),(255,255,0),(0,255,0),(0,0,255),(75,0,130),(148,0,211)]
            for i, c in enumerate(rainbow):
                offset = i * 2
                draw.rounded_rectangle(
                    (AV_X - BORDER - frame_w + offset, AV_Y - BORDER - frame_w + offset,
                     AV_X + AV_SIZE + BORDER + frame_w - offset, AV_Y + AV_SIZE + BORDER + frame_w - offset),
                    radius=AV_R + BORDER + frame_w,
                    outline=(*c, 180), width=1,
                )
        else:
            fc = FRAME_COLORS[frame]
            draw.rounded_rectangle(
                (AV_X - BORDER - frame_w, AV_Y - BORDER - frame_w,
                 AV_X + AV_SIZE + BORDER + frame_w, AV_Y + AV_SIZE + BORDER + frame_w),
                radius=AV_R + BORDER + frame_w,
                outline=(*fc, 220), width=frame_w,
            )

    # ── Fonts — pixel sizes matching spec exactly ─────────────────────────────
    name_font  = _font(52, bold=True)   # username  52 / 700
    rank_font  = _font(36, bold=True)   # RANK #1   top-right
    level_font = _font(48, bold=True)   # LEVEL 250 above bar right
    xp_font    = _font(34, bold=True)   # XP current (below bar, large)
    next_font  = _font(22, bold=False)  # XP needed (beside, small)

    display = display_name or username

    # ── RANK #N  top-right corner, right-aligned ──────────────────────────────
    RIGHT_EDGE = CARD_W - 32          # x = 1248
    BAR_X, BAR_Y = 250, 185
    BAR_W, BAR_H = 960, 38
    BAR_RIGHT = BAR_X + BAR_W        # x = 1210

    if show_rank:
        rank_str = f"{rank_label.upper()} #{rank}"
        rank_w   = int(draw.textlength(rank_str, font=rank_font))
        draw.text(
            (RIGHT_EDGE - rank_w, 32),
            rank_str,
            font=rank_font, fill=(*accent_rgb, 255),
        )

    # ── Username + LEVEL — same row, vertically centered on each other ────────
    name_str   = _fit_text(draw, display, name_font, 680)
    name_bbox  = draw.textbbox((0, 0), name_str, font=name_font)
    # bbox = (left, top, right, bottom) — top/left offsets must be subtracted
    name_top   = name_bbox[1]          # ascender offset (often negative or small positive)
    name_bot   = name_bbox[3]
    name_h     = name_bot - name_top   # true pixel height

    lv_top = lv_bot = lv_h = lv_w = 0
    lv_str = ""
    if show_level:
        lv_str  = f"{level_label.upper()} {level}"
        lv_bbox = draw.textbbox((0, 0), lv_str, font=level_font)
        lv_top  = lv_bbox[1]
        lv_bot  = lv_bbox[3]
        lv_h    = lv_bot - lv_top
        lv_w    = int(draw.textlength(lv_str, font=level_font))

    # Align both texts so their visual midpoints share the same Y
    ROW_MID = 155          # fixed visual center of the name/level row
    if show_username:
        name_y = ROW_MID - name_h // 2 - name_top
        draw.text((250, name_y), name_str, font=name_font, fill=(*white, 255))

    if show_level:
        lv_y = ROW_MID - lv_h // 2 - lv_top
        draw.text((BAR_RIGHT - lv_w, lv_y), lv_str, font=level_font, fill=(*white, 255))

    # ── Progress bar ──────────────────────────────────────────────────────────
    if show_progress_bar:
        # Track background (subtle dark)
        draw.rounded_rectangle(
            (BAR_X, BAR_Y, BAR_X + BAR_W, BAR_Y + BAR_H),
            radius=BAR_H // 2, fill=(60, 60, 70, 180),
        )

        # Fill: gradient accent→glow left→right, capped at BAR_W
        fill_w = min(BAR_W, max(BAR_H, int(BAR_W * pct / 100))) if pct else 0
        if fill_w:
            fl = Image.new("RGBA", (fill_w, BAR_H), (0, 0, 0, 0))
            fd = ImageDraw.Draw(fl)
            for xi in range(fill_w):
                t = xi / max(1, fill_w - 1)
                fd.line((xi, 0, xi, BAR_H), fill=(
                    int(accent_rgb[0] * (1 - t) + glow_rgb[0] * t),
                    int(accent_rgb[1] * (1 - t) + glow_rgb[1] * t),
                    int(accent_rgb[2] * (1 - t) + glow_rgb[2] * t),
                    255,
                ))
            fl.putalpha(_rounded_mask((fill_w, BAR_H), BAR_H // 2))
            img.alpha_composite(fl, (BAR_X, BAR_Y))

    # ── Below bar: right-aligned — "/ 3,125,100 XP" (small) + "3,120,150 XP" (large) ─
    BELOW_Y = BAR_Y + BAR_H + 12
    if show_total_xp:
        xp_str     = f"{xp:,} {xp_label}"
        needed_str = f"/ {needed:,} {xp_label}"
        # Right-align: draw needed_str flush to BAR_RIGHT, then xp_str to its left
        needed_w = int(draw.textlength(needed_str, font=next_font))
        xp_w     = int(draw.textlength(xp_str, font=xp_font))
        needed_x = BAR_RIGHT - needed_w
        xp_x     = needed_x - 14 - xp_w
        draw.text((xp_x, BELOW_Y), xp_str, font=xp_font, fill=(*white, 255))
        draw.text(
            (needed_x, BELOW_Y + 8),
            needed_str,
            font=next_font, fill=(*secondary_txt, 200),
        )

    # ── Stats row: messages, voice time, rep ──────────────────────────────────
    stat_font = _font(18, bold=False)
    stat_y = BELOW_Y + 42 if show_total_xp else BAR_Y + BAR_H + 12
    stats_parts = []
    if message_count > 0:
        stats_parts.append(f"📝 {message_count:,} msgs")
    if voice_minutes > 0:
        if voice_minutes >= 60:
            stats_parts.append(f"🔊 {voice_minutes // 60}h {voice_minutes % 60}m")
        else:
            stats_parts.append(f"🔊 {voice_minutes}m")
    if rep_score > 0:
        stats_parts.append(f"⭐ {rep_score} rep")
    if stats_parts:
        stats_str = "  •  ".join(stats_parts)
        draw.text((BAR_X, stat_y), stats_str, font=stat_font, fill=(*secondary_txt, 180))

    # ── Badges ────────────────────────────────────────────────────────────────
    if badges:
        BADGE_DEFS = {
            "early_member": ("🏅", (255, 215, 0)),
            "top_10": ("🏆", (255, 165, 0)),
            "voice_king": ("👑", (148, 0, 211)),
            "rep_master": ("⭐", (255, 255, 0)),
            "msg_master": ("💬", (0, 191, 255)),
            "streaker": ("🔥", (255, 69, 0)),
        }
        badge_x = BAR_X
        badge_y = stat_y + 28 if stats_parts else stat_y
        badge_font = _font(20, bold=True)
        for b in badges[:6]:
            emoji, color = BADGE_DEFS.get(b, ("🏷️", (200, 200, 200)))
            # Draw badge circle background
            draw.ellipse(
                (badge_x, badge_y, badge_x + 28, badge_y + 28),
                fill=(*color, 60),
            )
            draw.text((badge_x + 4, badge_y + 2), emoji, font=badge_font, fill=(*white, 255))
            badge_x += 36

    # ── Final rounded clip  radius:24 ────────────────────────────────────────
    out_mask = _rounded_mask((CARD_W, CARD_H), 24)
    clipped  = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, 0))
    clipped.alpha_composite(img)
    clipped.putalpha(out_mask)
    buf = BytesIO()
    clipped.save(buf, format="PNG", optimize=True)
    buf.seek(0)
    return buf


def demo_rank_card(**overrides: Any) -> BytesIO:
    data: dict[str, Any] = {
        "username": "cmddata",
        "display_name": "cmddata",
        "level": 250,
        "rank": 1,
        "xp": 3_120_150,
        "progress": 3_120_150,
        "needed": 3_125_100,
        "server": "Discord Server",
        "accent": "#F5A623",
        "secondary_accent": "#7A5CFF",
        "percent": 82,
        "bot_name": "ShopBot",
        "bot_avatar_bytes": None,
    }
    data.update(overrides)
    return make_rank_card(**data)
