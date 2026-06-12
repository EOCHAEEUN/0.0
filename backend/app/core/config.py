from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


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

settings = Settings()
