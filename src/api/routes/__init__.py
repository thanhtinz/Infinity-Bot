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

router = APIRouter()

router.include_router(auth_router, tags=["auth"])
router.include_router(config_router, tags=["config"])
router.include_router(shop_router, tags=["shop"])
router.include_router(embeds_router, tags=["embeds"])
router.include_router(community_router, tags=["community"])
router.include_router(tickets_router, tags=["tickets"])
router.include_router(welcome_router, tags=["welcome"])
router.include_router(logging_router, tags=["logging"])
