"""API routes package — combines all sub-routers into one."""
from fastapi import APIRouter

from src.api.auth import router as auth_router
from src.api.routes.config import router as config_router
from src.api.routes.discord_proxy import router as discord_proxy_router
from src.api.routes.shop import router as shop_router
from src.api.routes.embeds import router as embeds_router
from src.api.routes.community import router as community_router
from src.api.routes.logging import router as logging_router
from src.api.routes.automod import router as automod_router
from src.api.routes.reaction_roles import router as reaction_roles_router
from src.api.routes.custom_commands import router as custom_commands_router
from src.api.routes.autoresponder import router as autoresponder_router
from src.api.routes.scheduler import router as scheduler_router
from src.api.routes.backup import router as backup_router
from src.api.routes.features import router as features_router
from src.api.routes.public import router as public_router
from src.api.routes.moderation import router as moderation_router
from src.api.routes.server_backup import router as server_backup_router
from src.api.routes.verification import router as verification_router
from src.api.routes.member_pull import router as member_pull_router
from src.api.routes.verify_page import router as verify_page_router
from src.api.routes.files import router as files_router
from src.api.routes.staff_permissions import router as staff_permissions_router
from src.api.routes.firewall import router as firewall_router
from src.api.routes.alerts import router as alerts_router
from src.api.routes.guild_bot import router as guild_bot_router
from src.api.routes.premium import router as premium_router
from src.api.routes.ai_chat import router as ai_chat_router
from src.api.routes.autorole import router as autorole_router
from src.api.routes.forms import router as forms_router
from src.api.routes.reminders import router as reminders_router
from src.api.routes.polls import router as polls_router
from src.api.routes.social_feeds import router as social_feeds_router
from src.api.routes.stats_channels import router as stats_channels_router

router = APIRouter()

router.include_router(auth_router, tags=["auth"])
router.include_router(config_router, tags=["config"])
router.include_router(discord_proxy_router, tags=["discord-proxy"])
router.include_router(shop_router, tags=["shop"])
router.include_router(embeds_router, tags=["embeds"])
router.include_router(community_router, tags=["community"])
router.include_router(logging_router, tags=["logging"])
router.include_router(automod_router, tags=["automod"])
router.include_router(reaction_roles_router, tags=["reaction-roles"])
router.include_router(custom_commands_router, tags=["custom-commands"])
router.include_router(autoresponder_router, tags=["auto-responders"])
router.include_router(scheduler_router, tags=["scheduler"])
router.include_router(backup_router, tags=["backup"])
router.include_router(features_router, tags=["features"])
router.include_router(public_router, tags=["public"])
router.include_router(moderation_router, tags=["moderation"])
router.include_router(server_backup_router, tags=["server-backup"])
router.include_router(verification_router, tags=["verification"])
router.include_router(member_pull_router, tags=["member-pull"])
router.include_router(verify_page_router, tags=["verify-page"])
router.include_router(files_router, tags=["files"])
router.include_router(staff_permissions_router, tags=["staff-permissions"])
router.include_router(firewall_router, tags=["firewall"])
router.include_router(alerts_router, tags=["alerts"])
router.include_router(guild_bot_router, tags=["guild-bot"])
router.include_router(premium_router, tags=["premium"])
router.include_router(ai_chat_router, tags=["ai-chat"])
router.include_router(autorole_router, tags=["autorole"])
router.include_router(forms_router, tags=["forms"])
router.include_router(reminders_router, tags=["reminders"])
router.include_router(polls_router, tags=["polls"])
router.include_router(social_feeds_router, tags=["social-feeds"])
router.include_router(stats_channels_router, tags=["stats-channels"])
