import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, '.')
import chromadb

client = chromadb.PersistentClient(path='./chroma_db')
collection = client.get_collection('policy_announcements')

# 전체 샘플 50개 가져와서 industry_code, region 채워진 비율 분석
results = collection.get(limit=291)

total = len(results['ids'])
has_industry_code = 0
has_region = 0
industry_code_empty = 0
region_empty = 0

industry_code_samples = []
region_samples = []
empty_industry_titles = []

for i, meta in enumerate(results['metadatas']):
    ic = meta.get('industry_code', '')
    region = meta.get('region', '')
    title = meta.get('title', '?')[:35]

    if ic and ic not in ('', 'None', None):
        has_industry_code += 1
        if len(industry_code_samples) < 5:
            industry_code_samples.append((title, ic))
    else:
        industry_code_empty += 1
        if len(empty_industry_titles) < 5:
            empty_industry_titles.append(title)

    if region and region not in ('', 'None', None):
        has_region += 1
        if len(region_samples) < 5:
            region_samples.append((title, region))
    else:
        region_empty += 1

print(f"=== ChromaDB 메타데이터 채움 비율 (총 {total}건) ===\n")
print(f"industry_code 있음: {has_industry_code}건 ({has_industry_code/total*100:.1f}%)")
print(f"industry_code 없음: {industry_code_empty}건 ({industry_code_empty/total*100:.1f}%)")
print(f"\nregion 있음:        {has_region}건 ({has_region/total*100:.1f}%)")
print(f"region 없음:        {region_empty}건 ({region_empty/total*100:.1f}%)")

print(f"\n=== industry_code 있는 샘플 ===")
for title, ic in industry_code_samples:
    print(f"  {title} -> '{ic}'")

print(f"\n=== industry_code 없는 공고 샘플 ===")
for title in empty_industry_titles:
    print(f"  {title}")

print(f"\n=== region 있는 샘플 ===")
for title, region in region_samples:
    print(f"  {title} -> '{region}'")

# C24, C25 관련 검색
print(f"\n=== C24 또는 C25 포함 공고 ===")
c_count = 0
for meta in results['metadatas']:
    ic = meta.get('industry_code', '')
    if 'C24' in str(ic) or 'C25' in str(ic):
        print(f"  {meta.get('title','?')[:45]} -> '{ic}'")
        c_count += 1
if c_count == 0:
    print("  (없음)")
