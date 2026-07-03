from app.core.vectordb import get_policy_collection

def search_policies(query: str, n_results: int = 5, where: dict = None) -> list[dict]:
    """ChromaDB에서 지원사업 공고 검색"""
    collection = get_policy_collection()

    total = collection.count()
    if total == 0:
        return []

    safe_n = min(n_results, total)

    kwargs = {"query_texts": [query], "n_results": safe_n}
    if where:
        kwargs["where"] = where
    results = collection.query(**kwargs)
    return [
        {
            "id": results["ids"][0][i],
            "content": results["documents"][0][i],
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i],
        }
        for i in range(len(results["ids"][0]))
    ]
