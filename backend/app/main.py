from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.engine import make_url

from app.api.v1.router import api_router
from app.api.realtime import router as realtime_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.middleware.request_context import RequestContextMiddleware
from app.database.local import init_local_database
from app.database.local_client import initialize_local_database


def create_app() -> FastAPI:
    settings = get_settings()
    logger = configure_logging(settings.LOG_LEVEL)

    app = FastAPI(
        title="SLAB API",
        version="0.1.0",
        description="Phase 1 foundation API for the SLAB marketplace platform.",
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    )
    app.state.logger = logger
    database_url = make_url(settings.DATABASE_URL)
    logger.info("database backend active", extra={"database_driver": database_url.drivername, "database_host": database_url.host})
    init_local_database()
    initialize_local_database()

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.API_PREFIX)
    app.include_router(realtime_router)
    return app


app = create_app()
