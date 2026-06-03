from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openrouter_api_key: str
    supabase_url: str
    supabase_service_key: str
    chroma_persist_dir: str = "./chroma_db"
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
