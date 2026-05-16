# src/bot/cogs/temp_voice.py
import discord
import logging
import datetime
from discord.ext import tasks
from sqlalchemy import select
from src.database.config import SessionLocal
from src.models.models import TempVoiceConfig, TempVoiceRoom, LoggingConfig, LogEntry
from src.bot.base_cog import check_feature
from src.bot.embed_utils import build_embed

logger = logging.getLogger(__name__)

# In-memory rename cooldown: {channel_id: last_rename_ts}
_rename_cooldowns: dict[str, float] = {}


def get_session():
    return SessionLocal()


TEMPVOICE_BUTTONS = {
    "name": {"label": "Name", "emoji": "✏️", "style": discord.ButtonStyle.primary},
    "limit": {"label": "Limit", "emoji": "👥", "style": discord.ButtonStyle.primary},
    "privacy": {"label": "Privacy", "emoji": "🔐", "style": discord.ButtonStyle.secondary},
    "trust": {"label": "Trust", "emoji": "✅", "style": discord.ButtonStyle.success},
    "untrust": {"label": "Untrust", "emoji": "➖", "style": discord.ButtonStyle.secondary},
    "invite": {"label": "Invite", "emoji": "📨", "style": discord.ButtonStyle.success},
    "kick": {"label": "Kick", "emoji": "👢", "style": discord.ButtonStyle.danger},
    "region": {"label": "Region", "emoji": "🌍", "style": discord.ButtonStyle.primary},
    "block": {"label": "Block", "emoji": "🚫", "style": discord.ButtonStyle.danger},
    "unblock": {"label": "Unblock", "emoji": "🔓", "style": discord.ButtonStyle.success},
    "claim": {"label": "Claim", "emoji": "🙋", "style": discord.ButtonStyle.success},
    "transfer": {"label": "Transfer", "emoji": "👑", "style": discord.ButtonStyle.primary},
    "delete": {"label": "Delete", "emoji": "🗑️", "style": discord.ButtonStyle.danger},
}
TEMPVOICE_DEFAULT_BUTTONS = ["name", "limit", "privacy", "trust", "untrust", "invite", "kick", "region", "block", "unblock", "claim", "transfer", "delete"]
TEMPVOICE_ACTION_ALIASES = {
    "rename": "name", "private": "privacy", "public": "privacy",
    "permit": "trust", "reject": "block", "boot": "kick",
}


def normalize_tempvoice_buttons(buttons: list[str] | None) -> list[str]:
    if not buttons:
        return TEMPVOICE_DEFAULT_BUTTONS.copy()
    legacy_buttons = {"lock", "unlock", "hide", "unhide", "rename", "bitrate", "private", "public", "permit", "reject", "boot", "mute", "unmute"}
    if any(button in legacy_buttons for button in buttons):
        return TEMPVOICE_DEFAULT_BUTTONS.copy()
    normalized: list[str] = []
    for button in buttons:
        action = TEMPVOICE_ACTION_ALIASES.get(button, button)
        if action in TEMPVOICE_BUTTONS and action not in normalized:
            normalized.append(action)
    if len(normalized) < len(TEMPVOICE_DEFAULT_BUTTONS):
        return TEMPVOICE_DEFAULT_BUTTONS.copy()
    return normalized


async def _respond_interaction(interaction: discord.Interaction, message: str):
    if interaction.response.is_done():
        await interaction.followup.send(message, ephemeral=True)
    else:
        await interaction.response.send_message(message, ephemeral=True)


class _VoiceTextModal(discord.ui.Modal):
    def __init__(self, action: str, title: str, label: str, placeholder: str = ""):
        super().__init__(title=title)
        self.action = action
        self.value_input = discord.ui.InputText(
            label=label,
            placeholder=placeholder,
            style=discord.InputTextStyle.short,
            required=True,
            max_length=100,
        )
        self.add_item(self.value_input)

    async def callback(self, interaction: discord.Interaction):
        value = str(self.value_input.value).strip()
        await handle_voice_button(interaction, self.action, value)


async def _get_interaction_room(interaction: discord.Interaction, owner_required: bool = True):
    if not interaction.user.voice or not interaction.user.voice.channel:
        await _respond_interaction(interaction, "❌ Bạn phải ở trong phòng voice.")
        return None, None, None
    session = get_session()
    try:
        ch = interaction.user.voice.channel
        room = _get_room(session, str(ch.id))
        if not room:
            await _respond_interaction(interaction, "❌ Phòng này không phải temp voice.")
            session.close()
            return None, None, None
        if owner_required and room.owner_id != str(interaction.user.id):
            await _respond_interaction(interaction, "❌ Bạn không phải chủ phòng.")
            session.close()
            return None, None, None
        return session, ch, room
    except Exception:
        session.close()
        return None, None, None


async def _log_tempvoice_action(
    interaction: discord.Interaction,
    action: str,
    channel: discord.VoiceChannel,
    target: discord.Member | None = None,
    details: dict | None = None,
):
    session = get_session()
    try:
        cfg = session.execute(
            select(LoggingConfig).where(LoggingConfig.guild_id == str(interaction.guild_id))
        ).scalars().first()
        if not cfg:
            return
        action_labels = {
            "name": "đổi tên phòng", "limit": "đổi giới hạn", "privacy": "đổi riêng tư/công khai",
            "trust": "tin cậy user", "untrust": "bỏ tin cậy user", "invite": "mời user",
            "kick": "đuổi user", "region": "đổi region", "block": "chặn user", "unblock": "bỏ chặn user",
            "transfer": "chuyển chủ phòng", "claim": "nhận chủ phòng", "delete": "xóa phòng",
            "lock": "khóa phòng", "unlock": "mở khóa phòng", "hide": "ẩn phòng", "unhide": "hiện phòng",
            "rename": "đổi tên phòng", "private": "chuyển riêng tư", "public": "mở công khai",
            "permit": "cho phép user", "reject": "chặn user", "boot": "đuổi user",
            "mute": "mute user", "unmute": "unmute user",
        }
        label = action_labels.get(action, action)
        embed = build_embed("tempvoice_action", session, vars={
            "user": interaction.user.display_name,
            "user.mention": interaction.user.mention,
            "user.id": str(interaction.user.id),
            "target": target.display_name if target else "—",
            "target.mention": target.mention if target else "—",
            "target.id": str(target.id) if target else "—",
            "channel.name": channel.name,
            "channel.mention": channel.mention,
            "channel.id": str(channel.id),
            "action": label,
            "details": ", ".join(f"{k}: {v}" for k, v in (details or {}).items()) or "—",
        })
        entry = LogEntry(
            guild_id=str(interaction.guild_id),
            event_type="tempvoice_action",
            category="voice",
            actor_id=str(interaction.user.id),
            actor_name=str(interaction.user),
            actor_avatar=interaction.user.display_avatar.url,
            target_id=str(target.id) if target else str(channel.id),
            target_name=str(target) if target else channel.name,
            description=f"{interaction.user} {label} {channel.name}",
            details={"action": action, "channel_id": str(channel.id), **(details or {})},
        )
        session.add(entry)
        session.commit()
        if cfg.voice_log_channel_id:
            log_channel = interaction.guild.get_channel(int(cfg.voice_log_channel_id))
            if log_channel:
                await log_channel.send(embed=embed)
    except Exception as e:
        logger.error(f"_log_tempvoice_action error: {e}")
    finally:
        session.close()


async def _apply_member_action(interaction: discord.Interaction, action: str, user: discord.Member):
    session, ch, room = await _get_interaction_room(interaction, owner_required=True)
    if not ch:
        return
    try:
        if action == "trust":
            await ch.set_permissions(user, connect=True, view_channel=True)
            await _respond_interaction(interaction, f"✅ Đã trust {user.mention} vào phòng.")
        elif action == "untrust":
            await ch.set_permissions(user, overwrite=None)
            await _respond_interaction(interaction, f"➖ Đã gỡ trust/untrust của {user.mention}.")
        elif action == "invite":
            await ch.set_permissions(user, connect=True, view_channel=True)
            await _respond_interaction(interaction, f"📨 Đã mời {user.mention} vào phòng {ch.mention}.")
            try:
                await user.send(f"📨 {interaction.user.mention} mời bạn vào phòng voice **{ch.name}** trong **{interaction.guild.name}**.")
            except Exception:
                pass
        elif action == "block":
            await ch.set_permissions(user, connect=False, view_channel=False)
            if user in ch.members:
                await user.move_to(None)
            await _respond_interaction(interaction, f"🚫 Đã block {user.mention}.")
        elif action == "unblock":
            await ch.set_permissions(user, overwrite=None)
            await _respond_interaction(interaction, f"🔓 Đã unblock {user.mention}.")
        elif action == "kick":
            if user in ch.members:
                await user.move_to(None)
            await _respond_interaction(interaction, f"👢 Đã kick {user.mention} ra khỏi phòng.")
        elif action == "transfer":
            room.owner_id = str(user.id)
            session.commit()
            await _respond_interaction(interaction, f"👑 Đã chuyển quyền chủ phòng cho {user.mention}.")
        await _log_tempvoice_action(interaction, action, ch, target=user)
    except Exception as e:
        logger.error(f"_apply_member_action error: {e}")
        await _respond_interaction(interaction, "❌ Lỗi khi xử lý user.")
    finally:
        session.close()


class _VoiceUserSelectView(discord.ui.View):
    def __init__(self, action: str):
        super().__init__(timeout=60)
        self.add_item(_VoiceUserSelect(action))


class _VoiceUserSelect(discord.ui.Select):
    def __init__(self, action: str):
        labels = {
            "trust": "Chọn user để trust",
            "untrust": "Chọn user để gỡ trust",
            "invite": "Chọn user để invite",
            "kick": "Chọn user cần kick",
            "block": "Chọn user cần block",
            "unblock": "Chọn user cần unblock",
            "transfer": "Chọn chủ phòng mới",
        }
        super().__init__(
            discord.ComponentType.user_select,
            placeholder=labels.get(action, "Chọn user"),
            min_values=1,
            max_values=1,
            custom_id=f"tempvoice_user:{action}",
        )
        self.action = action

    async def callback(self, interaction: discord.Interaction):
        user = self.values[0] if self.values else None
        if not isinstance(user, discord.Member):
            await _respond_interaction(interaction, "❌ Vui lòng chọn thành viên trong server.")
            return
        await _apply_member_action(interaction, self.action, user)


async def handle_voice_button(interaction: discord.Interaction, action: str, value: str | None = None):
    action = TEMPVOICE_ACTION_ALIASES.get(action, action)
    owner_required = action != "claim"
    session, ch, room = await _get_interaction_room(interaction, owner_required=owner_required)
    if not ch:
        return
    try:
        # ── Permission gates ─────────────────────────────────
        config = session.execute(
            select(TempVoiceConfig).where(
                TempVoiceConfig.guild_id == str(interaction.guild_id),
                TempVoiceConfig.enabled == True,
            )
        ).scalars().first()
        if config:
            bypass_ids = set(config.bypass_role_ids or [])
            user_role_ids = {str(r.id) for r in interaction.user.roles}
            is_bypass = bool(user_role_ids & bypass_ids)
            if not is_bypass:
                perm_map = {
                    "name": config.allow_rename,
                    "limit": config.allow_limit,
                    "privacy": config.allow_lock,
                    "trust": config.allow_invite,
                    "untrust": config.allow_invite,
                    "invite": config.allow_invite,
                    "kick": config.allow_kick,
                    "transfer": config.allow_transfer,
                    "claim": config.allow_claim,
                }
                allowed = perm_map.get(action, True)
                if allowed is False:
                    await _respond_interaction(interaction, "❌ Tính năng này đã bị tắt.")
                    session.close()
                    return
                # Rename cooldown
                if action == "name" and (config.rename_cooldown_seconds or 0) > 0:
                    import time
                    last = _rename_cooldowns.get(str(ch.id), 0)
                    elapsed = time.time() - last
                    if elapsed < config.rename_cooldown_seconds:
                        remaining = int(config.rename_cooldown_seconds - elapsed)
                        await _respond_interaction(interaction, f"⏳ Vui lòng chờ **{remaining}s** trước khi đổi tên.")
                        session.close()
                        return
                    if value is not None:
                        _rename_cooldowns[str(ch.id)] = time.time()
        if action == "name":
            if value is None:
                await interaction.response.send_modal(_VoiceTextModal("name", "Đổi tên phòng", "Tên mới", "Phòng của bạn"))
                return
            await ch.edit(name=value[:100])
            await _respond_interaction(interaction, f"✏️ Đổi tên thành **{value}**.")
            await _log_tempvoice_action(interaction, action, ch, details={"name": value[:100]})
        elif action == "limit":
            if value is None:
                await interaction.response.send_modal(_VoiceTextModal("limit", "Giới hạn người", "Số người (0-99)", "5"))
                return
            limit = max(0, min(99, int(value)))
            await ch.edit(user_limit=limit)
            await _respond_interaction(interaction, f"👥 Giới hạn: **{limit if limit > 0 else 'Không giới hạn'}**.")
            await _log_tempvoice_action(interaction, action, ch, details={"limit": limit})
        elif action == "privacy":
            current = ch.overwrites_for(interaction.guild.default_role)
            is_private = current.connect is False or current.view_channel is False
            if is_private:
                await ch.set_permissions(interaction.guild.default_role, connect=True, view_channel=True)
                await _respond_interaction(interaction, "🌐 Phòng đã mở công khai.")
            else:
                await ch.set_permissions(interaction.guild.default_role, connect=False, view_channel=False)
                await _respond_interaction(interaction, "🔐 Phòng đã chuyển sang riêng tư.")
            await _log_tempvoice_action(interaction, action, ch)
        elif action == "region":
            await ch.edit(rtc_region=None)
            await _respond_interaction(interaction, "🌍 Region đã đặt về Automatic.")
            await _log_tempvoice_action(interaction, action, ch, details={"region": "automatic"})
        elif action in {"trust", "untrust", "invite", "kick", "block", "unblock", "transfer"}:
            labels = {
                "trust": "Trust user", "untrust": "Untrust user", "invite": "Invite user",
                "kick": "Kick user", "block": "Block user", "unblock": "Unblock user", "transfer": "Transfer owner",
            }
            await interaction.response.send_message(
                f"{TEMPVOICE_BUTTONS[action]['emoji']} **{labels[action]}** — chọn thành viên bên dưới.",
                view=_VoiceUserSelectView(action),
                ephemeral=True,
            )
        elif action == "claim":
            owner = ch.guild.get_member(int(room.owner_id)) if room.owner_id else None
            if owner and owner in ch.members:
                await _respond_interaction(interaction, "❌ Chủ phòng hiện tại vẫn trong phòng.")
                return
            room.owner_id = str(interaction.user.id)
            session.commit()
            await _respond_interaction(interaction, "👑 Bạn đã trở thành chủ phòng.")
            await _log_tempvoice_action(interaction, action, ch)
        elif action == "delete":
            await _respond_interaction(interaction, "🗑️ Đã xóa phòng voice.")
            await _log_tempvoice_action(interaction, action, ch)
            if room:
                session.delete(room)
                session.commit()
            await ch.delete()
    except ValueError:
        await _respond_interaction(interaction, "❌ Giá trị không hợp lệ.")
    except Exception as e:
        logger.error(f"handle_voice_button error: {e}")
        await _respond_interaction(interaction, "❌ Lỗi khi xử lý nút.")
    finally:
        session.close()


class TempVoicePanelView(discord.ui.View):
    def __init__(self, buttons: list[str] | None = None):
        super().__init__(timeout=None)
        # Panel theo yêu cầu cố định đủ 13 nút; không để config cũ/rút gọn làm thiếu nút.
        for index, action in enumerate(TEMPVOICE_DEFAULT_BUTTONS):
            meta = TEMPVOICE_BUTTONS.get(action)
            if not meta:
                continue
            self.add_item(_TempVoiceButton(action, meta, row=index // 5))


class _TempVoiceButton(discord.ui.Button):
    def __init__(self, action: str, meta: dict, row: int | None = None):
        super().__init__(
            label=meta["label"],
            emoji=meta["emoji"],
            style=meta["style"],
            custom_id=f"tempvoice:{action}",
            row=row,
        )
        self.action = action

    async def callback(self, interaction: discord.Interaction):
        await handle_voice_button(interaction, self.action)



def _get_room(session, channel_id: str):
    return session.execute(
        select(TempVoiceRoom).where(TempVoiceRoom.channel_id == channel_id)
    ).scalars().first()


class TempVoiceCog(discord.Cog):
    def __init__(self, bot):
        self.bot = bot
        self._cleanup_task_started = False

    @discord.Cog.listener()
    async def on_ready(self):
        try:
            self.bot.add_view(TempVoicePanelView(TEMPVOICE_DEFAULT_BUTTONS))
        except Exception as e:
            logger.error(f"temp voice persistent view error: {e}")
        if not self._cleanup_task_started:
            self._cleanup_task_started = True
            self.inactive_room_cleanup.start()

    def cog_unload(self):
        self.inactive_room_cleanup.cancel()

    @tasks.loop(minutes=1)
    async def inactive_room_cleanup(self):
        """Auto-delete rooms that have been empty longer than inactive_cleanup_minutes."""
        session = get_session()
        try:
            all_configs = session.execute(select(TempVoiceConfig)).scalars().all()
            for config in all_configs:
                if not config.enabled or not (config.inactive_cleanup_minutes or 0):
                    continue
                cutoff = datetime.datetime.utcnow() - datetime.timedelta(minutes=config.inactive_cleanup_minutes)
                rooms = session.execute(
                    select(TempVoiceRoom).where(TempVoiceRoom.guild_id == config.guild_id)
                ).scalars().all()
                for room in rooms:
                    guild = self.bot.get_guild(int(config.guild_id)) if config.guild_id else None
                    if not guild:
                        continue
                    ch = guild.get_channel(int(room.channel_id))
                    if ch and len(ch.members) == 0 and room.created_at and room.created_at < cutoff:
                        try:
                            if room.panel_channel_id and room.panel_message_id:
                                panel_ch = guild.get_channel(int(room.panel_channel_id))
                                if panel_ch:
                                    msg = await panel_ch.fetch_message(int(room.panel_message_id))
                                    await msg.delete()
                        except Exception:
                            pass
                        try:
                            await ch.delete(reason="Inactive TempVoice room cleanup")
                        except Exception:
                            pass
                        session.delete(room)
            session.commit()
        except Exception as e:
            logger.error(f"inactive_room_cleanup error: {e}")
        finally:
            session.close()

    # ── Events ──────────────────────────────────────────────

    @discord.Cog.listener()
    async def on_voice_state_update(self, member: discord.Member, before, after):
        if not check_feature(self): return
        session = get_session()
        try:
            config = session.execute(
                select(TempVoiceConfig).where(
                    TempVoiceConfig.guild_id == str(member.guild.id),
                    TempVoiceConfig.enabled == True,
                )
            ).scalars().first()
            if not config or not config.join_channel_id:
                return

            # User join "Join to Create"
            if after.channel and str(after.channel.id) == config.join_channel_id:
                # ── Anti-abuse checks ─────────────────────────────────────
                member_role_ids = {str(r.id) for r in member.roles}
                blacklist = set(config.blacklist_role_ids or [])
                bypass = set(config.bypass_role_ids or [])
                is_bypass = bool(member_role_ids & bypass)

                if not is_bypass and (blacklist & member_role_ids):
                    try:
                        await member.move_to(None)
                    except Exception:
                        pass
                    return

                if not is_bypass:
                    max_per_user = config.max_rooms_per_user or 0
                    if max_per_user > 0:
                        user_rooms = session.execute(
                            select(TempVoiceRoom).where(
                                TempVoiceRoom.guild_id == str(member.guild.id),
                                TempVoiceRoom.owner_id == str(member.id),
                            )
                        ).scalars().all()
                        if len(user_rooms) >= max_per_user:
                            try:
                                await member.move_to(None)
                            except Exception:
                                pass
                            return

                    max_per_guild = config.max_rooms_per_guild or 0
                    if max_per_guild > 0:
                        guild_rooms = session.execute(
                            select(TempVoiceRoom).where(TempVoiceRoom.guild_id == str(member.guild.id))
                        ).scalars().all()
                        if len(guild_rooms) >= max_per_guild:
                            try:
                                await member.move_to(None)
                            except Exception:
                                pass
                            return

                category = member.guild.get_channel(int(config.category_id)) if config.category_id else after.channel.category
                # Apply saved config
                naming = (config.naming_format or "🎙 {user}").replace("{user}", member.display_name)
                user_limit = config.default_user_limit or 0
                bitrate = config.default_bitrate or 64000
                # Clamp bitrate to guild limits
                max_bitrate = member.guild.bitrate_limit
                bitrate = min(bitrate, max_bitrate)

                new_ch = await member.guild.create_voice_channel(
                    name=naming,
                    category=category,
                    user_limit=user_limit,
                    bitrate=bitrate,
                )
                # Apply default visibility
                visibility = config.default_visibility or "public"
                if visibility == "private":
                    try:
                        await new_ch.set_permissions(member.guild.default_role, connect=False, view_channel=False)
                        await new_ch.set_permissions(member, connect=True, view_channel=True)
                    except Exception:
                        pass
                await member.move_to(new_ch)
                room = TempVoiceRoom(
                    channel_id=str(new_ch.id),
                    owner_id=str(member.id),
                    guild_id=str(member.guild.id),
                    room_name=naming,
                    peak_members=1,
                )
                session.add(room)
                session.commit()

                if config.interface_channel_id:
                    text_ch = member.guild.get_channel(int(config.interface_channel_id))
                    if text_ch:
                        buttons = normalize_tempvoice_buttons(config.voice_buttons)
                        button_labels = []
                        for action in buttons:
                            meta = TEMPVOICE_BUTTONS.get(action)
                            if meta:
                                button_labels.append(f"{meta['emoji']} {meta['label']}")
                        embed = build_embed("tempvoice_panel", session, vars={
                            "server": member.guild.name,
                            "panel.channel": text_ch.mention,
                            "buttons": ", ".join(button_labels) or "—",
                            "button.count": str(len(button_labels)),
                        })
                        msg = await text_ch.send(embed=embed, view=TempVoicePanelView(buttons))
                        room.panel_channel_id = str(text_ch.id)
                        room.panel_message_id = str(msg.id)
                        session.commit()

            # User rời → xóa room nếu trống / track peak
            if before.channel and before.channel != after.channel:
                room = _get_room(session, str(before.channel.id))
                if room:
                    ch = member.guild.get_channel(int(room.channel_id))
                    if ch:
                        # Track peak members for rooms that member joins
                        current_count = len(ch.members)
                        if after.channel and str(after.channel.id) != config.join_channel_id if config else True:
                            pass  # already counted on join
                        if current_count == 0:
                            if room.panel_channel_id and room.panel_message_id:
                                try:
                                    panel_ch = member.guild.get_channel(int(room.panel_channel_id))
                                    if panel_ch:
                                        msg = await panel_ch.fetch_message(int(room.panel_message_id))
                                        await msg.delete()
                                except Exception as e:
                                    logger.warning(f"delete temp voice panel message failed: {e}")
                            await ch.delete()
                            session.delete(room)
                            session.commit()
            # Track peak_members when someone joins an existing room
            if after.channel and after.channel.id != (int(config.join_channel_id) if config and config.join_channel_id else 0):
                room = _get_room(session, str(after.channel.id))
                if room:
                    current_count = len(after.channel.members)
                    if current_count > (room.peak_members or 0):
                        room.peak_members = current_count
                        session.commit()
        except Exception as e:
            logger.error(f"on_voice_state_update error: {e}")
        finally:
            session.close()

    # ── Helper ──────────────────────────────────────────────

    async def _get_user_room(self, ctx: discord.ApplicationContext):
        """Trả về (channel, room_record) nếu user đang trong temp room của mình."""
        if not ctx.author.voice or not ctx.author.voice.channel:
            await ctx.respond("❌ Bạn phải ở trong phòng voice.", ephemeral=True)
            return None, None
        session = get_session()
        try:
            room = _get_room(session, str(ctx.author.voice.channel.id))
            if not room:
                await ctx.respond("❌ Phòng này không phải temp voice.", ephemeral=True)
                session.close()
                return None, None
            if room.owner_id != str(ctx.author.id):
                await ctx.respond("❌ Bạn không phải chủ phòng.", ephemeral=True)
                session.close()
                return None, None
            ch = ctx.author.voice.channel
            session.close()
            return ch, room
        except Exception:
            session.close()
            return None, None

    tempvoice = discord.SlashCommandGroup(
        "tempvoice",
        "Quản lý temp voice",
        default_member_permissions=discord.Permissions(administrator=True),
    )

    @tempvoice.command(name="panel", description="[Admin] Gửi panel điều khiển temp voice vào kênh")
    @discord.default_permissions(administrator=True)
    async def send_tempvoice_panel(
        self,
        ctx: discord.ApplicationContext,
        channel: discord.Option(discord.TextChannel, "Kênh gửi panel", required=False) = None,
    ):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            target_channel = channel or ctx.channel
            config = session.execute(
                select(TempVoiceConfig).where(TempVoiceConfig.guild_id == str(ctx.guild.id))
            ).scalars().first()
            if not config:
                config = TempVoiceConfig(guild_id=str(ctx.guild.id), enabled=True)
                session.add(config)
                session.flush()
            config.interface_channel_id = str(target_channel.id)
            buttons = normalize_tempvoice_buttons(config.voice_buttons)
            if config.voice_buttons != buttons:
                config.voice_buttons = buttons
            button_names = [TEMPVOICE_BUTTONS[b]["label"] for b in buttons if b in TEMPVOICE_BUTTONS]
            embed = build_embed("tempvoice_panel", session, vars={
                "server": ctx.guild.name,
                "panel.channel": target_channel.mention,
                "channel.name": target_channel.name,
                "channel.mention": target_channel.mention,
                "channel.id": str(target_channel.id),
                "buttons": ", ".join(button_names) or "Mặc định",
                "button.count": str(len(button_names)),
            })
            msg = await target_channel.send(embed=embed, view=TempVoicePanelView(buttons))
            session.commit()
            await ctx.followup.send(
                f"✅ Đã gửi panel temp voice vào {target_channel.mention}.\n"
                f"Panel ID: `{msg.id}` • Interface channel đã được cập nhật.",
                ephemeral=True,
            )
        except Exception as e:
            session.rollback()
            logger.error(f"send_tempvoice_panel error: {e}")
            await ctx.followup.send("❌ Không gửi được panel temp voice.", ephemeral=True)
        finally:
            session.close()

    # ── Room commands ────────────────────────────────────────

    room = discord.SlashCommandGroup("room", "Quản lý phòng voice tạm thời")

    @room.command(name="lock", description="Khóa phòng")
    async def lock(self, ctx):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(ctx.guild.default_role, connect=False)
        await ctx.respond("🔒 Đã khóa phòng.", ephemeral=True)

    @room.command(name="unlock", description="Mở khóa phòng")
    async def unlock(self, ctx):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(ctx.guild.default_role, connect=True)
        await ctx.respond("🔓 Đã mở khóa phòng.", ephemeral=True)

    @room.command(name="hide", description="Ẩn phòng")
    async def hide(self, ctx):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(ctx.guild.default_role, view_channel=False)
        await ctx.respond("👁 Đã ẩn phòng.", ephemeral=True)

    @room.command(name="unhide", description="Hiện phòng")
    async def unhide(self, ctx):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(ctx.guild.default_role, view_channel=True)
        await ctx.respond("👁 Đã hiện phòng.", ephemeral=True)

    @room.command(name="rename", description="Đổi tên phòng")
    async def rename(self, ctx, name: discord.Option(str, "Tên mới")):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.edit(name=name[:100])
        await ctx.respond(f"✏️ Đổi tên thành **{name}**.", ephemeral=True)

    @room.command(name="limit", description="Giới hạn số người")
    async def limit(self, ctx, so: discord.Option(int, "Số người (0 = không giới hạn)", min_value=0, max_value=99)):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.edit(user_limit=so)
        await ctx.respond(f"👥 Giới hạn: **{so if so > 0 else 'Không giới hạn'}**.", ephemeral=True)

    @room.command(name="bitrate", description="Chỉnh bitrate (kbps)")
    async def bitrate(self, ctx, kbps: discord.Option(int, "Bitrate (8–384)", min_value=8, max_value=384)):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.edit(bitrate=kbps * 1000)
        await ctx.respond(f"🔊 Bitrate: **{kbps} kbps**.", ephemeral=True)

    @room.command(name="private", description="Chỉ cho phép người được cấp quyền vào")
    async def private(self, ctx):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(ctx.guild.default_role, connect=False, view_channel=False)
        await ctx.respond("🔐 Phòng đã chuyển sang chế độ riêng tư.", ephemeral=True)

    @room.command(name="public", description="Mở phòng cho mọi người")
    async def public(self, ctx):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(ctx.guild.default_role, connect=True, view_channel=True)
        await ctx.respond("🌐 Phòng đã mở công khai.", ephemeral=True)

    @room.command(name="permit", description="Cho phép user vào phòng")
    async def permit(self, ctx, user: discord.Option(discord.Member, "User")):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(user, connect=True, view_channel=True)
        await ctx.respond(f"✅ Đã cho phép {user.mention} vào phòng.", ephemeral=True)

    @room.command(name="reject", description="Chặn user vào phòng")
    async def reject(self, ctx, user: discord.Option(discord.Member, "User")):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(user, connect=False, view_channel=False)
        if user in ch.members:
            await user.move_to(None)
        await ctx.respond(f"🚫 Đã chặn {user.mention}.", ephemeral=True)

    @room.command(name="boot", description="Đuổi user ra khỏi phòng")
    async def boot_voice(self, ctx, user: discord.Option(discord.Member, "User")):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        if user in ch.members:
            await user.move_to(None)
        await ctx.respond(f"👢 Đã kick {user.mention} ra khỏi phòng.", ephemeral=True)

    @room.command(name="mute", description="Mute user trong phòng")
    async def mute_voice(self, ctx, user: discord.Option(discord.Member, "User")):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(user, speak=False)
        await ctx.respond(f"🔇 Đã mute {user.mention}.", ephemeral=True)

    @room.command(name="unmute", description="Unmute user trong phòng")
    async def unmute_voice(self, ctx, user: discord.Option(discord.Member, "User")):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.set_permissions(user, speak=True)
        await ctx.respond(f"🔊 Đã unmute {user.mention}.", ephemeral=True)

    @room.command(name="transfer", description="Chuyển quyền chủ phòng")
    async def transfer(self, ctx, user: discord.Option(discord.Member, "User mới")):
        ch, room = await self._get_user_room(ctx)
        if not ch: return
        session = get_session()
        try:
            r = _get_room(session, str(ch.id))
            if r:
                r.owner_id = str(user.id)
                session.commit()
            await ctx.respond(f"👑 Đã chuyển quyền chủ phòng cho {user.mention}.", ephemeral=True)
        finally:
            session.close()

    @room.command(name="claim", description="Nhận quyền chủ phòng nếu owner cũ đã rời")
    async def claim(self, ctx):
        if not ctx.author.voice or not ctx.author.voice.channel:
            await ctx.respond("❌ Bạn phải ở trong phòng voice.", ephemeral=True)
            return
        ch = ctx.author.voice.channel
        session = get_session()
        try:
            room = _get_room(session, str(ch.id))
            if not room:
                await ctx.respond("❌ Đây không phải temp room.", ephemeral=True)
                return
            owner = ch.guild.get_member(int(room.owner_id))
            if owner and owner in ch.members:
                await ctx.respond("❌ Chủ phòng hiện tại vẫn trong phòng.", ephemeral=True)
                return
            room.owner_id = str(ctx.author.id)
            session.commit()
            await ctx.respond(f"👑 Bạn đã trở thành chủ phòng.", ephemeral=True)
        finally:
            session.close()

    @room.command(name="owner", description="Xem chủ phòng hiện tại")
    async def owner(self, ctx):
        if not ctx.author.voice or not ctx.author.voice.channel:
            await ctx.respond("❌ Bạn phải ở trong phòng voice.", ephemeral=True)
            return
        session = get_session()
        try:
            room = _get_room(session, str(ctx.author.voice.channel.id))
            if not room:
                await ctx.respond("❌ Đây không phải temp room.", ephemeral=True)
                return
            await ctx.respond(f"👑 Chủ phòng: <@{room.owner_id}>", ephemeral=True)
        finally:
            session.close()

    @room.command(name="panel", description="Gửi lại panel điều khiển phòng voice")
    async def panel(
        self,
        ctx,
        channel: discord.Option(discord.TextChannel, "Kênh gửi panel", required=False) = None,
    ):
        ch, _ = await self._get_user_room(ctx)
        if not ch:
            return
        session = get_session()
        try:
            room = _get_room(session, str(ch.id))
            config = session.execute(
                select(TempVoiceConfig).where(
                    TempVoiceConfig.guild_id == str(ctx.guild.id),
                    TempVoiceConfig.enabled == True,
                )
            ).scalars().first()
            target_channel = channel or ctx.channel
            if room and room.panel_channel_id and room.panel_message_id:
                try:
                    old_ch = ctx.guild.get_channel(int(room.panel_channel_id))
                    if old_ch:
                        old_msg = await old_ch.fetch_message(int(room.panel_message_id))
                        await old_msg.delete()
                except Exception as e:
                    logger.warning(f"delete old temp voice panel failed: {e}")
            embed = build_embed("tempvoice_create", session, vars={
                "user": ctx.author.display_name,
                "user.mention": ctx.author.mention,
                "user.id": str(ctx.author.id),
                "channel.name": ch.name,
                "channel.mention": ch.mention,
                "channel.id": str(ch.id),
            })
            msg = await target_channel.send(
                embed=embed,
                view=TempVoicePanelView(normalize_tempvoice_buttons(config.voice_buttons if config else None)),
            )
            if room:
                room.panel_channel_id = str(target_channel.id)
                room.panel_message_id = str(msg.id)
                session.commit()
            await ctx.respond(f"✅ Đã gửi panel điều khiển vào {target_channel.mention}.", ephemeral=True)
        except Exception as e:
            logger.error(f"room panel error: {e}")
            await ctx.respond("❌ Không gửi được panel.", ephemeral=True)
        finally:
            session.close()

    @room.command(name="slowmode", description="Bật/tắt slowmode")
    async def slowmode(self, ctx, giay: discord.Option(int, "Giây (0=tắt)", min_value=0, max_value=21600)):
        ch, _ = await self._get_user_room(ctx)
        if not ch: return
        await ch.edit(slowmode_delay=giay)
        await ctx.respond(f"⏱ Slowmode: **{giay}s**.", ephemeral=True)

    # ── Admin commands ───────────────────────────────────────

    admin_voice = discord.SlashCommandGroup("tempvoice", "Admin: quản lý temp voice", default_member_permissions=discord.Permissions(manage_channels=True))

    @admin_voice.command(name="delete", description="Admin: xóa phòng temp voice")
    async def admin_delete(self, ctx, channel: discord.Option(discord.VoiceChannel, "Phòng cần xóa")):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            room = _get_room(session, str(channel.id))
            if not room:
                await ctx.followup.send("❌ Không tìm thấy temp room.", ephemeral=True)
                return
            if room.panel_channel_id and room.panel_message_id:
                try:
                    panel_ch = ctx.guild.get_channel(int(room.panel_channel_id))
                    if panel_ch:
                        msg = await panel_ch.fetch_message(int(room.panel_message_id))
                        await msg.delete()
                except Exception:
                    pass
            await channel.delete(reason=f"Admin force delete by {ctx.author}")
            session.delete(room)
            session.commit()
            await ctx.followup.send(f"✅ Đã xóa phòng **{channel.name}**.", ephemeral=True)
        except Exception as e:
            logger.error(f"admin_delete error: {e}")
            await ctx.followup.send("❌ Lỗi khi xóa phòng.", ephemeral=True)
        finally:
            session.close()

    @admin_voice.command(name="rename", description="Admin: đổi tên phòng temp voice")
    async def admin_rename(self, ctx, channel: discord.Option(discord.VoiceChannel, "Phòng"), name: discord.Option(str, "Tên mới")):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            room = _get_room(session, str(channel.id))
            if not room:
                await ctx.followup.send("❌ Không tìm thấy temp room.", ephemeral=True)
                return
            await channel.edit(name=name[:100], reason=f"Admin rename by {ctx.author}")
            room.room_name = name[:100]
            session.commit()
            await ctx.followup.send(f"✅ Đổi tên thành **{name}**.", ephemeral=True)
        except Exception as e:
            logger.error(f"admin_rename error: {e}")
            await ctx.followup.send("❌ Lỗi khi đổi tên.", ephemeral=True)
        finally:
            session.close()

    @admin_voice.command(name="transfer", description="Admin: chuyển chủ phòng")
    async def admin_transfer(self, ctx, channel: discord.Option(discord.VoiceChannel, "Phòng"), user: discord.Option(discord.Member, "Chủ mới")):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            room = _get_room(session, str(channel.id))
            if not room:
                await ctx.followup.send("❌ Không tìm thấy temp room.", ephemeral=True)
                return
            room.owner_id = str(user.id)
            session.commit()
            await ctx.followup.send(f"✅ Đã chuyển quyền chủ phòng cho {user.mention}.", ephemeral=True)
        except Exception as e:
            logger.error(f"admin_transfer error: {e}")
            await ctx.followup.send("❌ Lỗi.", ephemeral=True)
        finally:
            session.close()

    @admin_voice.command(name="cleanup", description="Admin: xóa tất cả phòng trống")
    async def admin_cleanup(self, ctx):
        await ctx.defer(ephemeral=True)
        session = get_session()
        deleted = 0
        try:
            rooms = session.execute(
                select(TempVoiceRoom).where(TempVoiceRoom.guild_id == str(ctx.guild.id))
            ).scalars().all()
            for room in rooms:
                ch = ctx.guild.get_channel(int(room.channel_id))
                if ch and len(ch.members) == 0:
                    try:
                        await ch.delete(reason=f"Admin cleanup by {ctx.author}")
                    except Exception:
                        pass
                    session.delete(room)
                    deleted += 1
            session.commit()
            await ctx.followup.send(f"✅ Đã xóa **{deleted}** phòng trống.", ephemeral=True)
        except Exception as e:
            logger.error(f"admin_cleanup error: {e}")
            await ctx.followup.send("❌ Lỗi khi dọn dẹp.", ephemeral=True)
        finally:
            session.close()

    @admin_voice.command(name="stats", description="Xem thống kê temp voice")
    async def admin_stats(self, ctx):
        await ctx.defer(ephemeral=True)
        session = get_session()
        try:
            rooms = session.execute(
                select(TempVoiceRoom).where(TempVoiceRoom.guild_id == str(ctx.guild.id))
            ).scalars().all()
            embed = discord.Embed(title="📊 TempVoice Stats", color=0x5865F2)
            embed.add_field(name="Active Rooms", value=str(len(rooms)), inline=True)
            embed.add_field(name="Total Members", value=str(sum(
                len(ctx.guild.get_channel(int(r.channel_id)).members)
                for r in rooms
                if ctx.guild.get_channel(int(r.channel_id))
            )), inline=True)
            await ctx.followup.send(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"admin_stats error: {e}")
        finally:
            session.close()

