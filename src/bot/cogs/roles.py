# src/bot/cogs/roles.py
"""Button Roles & Select Menu Roles — persistent views that toggle roles on interaction."""
import discord
import logging
from discord.ext import commands
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import ButtonRole, SelectMenuRole
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)


def _apply_embed_extras(embed: discord.Embed, panel) -> None:
    """Apply footer, image, thumbnail, and fields from a panel to an embed."""
    if getattr(panel, "embed_footer", None):
        embed.set_footer(text=panel.embed_footer)
    if getattr(panel, "embed_image_url", None):
        embed.set_image(url=panel.embed_image_url)
    if getattr(panel, "embed_thumbnail_url", None):
        embed.set_thumbnail(url=panel.embed_thumbnail_url)
    for f in (getattr(panel, "embed_fields", None) or []):
        embed.add_field(
            name=f.get("name", ""),
            value=f.get("value", ""),
            inline=f.get("inline", False),
        )


# ── Persistent Views ──────────────────────────────────────────────────────────

class ButtonRoleView(discord.ui.View):
    """One view per ButtonRole panel. Each button toggles a role."""

    def __init__(self, panel: ButtonRole):
        super().__init__(timeout=None)
        for btn in (panel.buttons or []):
            self.add_item(ButtonRoleButton(
                role_id=int(btn["role_id"]),
                label=btn.get("label", "Role"),
                emoji=btn.get("emoji") or None,
                style_name=btn.get("style", "primary"),
                row=btn.get("row", 0),
                panel_id=panel.id,
            ))


class ButtonRoleButton(discord.ui.Button):
    def __init__(self, role_id: int, label: str, emoji: str | None, style_name: str, row: int, panel_id: int):
        style_map = {
            "primary": discord.ButtonStyle.primary,
            "secondary": discord.ButtonStyle.secondary,
            "success": discord.ButtonStyle.success,
            "danger": discord.ButtonStyle.danger,
        }
        super().__init__(
            label=label,
            emoji=emoji,
            style=style_map.get(style_name, discord.ButtonStyle.primary),
            custom_id=f"brole:{panel_id}:{role_id}",
            row=min(row, 4),
        )
        self.role_id = role_id

    async def callback(self, interaction: discord.Interaction):
        role = interaction.guild.get_role(self.role_id)
        if not role:
            return await interaction.response.send_message("❌ Role không tồn tại.", ephemeral=True)
        member = interaction.user
        if role in member.roles:
            await member.remove_roles(role, reason="Button Role toggle")
            await interaction.response.send_message(f"➖ Đã gỡ role **{role.name}**", ephemeral=True)
        else:
            await member.add_roles(role, reason="Button Role toggle")
            await interaction.response.send_message(f"➕ Đã thêm role **{role.name}**", ephemeral=True)


class SelectMenuRoleView(discord.ui.View):
    """One view per SelectMenuRole panel."""

    def __init__(self, panel: SelectMenuRole):
        super().__init__(timeout=None)
        options = []
        for opt in (panel.options or []):
            options.append(discord.SelectOption(
                label=opt.get("label", "Role"),
                value=str(opt.get("role_id", "0")),
                emoji=opt.get("emoji") or None,
                description=opt.get("description") or None,
            ))
        if options:
            self.add_item(SelectMenuRoleSelect(
                panel_id=panel.id,
                options=options,
                placeholder=panel.placeholder or "Chọn role...",
                min_values=panel.min_values or 0,
                max_values=min(panel.max_values or 1, len(options)),
            ))


class SelectMenuRoleSelect(discord.ui.Select):
    def __init__(self, panel_id: int, options: list, placeholder: str, min_values: int, max_values: int):
        super().__init__(
            custom_id=f"srole:{panel_id}",
            placeholder=placeholder,
            min_values=min_values,
            max_values=max_values,
            options=options,
        )

    async def callback(self, interaction: discord.Interaction):
        member = interaction.user
        selected_role_ids = {int(v) for v in self.values}
        all_role_ids = {int(opt.value) for opt in self.options}

        added = []
        removed = []
        for rid in all_role_ids:
            role = interaction.guild.get_role(rid)
            if not role:
                continue
            if rid in selected_role_ids and role not in member.roles:
                await member.add_roles(role, reason="Select Menu Role")
                added.append(role.name)
            elif rid not in selected_role_ids and role in member.roles:
                await member.remove_roles(role, reason="Select Menu Role")
                removed.append(role.name)

        parts = []
        if added:
            parts.append(f"➕ Thêm: {', '.join(added)}")
        if removed:
            parts.append(f"➖ Gỡ: {', '.join(removed)}")
        if not parts:
            parts.append("Không có thay đổi.")
        await interaction.response.send_message("\n".join(parts), ephemeral=True)


# ── Cog ───────────────────────────────────────────────────────────────────────

class RolesCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_ready(self):
        if not check_feature(self): return
        """Register persistent views for all existing panels."""
        db = SessionLocal()
        try:
            button_panels = db.execute(select(ButtonRole)).scalars().all()
            for p in button_panels:
                if p.message_id:  # only if deployed
                    self.bot.add_view(ButtonRoleView(p), message_id=int(p.message_id))

            select_panels = db.execute(select(SelectMenuRole)).scalars().all()
            for p in select_panels:
                if p.message_id:
                    self.bot.add_view(SelectMenuRoleView(p), message_id=int(p.message_id))
            logger.info(f"Registered {len(button_panels)} button role + {len(select_panels)} select role persistent views")
        finally:
            db.close()

    # ── Deploy commands ───────────────────────────────────────────────────

    roles_group = discord.SlashCommandGroup("roles", "Quản lý role panels")

    @roles_group.command(name="deploy-button", description="[Admin] Deploy button role panel lên kênh")
    @discord.default_permissions(manage_roles=True)
    async def deploy_button(
        self,
        ctx: discord.ApplicationContext,
        panel_id: discord.Option(int, "ID của panel"),
        channel: discord.Option(discord.TextChannel, "Kênh deploy") = None,
    ):
        target_ch = channel or ctx.channel
        db = SessionLocal()
        try:
            panel = db.get(ButtonRole, panel_id)
            if not panel:
                return await ctx.respond("❌ Panel không tồn tại.", ephemeral=True)

            embed = discord.Embed(
                title=panel.embed_title or "🎭 Chọn Role",
                description=panel.embed_description or "Nhấn nút bên dưới để nhận/gỡ role.",
                color=int(panel.embed_color.lstrip("#"), 16) if panel.embed_color else 0x5865F2,
            )
            _apply_embed_extras(embed, panel)
            view = ButtonRoleView(panel)
            msg = await target_ch.send(embed=embed, view=view)
            panel.channel_id = str(target_ch.id)
            panel.message_id = str(msg.id)
            db.commit()
            self.bot.add_view(view, message_id=msg.id)
            await ctx.respond(f"✅ Đã deploy button role panel #{panel_id} tại {target_ch.mention}", ephemeral=True)
        finally:
            db.close()

    @roles_group.command(name="deploy-select", description="[Admin] Deploy select menu role panel lên kênh")
    @discord.default_permissions(manage_roles=True)
    async def deploy_select(
        self,
        ctx: discord.ApplicationContext,
        panel_id: discord.Option(int, "ID của panel"),
        channel: discord.Option(discord.TextChannel, "Kênh deploy") = None,
    ):
        target_ch = channel or ctx.channel
        db = SessionLocal()
        try:
            panel = db.get(SelectMenuRole, panel_id)
            if not panel:
                return await ctx.respond("❌ Panel không tồn tại.", ephemeral=True)

            embed = discord.Embed(
                title=panel.embed_title or "🎭 Chọn Role",
                description=panel.embed_description or "Chọn role từ menu bên dưới.",
                color=int(panel.embed_color.lstrip("#"), 16) if panel.embed_color else 0x5865F2,
            )
            _apply_embed_extras(embed, panel)
            view = SelectMenuRoleView(panel)
            msg = await target_ch.send(embed=embed, view=view)
            panel.channel_id = str(target_ch.id)
            panel.message_id = str(msg.id)
            db.commit()
            self.bot.add_view(view, message_id=msg.id)
            await ctx.respond(f"✅ Đã deploy select role panel #{panel_id} tại {target_ch.mention}", ephemeral=True)
        finally:
            db.close()
