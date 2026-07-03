import chromadb
from chromadb.utils import embedding_functions
from app.core.config import settings

_client = None

def get_vectordb():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
    return _client

def get_policy_collection():
    """지원사업 공고 벡터 컬렉션 반환"""
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="BAAI/bge-m3"
    )
    return get_vectordb().get_or_create_collection(
        name="policy_announcements",
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )