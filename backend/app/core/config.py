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
    auth_cookie_secure: bool | None = None
    auth_cookie_samesite: str = "lax"
    auth_access_cookie_max_age: int = 3600
    auth_refresh_cookie_max_age: int = 60 * 60 * 24 * 30
    max_request_body_bytes: int = 1_048_576
    auth_login_attempts_per_minute: int = 5
    auth_email_code_requests_per_minute: int = 3
    auth_email_code_verifications_per_minute: int = 10
    auth_refresh_requests_per_minute: int = 30
    expensive_api_requests_per_minute: int = 10
    frontend_origins: str = (
        "http://localhost:3000,http://localhost:5173,http://localhost:5174,"
        "http://localhost:8000,http://127.0.0.1:3000,"
        "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:8000"
    )

    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    @field_validator("chroma_persist_dir")
    @classmethod
    def resolve_chroma_persist_dir(cls, v: str) -> str:
        # 상대경로면 실행 시점의 cwd가 아니라 프로젝트 루트 기준으로 고정
        path = Path(v)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        return str(path)

    @field_validator("auth_cookie_samesite")
    @classmethod
    def validate_cookie_samesite(cls, v: str) -> str:
        normalized = v.lower()
        if normalized not in {"lax", "strict", "none"}:
            raise ValueError("AUTH_COOKIE_SAMESITE must be lax, strict, or none.")
        return normalized

    @property
    def cookie_secure(self) -> bool:
        if self.auth_cookie_secure is not None:
            return self.auth_cookie_secure

        origins = [
            origin.strip().lower()
            for origin in self.frontend_origins.split(",")
            if origin.strip()
        ]
        return any(origin.startswith("https://") for origin in origins)

settings = Settings()
