from fastapi import APIRouter

from app.api.v1.endpoints import admin, auth, customer_workspace, customers, health, maps, marketplace, payments, profile, provider_workspace, providers

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(marketplace.router, prefix="/marketplace", tags=["marketplace"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(customer_workspace.router, prefix="/customer", tags=["customer-workspace"])
api_router.include_router(providers.router, prefix="/providers", tags=["providers"])
api_router.include_router(provider_workspace.router, prefix="/provider", tags=["provider-workspace"])
api_router.include_router(maps.router, prefix="/maps", tags=["maps"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
