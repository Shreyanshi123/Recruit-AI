from backend.api.routes_interview import router as interview_router
from backend.api.routes_sandbox import router as sandbox_router
from backend.api.routes_analytics import router as analytics_router
from backend.api.routes_assessments import router as assessments_router
from backend.api.routes_auth import router as auth_router

__all__ = ["interview_router", "sandbox_router", "analytics_router", "assessments_router", "auth_router"]
