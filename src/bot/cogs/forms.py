# src/bot/cogs/forms.py
"""Forms / Application system — create form templates, submit applications, review submissions."""
import discord
import datetime
import logging
from sqlalchemy import select, func
from src.database.config import SessionLocal
from src.models.models import FormTemplate, FormSubmission
from src.bot.embed_utils import build_embed
from src.bot.base_cog import check_feature

logger = logging.getLogger(__name__)


def get_session():
    return SessionLocal()


# ── Modal for form submission ──

class FormModal(discord.ui.Modal):
    def __init__(self, template: FormTemplate, session):
        self.template = template
        self.session = session
        questions = (template.questions or [])[:5]  # Discord max 5 items
        super().__init__(title=template.title[:45])

        for i, q in enumerate(questions):
            label = q.get("label", f"Question {i + 1}")[:45]
            placeholder = q.get("placeholder", "")
            required = q.get("required", False)
            style = discord.TextStyle.paragraph if q.get("style") == "paragraph" else discord.TextStyle.short
            self.add_item(discord.ui.InputText(
                label=label,
                placeholder=placeholder or None,
                required=required,
                style=style,
                custom_id=f"form_q_{i}",
            ))

    async def callback(self, interaction: discord.Interaction):
        questions = (self.template.questions or [])[:5]
        answers = []
        for i, q in enumerate(questions):
            label = q.get("label", f"Question {i + 1}")
            answer = self.children[i].value if i < len(self.children) else ""
            answers.append({"question": label, "answer": answer})

        session = get_session()
        try:
            submission = FormSubmission(
                guild_id=str(interaction.guild_id),
                template_id=self.template.id,
                user_id=str(interaction.user.id),
                username=str(interaction.user),
                answers=answers,
                status="pending",
            )
            session.add(submission)
            session.commit()
            session.refresh(submission)

            # Send to response channel
            channel_id = self.template.response_channel_id
            if channel_id:
                channel = interaction.guild.get_channel(int(channel_id)) if interaction.guild else None
                if channel:
                    fields_text = []
                    for a in answers:
                        fields_text.append(f"**{a['question']}**: {a['answer']}")

                    embed = build_embed("form_submitted", session, vars={
                        "submission_id": str(submission.id),
                        "user": str(interaction.user),
                        "user.mention": interaction.user.mention,
                        "template": self.template.title,
                        "answers": "\n".join(fields_text),
                    }, guild_id=str(interaction.guild_id))

                    content = None
                    if self.template.review_role_id:
                        content = f"<@&{self.template.review_role_id}>"

                    try:
                        await channel.send(content=content, embed=embed)
                    except Exception as e:
                        logger.error(f"Failed to send form submission to channel: {e}")

            await interaction.response.send_message("Your application has been submitted!", ephemeral=True)
        except Exception as e:
            logger.error(f"Form submission error: {e}")
            try:
                await interaction.response.send_message(f"Failed to submit application: {e}", ephemeral=True)
            except Exception:
                pass
        finally:
            session.close()


# ── Select menu for choosing a template ──

class TemplateSelect(discord.ui.Select):
    def __init__(self, templates):
        options = []
        for t in templates:
            options.append(discord.SelectOption(
                label=t.title[:100],
                description=(t.description or "No description")[:100],
                value=str(t.id),
            ))
        super().__init__(placeholder="Select a form template...", options=options, custom_id="form_template_select")
        self.templates = templates

    async def callback(self, interaction: discord.Interaction):
        template_id = int(self.values[0])
        session = get_session()
        try:
            template = session.get(FormTemplate, template_id)
            if not template or not template.active:
                await interaction.response.send_message("This form is no longer available.", ephemeral=True)
                return

            modal = FormModal(template, session)
            await interaction.response.send_modal(modal)
        finally:
            session.close()


class TemplateSelectView(discord.ui.View):
    def __init__(self, templates):
        super().__init__(timeout=60)
        self.add_item(TemplateSelect(templates))


# ── Cog ──

class FormsCog(discord.Cog):
    def __init__(self, bot: discord.Bot):
        self.bot = bot

    form_group = discord.SlashCommandGroup("form", "Form / application system")

    @form_group.command(name="apply", description="Apply for a form")
    async def form_apply(self, ctx: discord.ApplicationContext):
        session = get_session()
        try:
            templates = session.execute(
                select(FormTemplate).where(
                    FormTemplate.guild_id == str(ctx.guild.id),
                    FormTemplate.active == True,
                )
            ).scalars().all()

            if not templates:
                await ctx.respond("No active forms available.", ephemeral=True)
                return

            view = TemplateSelectView(templates)
            await ctx.respond("Select a form to apply:", view=view, ephemeral=True)
        except Exception as e:
            logger.error(f"form_apply error: {e}")
            await ctx.respond(f"Failed to load forms: {e}", ephemeral=True)
        finally:
            session.close()

    @form_group.command(name="list", description="List active form templates")
    async def form_list(self, ctx: discord.ApplicationContext):
        session = get_session()
        try:
            templates = session.execute(
                select(FormTemplate).where(
                    FormTemplate.guild_id == str(ctx.guild.id),
                    FormTemplate.active == True,
                )
            ).scalars().all()

            if not templates:
                await ctx.respond("No active forms.", ephemeral=True)
                return

            lines = []
            for t in templates:
                q_count = len(t.questions or [])
                lines.append(f"**#{t.id}** | {t.title} | {q_count} question(s)")

            embed = discord.Embed(
                title="Active Forms",
                description="\n".join(lines),
                color=0x5865F2,
                timestamp=datetime.datetime.utcnow(),
            )
            await ctx.respond(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"form_list error: {e}")
            await ctx.respond(f"Failed to list forms: {e}", ephemeral=True)
        finally:
            session.close()

    @form_group.command(name="submissions", description="View pending submissions for a template")
    @discord.default_permissions(manage_guild=True)
    async def form_submissions(
        self,
        ctx: discord.ApplicationContext,
        template_id: discord.Option(int, "Template ID"),
    ):
        session = get_session()
        try:
            template = session.get(FormTemplate, template_id)
            if not template or template.guild_id != str(ctx.guild.id):
                await ctx.respond("Template not found.", ephemeral=True)
                return

            submissions = session.execute(
                select(FormSubmission).where(
                    FormSubmission.template_id == template_id,
                    FormSubmission.status == "pending",
                )
            ).scalars().all()

            if not submissions:
                await ctx.respond("No pending submissions for this template.", ephemeral=True)
                return

            lines = []
            for s in submissions[:10]:  # Show max 10
                lines.append(f"**#{s.id}** | {s.username} | submitted {s.created_at.strftime('%Y-%m-%d %H:%M')}")

            embed = discord.Embed(
                title=f"Pending Submissions — {template.title}",
                description="\n".join(lines),
                color=0xFEE75C,
                timestamp=datetime.datetime.utcnow(),
            )
            await ctx.respond(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"form_submissions error: {e}")
            await ctx.respond(f"Failed to list submissions: {e}", ephemeral=True)
        finally:
            session.close()

    @form_group.command(name="review", description="Approve or reject a submission")
    @discord.default_permissions(manage_guild=True)
    async def form_review(
        self,
        ctx: discord.ApplicationContext,
        submission_id: discord.Option(int, "Submission ID"),
        action: discord.Option(str, "Action", choices=["approve", "reject"]),
        note: discord.Option(str, "Review note", required=False, default=None),
    ):
        session = get_session()
        try:
            submission = session.get(FormSubmission, submission_id)
            if not submission or submission.guild_id != str(ctx.guild.id):
                await ctx.respond("Submission not found.", ephemeral=True)
                return

            if submission.status != "pending":
                await ctx.respond(f"Submission is already {submission.status}.", ephemeral=True)
                return

            status = "approved" if action == "approve" else "rejected"
            submission.status = status
            submission.reviewer_id = str(ctx.author.id)
            submission.review_note = note
            submission.reviewed_at = datetime.datetime.utcnow()
            session.commit()

            # DM the user
            try:
                user = self.bot.get_user(int(submission.user_id))
                if user:
                    answers_text = []
                    for a in (submission.answers or []):
                        answers_text.append(f"**{a['question']}**: {a['answer']}")

                    dm_embed = discord.Embed(
                        title=f"Application {status.capitalize()}",
                        description=(
                            f"Your application for **{submission.template.title}** has been **{status}**."
                            + (f"\n\n**Note**: {note}" if note else "")
                        ),
                        color=0x57F287 if status == "approved" else 0xED4245,
                        timestamp=datetime.datetime.utcnow(),
                    )
                    await user.send(embed=dm_embed)
            except Exception as e:
                logger.warning(f"Failed to DM user about form review: {e}")

            embed = build_embed("form_reviewed", session, vars={
                "submission_id": str(submission_id),
                "user": submission.username or submission.user_id,
                "status": status,
                "note": note or "No note",
                "reviewer": str(ctx.author),
            }, guild_id=str(ctx.guild.id))
            await ctx.respond(embed=embed, ephemeral=True)
        except Exception as e:
            logger.error(f"form_review error: {e}")
            await ctx.respond(f"Failed to review submission: {e}", ephemeral=True)
        finally:
            session.close()


def setup(bot: discord.Bot):
    bot.add_cog(FormsCog(bot))
