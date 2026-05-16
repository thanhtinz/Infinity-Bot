import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, APIRouter, Request, Depends
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.database.config import init_db
from src.api.routes import router as bot_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB on startup
    await init_db()
    
    yield
    # Bot runs independently — no forced stop on shutdown

def create_app(static_dir: str) -> FastAPI:
    api = APIRouter()

    @api.get("/health")
    def health():
        return {"ok": True}

    app = FastAPI(lifespan=lifespan)
    
    # Add JWT token verification middleware globally or use dependency
    from src.api.auth import get_me
    from fastapi.responses import JSONResponse
    
    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        path = request.url.path
        # Exclude public API paths
        public_paths = [
            "/api/health", 
            "/api/auth/login", 
            "/api/auth/callback",
            "/api/payos/webhook",
            "/api/setup/status"
        ]
        
        if path.startswith("/static/"):
            return await call_next(request)
        
        if path in ["/api/config"]:
            from sqlalchemy import select
            from src.database.config import SessionLocal
            from src.models.models import SystemConfig

            oauth_configured = bool(
                os.environ.get("DISCORD_CLIENT_ID") and os.environ.get("DISCORD_CLIENT_SECRET")
            )
            if not oauth_configured and SessionLocal is not None:
                session = SessionLocal()
                try:
                    config = session.execute(select(SystemConfig).limit(1)).scalars().first()
                    oauth_configured = bool(
                        config and config.discord_client_id and config.discord_client_secret
                    )
                finally:
                    session.close()

            if not oauth_configured:
                return await call_next(request)
        
        if path.startswith("/api/") and not any(path.startswith(p) for p in public_paths):
            try:
                # Manual verification for middleware
                token = request.cookies.get("dashboard_session")
                if not token:
                    return JSONResponse(status_code=401, content={"detail": "Not authenticated"})
            except Exception:
                return JSONResponse(status_code=401, content={"detail": "Authentication error"})
                
        response = await call_next(request)
        return response

    app.include_router(api, prefix="/api")
    app.include_router(bot_router, prefix="/api")

    if os.path.isdir(static_dir):
        assets_dir = os.path.join(static_dir, "assets")
        if os.path.isdir(assets_dir):
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        @app.get("/{path:path}")
        async def spa_fallback(request: Request, path: str):
            file_path = os.path.join(static_dir, path)
            if path and os.path.isfile(file_path):
                return FileResponse(file_path)
            return FileResponse(
                os.path.join(static_dir, "index.html"),
                headers={
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0",
                },
            )

    # Serve uploaded product images
    os.makedirs("static/uploads", exist_ok=True)
    app.mount("/static", StaticFiles(directory="static"), name="static_uploads")

    return app
