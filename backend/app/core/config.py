from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
DEFAULT_CHROMA_DIR = Path(__file__).resolve().parents[2] / "chroma_db"

class Settings(BaseSettings):
    openrouter_api_key: str
    supabase_url: str
    supabase_service_key: str
    chroma_persist_dir: str = str(DEFAULT_CHROMA_DIR)
    bizinfo_api_key: str = ""
    data_go_kr_api_key: str = ""
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""

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
