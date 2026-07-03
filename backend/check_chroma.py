import chromadb
client = chromadb.PersistentClient(path="chroma_db")
cols = client.list_collections()
print("collections:", [c.name for c in cols])
for c in cols:
    print(c.name, "count:", c.count())
