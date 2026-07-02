from pathlib import Path

from pypdf import PdfReader

root = Path(__file__).resolve().parents[2]
ref = root / "mockups" / "reference_application_draft.pdf"
print("ref exists", ref.exists(), "size", ref.stat().st_size if ref.exists() else 0)
reader = PdfReader(str(ref))
print("pages", len(reader.pages))
for i, page in enumerate(reader.pages[:8]):
    text = (page.extract_text() or "").strip()
    print(f"\n--- page {i + 1} ({len(text)} chars) ---")
    print(text[:2500])
