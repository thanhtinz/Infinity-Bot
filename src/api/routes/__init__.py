"""API routes package — combines all sub-routers into one."""
from fastapi import APIRouter

from src.api.auth import router as auth_router
from src.api.routes.config import router as config_router
from src.api.routes.shop import router as shop_router
from src.api.routes.embeds import router as embeds_router
from src.api.routes.community import router as community_router
from src.api.routes.tickets import router as tickets_router
from src.api.routes.welcome import router as welcome_router
from src.api.routes.logging import router as logging_router
from src.api.routes.starboard import router as starboard_router
from src.api.routes.automod import router as automod_router
from src.api.routes.reaction_roles import router as reaction_roles_router
from src.api.routes.custom_commands import router as custom_commands_router
from src.api.routes.autoresponder import router as autoresponder_router
from src.api.routes.scheduler import router as scheduler_router
from src.api.routes.backup import router as backup_router
from src.api.routes.features import router as features_router
from src.api.routes.leveling import router as leveling_router

router = APIRouter()

router.include_router(auth_router, tags=["auth"])
router.include_router(config_router, tags=["config"])
router.include_router(shop_router, tags=["shop"])
router.include_router(embeds_router, tags=["embeds"])
router.include_router(community_router, tags=["community"])
router.include_router(tickets_router, tags=["tickets"])
router.include_router(welcome_router, tags=["welcome"])
router.include_router(logging_router, tags=["logging"])
router.include_router(starboard_router, tags=["starboard"])
router.include_router(automod_router, tags=["automod"])
router.include_router(reaction_roles_router, tags=["reaction-roles"])
router.include_router(custom_commands_router, tags=["custom-commands"])
router.include_router(autoresponder_router, tags=["auto-responders"])
router.include_router(scheduler_router, tags=["scheduler"])
router.include_router(backup_router, tags=["backup"])
router.include_router(features_router, tags=["features"])
router.include_router(leveling_router, tags=["leveling"])
