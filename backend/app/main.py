from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import chat, industry, onboarding, safety, analyze, auth, draft, reports
from app.core.config import settings
from app.core.request_limits import RequestSizeLimitMiddleware

app = FastAPI(
    title="FactoFit API",
    description="중소 제조기업 설비투자 AI 의사결정 에이전트",
    version="0.1.0",
)

app.add_middleware(
    RequestSizeLimitMiddleware,
    max_body_bytes=settings.max_request_body_bytes,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip().rstrip("/")
        for origin in settings.frontend_origins.split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Accept", "Authorization", "Content-Type"],
    max_age=600,
)

app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(onboarding.router, prefix="/api", tags=["onboarding"])
app.include_router(industry.router, prefix="/api", tags=["industry"])
app.include_router(safety.router, prefix="/api", tags=["safety"])
app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(draft.router, prefix="/api", tags=["draft"])
app.include_router(reports.router, prefix="/api", tags=["reports"])


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    )
    if request.url.path.startswith("/api/auth/"):
        response.headers["Cache-Control"] = "no-store"
    if settings.cookie_secure:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    return response
