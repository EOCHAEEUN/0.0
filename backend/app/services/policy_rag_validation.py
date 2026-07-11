"""ROI 정책 후보에 Chroma/RAG 문맥 검증 메타데이터만 부착한다.

중요 원칙:
- ROI 계산(calculate_roi, resolve_scenario_policy_support, policy_applications)에
  쓰이는 값은 전혀 건드리지 않는다. 여기서 만드는 rag_* 필드는 표시/추천 근거
  보조용이며 final_score/hybrid_score 계산에도 반영되지 않는다.
- candidates의 순서·개수·기존 필드는 그대로 두고, rag_* 키만 추가한다.
- Chroma 검색 결과 중 candidates에 없는 정책은 추가하지 않는다.
- Chroma 조회/임베딩 로딩이 실패해도 예외를 전파하지 않고 candidates 원본을
  그대로 반환해 ROI 분석 전체가 죽지 않게 한다.
"""
from __future__ import annotations

from typing import Any

from app.tools.vector_search import search_policies

RAG_SOURCE = "chroma_policy_announcements"


def _text_or_none(value: Any) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _candidate_key_id(policy: dict) -> str | None:
    metadata = policy.get("metadata")
    metadata = metadata if isinstance(metadata, dict) else {}
    return _text_or_none(
        policy.get("policy_id")
        or policy.get("id")
        or metadata.get("policy_id")
        or metadata.get("id")
    )


def _candidate_title(policy: dict) -> str | None:
    metadata = policy.get("metadata")
    metadata = metadata if isinstance(metadata, dict) else {}
    return _text_or_none(policy.get("title") or metadata.get("title"))


def build_policy_rag_query(
    queries: dict[str, str],
    company_context: dict,
    equipment_name: str | None,
) -> str:
    """A/B 시나리오 검색어 + 회사 지역/업종 + 설비명을 합쳐 Chroma 검색어를 만든다."""
    industry_codes = company_context.get("industry_code")
    if isinstance(industry_codes, (list, tuple, set)):
        industry_text = " ".join(str(code) for code in industry_codes if code)
    else:
        industry_text = str(industry_codes or "")

    parts = [
        str(queries.get("a") or ""),
        str(queries.get("b") or ""),
        str(company_context.get("region") or ""),
        industry_text,
        str(equipment_name or ""),
    ]
    return " ".join(part.strip() for part in parts if part and part.strip())


def _similarity_from_distance(distance: Any) -> float | None:
    """cosine distance -> 0~1 유사도. 표시/근거용이며 ROI 계산에는 쓰이지 않는다."""
    try:
        distance_value = float(distance)
    except (TypeError, ValueError):
        return None
    return max(0.0, min(1.0, 1 - distance_value))


def attach_rag_validation_to_candidates(
    candidates: list[dict],
    *,
    queries: dict[str, str],
    company_context: dict,
    equipment_name: str | None = None,
    limit_per_query: int = 20,
) -> list[dict]:
    """정책 후보에 Chroma RAG 문맥 검증 메타데이터만 부착한다.

    반환값은 candidates와 같은 순서·같은 개수의 리스트다(추가/삭제 없음).
    각 항목에는 rag_validated / rag_similarity / rag_distance / rag_query /
    rag_evidence / rag_source 필드가 추가된다. 매칭되지 않은 후보는
    rag_validated=False, rag_similarity=None으로 표시된다.
    """
    if not candidates:
        return candidates

    query = build_policy_rag_query(queries, company_context, equipment_name)
    if not query:
        return [
            {
                **policy,
                "rag_validated": False,
                "rag_similarity": None,
                "rag_distance": None,
                "rag_query": None,
                "rag_evidence": None,
                "rag_source": RAG_SOURCE,
            }
            for policy in candidates
        ]

    try:
        rag_results = search_policies(query, n_results=limit_per_query)
    except Exception as exc:
        print(f"[policy_rag_validation] Chroma 검증 실패, 원본 후보 유지: {exc}")
        return candidates

    rag_by_key: dict[str, dict] = {}
    rag_by_title: dict[str, dict] = {}
    for item in rag_results:
        if not isinstance(item, dict):
            continue
        metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
        item_id = _text_or_none(item.get("id"))
        meta_policy_id = _text_or_none(metadata.get("policy_id"))
        title = _text_or_none(metadata.get("title"))
        if item_id and item_id not in rag_by_key:
            rag_by_key[item_id] = item
        if meta_policy_id and meta_policy_id not in rag_by_key:
            rag_by_key[meta_policy_id] = item
        if title and title not in rag_by_title:
            rag_by_title[title] = item

    attached: list[dict] = []
    for policy in candidates:
        key_id = _candidate_key_id(policy)
        title = _candidate_title(policy)

        match = None
        if key_id and key_id in rag_by_key:
            match = rag_by_key[key_id]
        elif title and title in rag_by_title:
            match = rag_by_title[title]

        next_policy = dict(policy)
        if match is not None:
            distance = match.get("distance")
            evidence = _text_or_none(match.get("content"))
            next_policy["rag_validated"] = True
            next_policy["rag_similarity"] = _similarity_from_distance(distance)
            next_policy["rag_distance"] = (
                distance if isinstance(distance, (int, float)) else None
            )
            next_policy["rag_query"] = query[:200]
            next_policy["rag_evidence"] = evidence[:500] if evidence else None
        else:
            next_policy["rag_validated"] = False
            next_policy["rag_similarity"] = None
            next_policy["rag_distance"] = None
            next_policy["rag_query"] = query[:200]
            next_policy["rag_evidence"] = None
        next_policy["rag_source"] = RAG_SOURCE

        attached.append(next_policy)

    return attached
