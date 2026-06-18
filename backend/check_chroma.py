import sys
sys.path.insert(0, '.')
import chromadb

client = chromadb.PersistentClient(path='./chroma_db')
collections = client.list_collections()
print(f'컬렉션 수: {len(collections)}')
for col in collections:
    c = client.get_collection(col.name)
    print(f'  [{col.name}] 임베딩 수: {c.count()}')
