import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, '.')
import chromadb

client = chromadb.PersistentClient(path='./chroma_db')
collection = client.get_collection('policy_announcements')

print(f"총 임베딩 수: {collection.count()}")
print()

# 메타데이터만 peek (임베딩 계산 없이)
results = collection.peek(limit=5)
print("=== 샘플 데이터 (상위 5개) ===")
for i, (doc_id, doc, meta) in enumerate(zip(results['ids'], results['documents'], results['metadatas']), 1):
    title = meta.get('title', '제목없음')
    org = meta.get('organization', '-')
    region = meta.get('region', '-')
    max_amt = meta.get('max_amount', '-')
    print(f"{i}. {title}")
    print(f"   기관: {org} | 지역: {region} | 지원금: {max_amt}만원")
    print()
