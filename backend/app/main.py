from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import chat, onboarding, roi

app = FastAPI(
    title="FactoFit API",
    description="중소 제조기업 설비투자 AI 의사결정 에이전트",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(onboarding.router, prefix="/api", tags=["onboarding"])
app.include_router(roi.router, prefix="/api", tags=["roi"])

@app.get("/health")
async def health():
    return {"status": "ok", "service": "FactoFit API"}
