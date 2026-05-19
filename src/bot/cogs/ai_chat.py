"""AI Chat cog — per-guild AI assistant with multi-provider support."""
import logging
import datetime
import asyncio
from typing import Optional

import discord
from discord.ext import commands
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from src.database.config import SessionLocal
from src.models.models import AIChatConfig, AITrainingDoc, AIChatHistory
from src.bot.embed_utils import build_embed

logger = logging.getLogger(__name__)


# ── Provider callers ─────────────────────────────────────────────────────────

async def _call_groq(api_key: str, model: str, messages: list[dict]) -> str:
    import httpx
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": messages, "max_tokens": 1024},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


async def _call_gemini(api_key: str, model: str, messages: list[dict]) -> str:
    import httpx
    # Convert OpenAI-style messages to Gemini format
    contents = []
    system_text = None
    for m in messages:
        if m["role"] == "system":
            system_text = m["content"]
            continue
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})

    payload: dict = {"contents": contents}
    if system_text:
        payload["system_instruction"] = {"parts": [{"text": system_text}]}

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
            json=payload,
        )
        r.raise_for_status()
        data = r.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def _call_openai(api_key: str, model: str, messages: list[dict], base_url: str = "https://api.openai.com/v1") -> str:
    import httpx
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": messages, "max_tokens": 1024},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


async def call_provider(provider: str, api_key: str, model: str, messages: list[dict]) -> str:
    """Dispatch to the correct AI provider."""
    if provider == "groq":
        return await _call_groq(api_key, model or "llama-3.3-70b-versatile", messages)
    elif provider == "gemini":
        return await _call_gemini(api_key, model or "gemini-2.0-flash", messages)
    elif provider == "openai":
        return await _call_openai(api_key, model or "gpt-4o-mini", messages)
    elif provider == "deepsearch":
        return await _call_openai(api_key, model or "sonar", messages, base_url="https://api.perplexity.ai")
    else:
        raise ValueError(f"Unknown provider: {provider}")


async def generate_image(provider: str, api_key: str, model: str, prompt: str) -> Optional[str]:
    """Generate an image and return URL or base64 data URL."""
    import httpx
    if provider == "openai":
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                "https://api.openai.com/v1/images/generations",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model or "dall-e-3", "prompt": prompt, "n": 1, "size": "1024x1024"},
            )
            r.raise_for_status()
            return r.json()["data"][0]["url"]

    elif provider == "gemini":
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model or 'imagen-3.0-generate-002'}:predict?key={api_key}",
                json={"instances": [{"prompt": prompt}], "parameters": {"sampleCount": 1}},
            )
            r.raise_for_status()
            data = r.json()
            b64 = data["predictions"][0]["bytesBase64Encoded"]
            mime = data["predictions"][0].get("mimeType", "image/png")
            return f"data:{mime};base64,{b64}"

    return None


# ── Main Cog ──────────────────────────────────────────────────────────────────

class AIChatCog(commands.Cog):
    """Per-guild AI chat assistant."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        # Per-guild typing locks to prevent concurrent requests
        self._processing: set[str] = set()
        # Track ticket channels where first-msg reply was already sent
        self._ticket_replied: set[str] = set()

    # ── Helpers ────────────────────────────────────────────────────────────

    def _get_config(self, guild_id: str) -> Optional[AIChatConfig]:
        with SessionLocal() as db:
            return db.execute(
                select(AIChatConfig).where(AIChatConfig.guild_id == guild_id)
            ).scalars().first()

    def _build_system_prompt(self, guild_id: str, base_prompt: Optional[str]) -> str:
        """Combine base system prompt with enabled training docs."""
        parts = []
        if base_prompt:
            parts.append(base_prompt)

        with SessionLocal() as db:
            docs = db.execute(
                select(AITrainingDoc).where(
                    AITrainingDoc.guild_id == guild_id,
                    AITrainingDoc.enabled == True,
                )
            ).scalars().all()
            for doc in docs:
                parts.append(f"\n--- Knowledge: {doc.title} ---\n{doc.content}")

        if not parts:
            parts = ["You are a helpful assistant for this Discord server."]

        return "\n\n".join(parts)

    def _get_history(self, guild_id: str, user_id: str, max_msgs: int) -> list[dict]:
        """Get recent conversation history as OpenAI-style messages."""
        with SessionLocal() as db:
            rows = db.execute(
                select(AIChatHistory).where(
                    AIChatHistory.guild_id == guild_id,
                    AIChatHistory.user_id == user_id,
                ).order_by(AIChatHistory.timestamp.desc()).limit(max_msgs)
            ).scalars().all()
        # Reverse so oldest first
        return [{"role": r.role, "content": r.content} for r in reversed(rows)]

    def _save_history(self, guild_id: str, user_id: str, username: str,
                      channel_id: str, user_content: str, assistant_content: str,
                      max_history: int):
        """Save user+assistant messages, prune oldest if over limit."""
        with SessionLocal() as db:
            # Save pair
            db.add(AIChatHistory(
                guild_id=guild_id, user_id=user_id, username=username,
                channel_id=channel_id, role="user", content=user_content,
            ))
            db.add(AIChatHistory(
                guild_id=guild_id, user_id=user_id, username=username,
                channel_id=channel_id, role="assistant", content=assistant_content,
            ))
            db.commit()

            # Prune oldest beyond max_history * 2 (pairs)
            total = db.execute(
                select(AIChatHistory).where(
                    AIChatHistory.guild_id == guild_id,
                    AIChatHistory.user_id == user_id,
                )
            ).scalars().all()
            if len(total) > max_history * 2:
                oldest = sorted(total, key=lambda x: x.timestamp)[: len(total) - max_history * 2]
                for row in oldest:
                    db.delete(row)
                db.commit()

    # ── Core responder ─────────────────────────────────────────────────────

    async def _respond(self, message: discord.Message, question: str):
        guild_id = str(message.guild.id)
        user_id = str(message.author.id)
        lock_key = f"{guild_id}:{user_id}"

        if lock_key in self._processing:
            return
        self._processing.add(lock_key)

        try:
            cfg = self._get_config(guild_id)
            if not cfg or not cfg.enabled or not cfg.api_key:
                return

            async with message.channel.typing():
                system = self._build_system_prompt(guild_id, cfg.system_prompt)
                history = self._get_history(guild_id, user_id, cfg.max_history)

                messages = [{"role": "system", "content": system}] + history + [{"role": "user", "content": question}]

                reply = await call_provider(cfg.provider, cfg.api_key, cfg.model or "", messages)

            # Split if > 2000 chars
            chunks = [reply[i:i+1900] for i in range(0, len(reply), 1900)]
            for chunk in chunks:
                await message.reply(chunk, mention_author=False)

            self._save_history(
                guild_id, user_id, str(message.author),
                str(message.channel.id), question, reply, cfg.max_history,
            )

        except Exception as e:
            logger.error(f"AI respond error guild={guild_id}: {e}")
            await message.reply("❌ AI error. Please try again later.", mention_author=False)
        finally:
            self._processing.discard(lock_key)

    # ── on_message ─────────────────────────────────────────────────────────

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild:
            return

        cfg = self._get_config(str(message.guild.id))
        if not cfg or not cfg.enabled:
            return

        question = None

        # ── Ticket channel detection (external bots) ─────────────────────
        # If this channel's parent category is in ticket_category_ids,
        # treat it as a ticket channel and respond to user messages.
        ticket_cats = cfg.ticket_category_ids or []
        if cfg.ticket_auto_reply and ticket_cats and hasattr(message.channel, "category_id"):
            cat_id = str(message.channel.category_id) if message.channel.category_id else ""
            if cat_id in ticket_cats:
                # In "first_msg" mode, only respond if this is the first non-bot message
                reply_mode = cfg.ticket_reply_mode or "first_msg"
                if reply_mode == "first_msg":
                    key = f"ticket_replied:{message.channel.id}"
                    if key in self._ticket_replied:
                        pass  # already replied, skip
                    else:
                        self._ticket_replied.add(key)
                        question = message.content.strip()
                else:
                    # all_msg mode — respond to every user message in ticket
                    question = message.content.strip()

                if question:
                    await self._respond(message, question)
                    return

        # ── Normal channel logic ─────────────────────────────────────────
        # Check channel whitelist
        listen_chs = cfg.listen_channels or []
        if listen_chs and str(message.channel.id) not in listen_chs:
            return

        # Trigger: @mention
        if cfg.respond_to_mention and self.bot.user in message.mentions:
            question = message.content.replace(f"<@{self.bot.user.id}>", "").replace(f"<@!{self.bot.user.id}>", "").strip()

        # Trigger: prefix
        elif cfg.respond_prefix and message.content.startswith(cfg.respond_prefix):
            question = message.content[len(cfg.respond_prefix):].strip()

        if question:
            await self._respond(message, question)

    # ── /ai command group ──────────────────────────────────────────────────

    ai_group = discord.SlashCommandGroup("ai", "AI Chat commands")

    @ai_group.command(name="ask", description="Ask the AI assistant a question")
    async def ai_ask(self, ctx: discord.ApplicationContext, question: str):
        await ctx.defer()
        cfg = self._get_config(str(ctx.guild.id))
        if not cfg or not cfg.enabled or not cfg.api_key:
            return await ctx.respond("❌ AI Chat is not configured for this server.", ephemeral=True)

        guild_id = str(ctx.guild.id)
        user_id = str(ctx.author.id)

        try:
            system = self._build_system_prompt(guild_id, cfg.system_prompt)
            history = self._get_history(guild_id, user_id, cfg.max_history)
            messages = [{"role": "system", "content": system}] + history + [{"role": "user", "content": question}]
            reply = await call_provider(cfg.provider, cfg.api_key, cfg.model or "", messages)

            self._save_history(
                guild_id, user_id, str(ctx.author),
                str(ctx.channel.id), question, reply, cfg.max_history,
            )

            # Build embed
            embed = discord.Embed(description=reply[:4000], color=0x5865F2)
            embed.set_author(name=ctx.author.display_name, icon_url=ctx.author.display_avatar.url)
            embed.set_footer(text=f"Model: {cfg.provider}/{cfg.model or 'default'}")
            await ctx.respond(embed=embed)

        except Exception as e:
            logger.error(f"/ai ask error: {e}")
            await ctx.respond(f"❌ Error: {e}", ephemeral=True)

    @ai_group.command(name="imagine", description="Generate an image with AI")
    async def ai_imagine(self, ctx: discord.ApplicationContext, prompt: str):
        await ctx.defer()
        cfg = self._get_config(str(ctx.guild.id))
        if not cfg or not cfg.image_gen_enabled or not cfg.image_api_key:
            return await ctx.respond("❌ Image generation is not enabled for this server.", ephemeral=True)

        try:
            url = await generate_image(
                cfg.image_provider or "openai",
                cfg.image_api_key,
                "",
                prompt,
            )
            if not url:
                return await ctx.respond("❌ Image generation failed.", ephemeral=True)

            embed = discord.Embed(title="🎨 Generated Image", description=f"**Prompt:** {prompt}", color=0x5865F2)
            if url.startswith("http"):
                embed.set_image(url=url)
                await ctx.respond(embed=embed)
            else:
                # base64 — send as file
                import base64, io
                header, b64data = url.split(",", 1)
                img_bytes = base64.b64decode(b64data)
                await ctx.respond(embed=embed, file=discord.File(io.BytesIO(img_bytes), filename="generated.png"))

        except Exception as e:
            logger.error(f"/ai imagine error: {e}")
            await ctx.respond(f"❌ Error: {e}", ephemeral=True)

    @ai_group.command(name="reset", description="Reset your conversation history with the AI")
    async def ai_reset(self, ctx: discord.ApplicationContext):
        with SessionLocal() as db:
            db.execute(
                delete(AIChatHistory).where(
                    AIChatHistory.guild_id == str(ctx.guild.id),
                    AIChatHistory.user_id == str(ctx.author.id),
                )
            )
            db.commit()
        await ctx.respond("✅ Your AI conversation history has been cleared.", ephemeral=True)

    @ai_group.command(name="status", description="Check AI Chat status for this server")
    async def ai_status(self, ctx: discord.ApplicationContext):
        cfg = self._get_config(str(ctx.guild.id))
        if not cfg or not cfg.enabled:
            return await ctx.respond("❌ AI Chat is not enabled for this server.", ephemeral=True)

        embed = discord.Embed(title="🤖 AI Chat Status", color=0x57F287)
        embed.add_field(name="Provider", value=cfg.provider.title(), inline=True)
        embed.add_field(name="Model", value=cfg.model or "default", inline=True)
        embed.add_field(name="Image Gen", value="✅" if cfg.image_gen_enabled else "❌", inline=True)
        listen_chs = cfg.listen_channels or []
        ch_str = ", ".join(f"<#{c}>" for c in listen_chs[:5]) or "All channels"
        embed.add_field(name="Listening in", value=ch_str, inline=False)
        triggers = []
        if cfg.respond_to_mention:
            triggers.append(f"@mention")
        if cfg.respond_prefix:
            triggers.append(f"`{cfg.respond_prefix}` prefix")
        embed.add_field(name="Triggers", value=", ".join(triggers) or "None", inline=False)
        await ctx.respond(embed=embed)

    # ── Ticket auto-reply helper ─────────────────────────────────────────────

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel):
        """Clean up ticket tracking when a channel is deleted."""
        key = f"ticket_replied:{channel.id}"
        self._ticket_replied.discard(key)

    async def ticket_auto_reply(self, channel: discord.TextChannel, guild_id: str, question: str, user: discord.Member):
        """Called externally when a ticket is opened, if AI auto-reply is enabled."""
        cfg = self._get_config(guild_id)
        if not cfg or not cfg.enabled or not cfg.ticket_auto_reply or not cfg.api_key:
            return

        try:
            system = self._build_system_prompt(guild_id, cfg.system_prompt)
            messages = [
                {"role": "system", "content": system},
                {"role": "user", "content": question},
            ]
            reply = await call_provider(cfg.provider, cfg.api_key, cfg.model or "", messages)

            embed = discord.Embed(
                description=reply[:4000],
                color=0x5865F2,
            )
            embed.set_author(name="AI Assistant 🤖")
            embed.set_footer(text="Powered by AI • Use /ai ask for more questions")
            await channel.send(embed=embed)
        except Exception as e:
            logger.error(f"Ticket auto-reply error: {e}")


def setup(bot):
    bot.add_cog(AIChatCog(bot))
