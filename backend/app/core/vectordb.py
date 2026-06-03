import chromadb
from app.core.config import settings

_client = None

def get_vectordb():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
    return _client

def get_policy_collection():
    """지원사업 공고 벡터 컬렉션 반환"""
    return get_vectordb().get_or_create_collection(
        name="policy_announcements",
        metadata={"hnsw:space": "cosine"},
    )
