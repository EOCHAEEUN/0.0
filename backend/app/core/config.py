from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
DEFAULT_CHROMA_DIR = Path(__file__).resolve().parents[2] / "chroma_db"

class Settings(BaseSettings):
    openrouter_api_key: str
    openrouter_fast_model: str = "openai/gpt-5.4-mini"
    openrouter_advanced_model: str = "openai/gpt-5.4"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    supabase_url: str
    supabase_service_key: str
    chroma_persist_dir: str = str(DEFAULT_CHROMA_DIR)
    bizinfo_api_key: str = ""
    data_go_kr_api_key: str = ""
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    # Chroma/RAG 임베딩 모델(BAAI/bge-m3) 로딩이 콜드 스타트 시 30초 이상 걸려
    # Render 저사양 환경에서 ROI 분석 요청이 502로 끊기는 원인이 됐다.
    # 기본값 off — ROI 계산에는 영향 없음(표시/추천 근거 보조 필드만 붙는 기능).
    enable_policy_rag_validation: bool = False

    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    @field_validator("chroma_persist_dir")
    @classmethod
    def resolve_chroma_persist_dir(cls, v: str) -> str:
        # 상대경로면 실행 시점의 cwd가 아니라 프로젝트 루트 기준으로 고정
        path = Path(v)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        return str(path)

settings = Settings()
