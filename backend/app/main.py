from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import (
    analyze,
    auth,
    chat,
    click_chat,
    documents,
    draft,
    industry,
    onboarding,
    reports,
    safety,
    safety_preview,
    equipment_guide_router
)

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
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://localhost:5178",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
        "http://127.0.0.1:5177",
        "http://127.0.0.1:5178",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(onboarding.router, prefix="/api", tags=["onboarding"])
app.include_router(industry.router, prefix="/api", tags=["industry"])
app.include_router(safety.router, prefix="/api", tags=["safety"])
app.include_router(safety_preview.router, prefix="/api", tags=["safety-preview"])
app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(draft.router, prefix="/api", tags=["draft"])
app.include_router(reports.router, prefix="/api", tags=["reports"])
app.include_router(documents.router, prefix="/api", tags=["documents"])
app.include_router(click_chat.router)
app.include_router(equipment_guide_router.router)
