import re
from pathlib import Path


DEBUG_DIR = Path("data/debug_amount_texts")

MONEY_PATTERNS = [
    r"\d[\d,]*(?:\.\d+)?\s*억\s*원?",
    r"\d[\d,]*(?:\.\d+)?\s*천\s*만\s*원?",
    r"\d[\d,]*(?:\.\d+)?\s*백\s*만\s*원?",
    r"\d[\d,]*(?:\.\d+)?\s*만\s*원",
    r"\d[\d,]*(?:\.\d+)?\s*천\s*원",
    r"\d{7,}\s*원",
]

SUPPORT_KEYWORDS = [
    "지원한도",
    "지원 한도",
    "지원금액",
    "지원액",
    "지원규모",
    "지원금",
    "보조금",
    "국비",
    "정부지원금",
    "사업비",
    "최대",
    "기업당",
    "업체당",
    "과제당",
    "개사당",
]

NO_CASH_KEYWORDS = [
    "무상지원",
    "무상 지원",
    "무상 임대",
    "무상임대",
    "공동활용",
    "장비 임차",
    "장비임차",
    "장비 대여",
    "장비대여",
    "인허가 지원",
    "기술지도",
    "컨설팅",
    "교육 지원",
    "기술이전",
    "매칭서비스",
]

BAD_AMOUNT_KEYWORDS = [
    "매출액",
    "자부담",
    "민간부담",
    "부가세",
    "VAT",
    "참가비",
    "수수료",
    "보증금",
    "예치금",
    "총사업비",
]


NOISE_AMOUNT_KEYWORDS = [
    "매출액",
    "상시근로자수",
    "사업자번호",
    "전화번호",
    "핸드폰",
    "연락처",
    "설립연월일",
    "생년월일",
    "접수 번호",
]


def clean_line(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def find_snippets(text: str, patterns: list[str], radius: int = 80) -> list[str]:
    snippets = []
    seen = set()

    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            start = max(0, match.start() - radius)
            end = min(len(text), match.end() + radius)
            snippet = clean_line(text[start:end])
            if snippet and snippet not in seen:
                seen.add(snippet)
                snippets.append(snippet)

    return snippets


def has_any(text: str, keywords: list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def classify(text: str) -> str:
    money_snippets = find_money_snippets(text)
    support = has_any(text, SUPPORT_KEYWORDS)
    no_cash = has_any(text, NO_CASH_KEYWORDS)

    if money_snippets and support:
        return "money_candidate_with_support"
    if money_snippets:
        return "money_candidate_weak"
    if no_cash:
        return "likely_no_cash_amount"
    return "no_money_signal"


def find_money_snippets(text: str) -> list[str]:
    return [
        snippet
        for snippet in find_snippets(text, MONEY_PATTERNS)
        if not any(keyword in snippet for keyword in NOISE_AMOUNT_KEYWORDS)
    ]


def main() -> None:
    if not DEBUG_DIR.exists():
        print(f"debug dir not found: {DEBUG_DIR}")
        return

    files = sorted(DEBUG_DIR.glob("*.txt"))
    if not files:
        print(f"debug files not found: {DEBUG_DIR}")
        return

    counts = {}

    for path in files:
        text = path.read_text(encoding="utf-8", errors="ignore")
        category = classify(text)
        counts[category] = counts.get(category, 0) + 1

        money_snippets = find_money_snippets(text)
        no_cash_hits = [keyword for keyword in NO_CASH_KEYWORDS if keyword in text]
        bad_hits = [keyword for keyword in BAD_AMOUNT_KEYWORDS if keyword in text]

        print("=" * 80)
        print(path.name)
        print(f"category: {category}")
        if no_cash_hits:
            print(f"no_cash_keywords: {', '.join(no_cash_hits[:8])}")
        if bad_hits:
            print(f"bad_amount_keywords: {', '.join(bad_hits[:8])}")
        if money_snippets:
            print("money_snippets:")
            for snippet in money_snippets[:8]:
                print(f"- {snippet}")
        else:
            print("money_snippets: none")

    print("=" * 80)
    print("summary")
    for category, count in sorted(counts.items()):
        print(f"{category}: {count}")


if __name__ == "__main__":
    main()
