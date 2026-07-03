from app.core.vectordb import get_policy_collection
collection = get_policy_collection()
results = collection.get(limit=3, include=["metadatas"])
print(results["metadatas"])