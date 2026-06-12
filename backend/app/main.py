from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import chat, dashboard, industry, onboarding, policies, roi, safety

app = FastAPI(
    title="FactoFit API",
    description="중소 제조기업 설비투자 AI 의사결정 에이전트",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(onboarding.router, prefix="/api", tags=["onboarding"])
app.include_router(roi.router, prefix="/api", tags=["roi"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(policies.router, prefix="/api", tags=["policies"])
app.include_router(industry.router, prefix="/api", tags=["industry"])
app.include_router(safety.router, prefix="/api", tags=["safety"])
