from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


_DISTRICT_PATTERN = re.compile(r"(?<![가-힣])([가-힣]{1,8}(?:시|군|구))(?![가-힣])")
_BROAD_REGIONS = {
    "서울",
    "부산",
    "대구",
    "인천",
    "광주",
    "대전",
    "울산",
    "세종",
    "경기",
    "강원",
    "충북",
    "충남",
    "전북",
    "전남",
    "경북",
    "경남",
    "제주",
}
_NATIONWIDE_TERMS = ("전국", "소재지 무관", "지역 제한 없음")
_NARROW_PURPOSE_RULES = (
    (
        "옥외광고물·간판 설치",
        ("led간판", "led 간판", "간판 설치", "옥외광고물", "점포 간판"),
        ("간판", "사인", "옥외광고", "광고물"),
    ),
    (
        "전기차 충전시설",
        ("전기차 충전", "충전시설 설치", "충전기 설치"),
        ("충전기", "충전시설", "전기차"),
    ),
)


@dataclass(frozen=True)
class PolicyCompatibilityResult:
    compatible: bool
    reasons: tuple[str, ...]
    region_restrictions: tuple[str, ...] = ()
    narrow_purpose: str | None = None

    def message(self) -> str:
        return " ".join(self.reasons)


def _text(*values: Any) -> str:
    parts: list[str] = []
    for value in values:
        if value is None:
            continue
        if isinstance(value, (list, tuple, set)):
            parts.extend(str(item).strip() for item in value if str(item).strip())
        elif isinstance(value, dict):
            parts.extend(str(item).strip() for item in value.values() if str(item).strip())
        else:
            value_text = str(value).strip()
            if value_text:
                parts.append(value_text)
    return " ".join(parts)


def _region_tokens(value: Any) -> set[str]:
    text = _text(value).replace("특별자치도", "").replace("특별자치시", "")
    text = text.replace("광역시", "").replace("특별시", "").replace("도", "")
    tokens = set(_DISTRICT_PATTERN.findall(text))
    tokens.update(region for region in _BROAD_REGIONS if region in text)
    return tokens


def evaluate_policy_compatibility(
    *,
    company: dict[str, Any],
    equipment: dict[str, Any],
    policy: dict[str, Any],
    matched_policy: dict[str, Any] | None = None,
) -> PolicyCompatibilityResult:
    matched = matched_policy or {}
    reasons: list[str] = []
    policy_text = _text(
        policy.get("title"),
        policy.get("summary"),
        policy.get("raw_text"),
        policy.get("support_content"),
        policy.get("support_items"),
        policy.get("target"),
        policy.get("eligibility"),
    ).lower()
    company_text = _text(
        company.get("region"),
        company.get("address"),
        company.get("road_address"),
    )
    equipment_text = _text(
        equipment.get("name"),
        equipment.get("category"),
        equipment.get("process"),
        equipment.get("description"),
    ).lower()

    if matched.get("eligible") is False or policy.get("eligible") is False:
        reasons.append("추천 결과에서 신청 대상 부적격으로 판정된 정책입니다.")

    policy_regions = _region_tokens(policy_text)
    company_regions = _region_tokens(company_text)
    policy_districts = {item for item in policy_regions if item.endswith(("시", "군", "구"))}
    company_districts = {item for item in company_regions if item.endswith(("시", "군", "구"))}
    nationwide = any(term in policy_text for term in _NATIONWIDE_TERMS)
    if policy_districts and not nationwide:
        if not company_districts or policy_districts.isdisjoint(company_districts):
            expected = ", ".join(sorted(policy_districts))
            actual = company.get("region") or company.get("address") or "지역 미확인"
            reasons.append(
                f"공고 대상 지역({expected})과 기업 소재지({actual})가 일치하지 않습니다."
            )

    narrow_purpose: str | None = None
    for purpose, policy_terms, equipment_terms in _NARROW_PURPOSE_RULES:
        if any(term in policy_text for term in policy_terms):
            narrow_purpose = purpose
            if not any(term in equipment_text for term in equipment_terms):
                reasons.append(
                    f"공고 지원 목적({purpose})이 선택 설비({equipment.get('name') or '설비 미확인'})의 투자 목적과 일치하지 않습니다."
                )
            break

    return PolicyCompatibilityResult(
        compatible=not reasons,
        reasons=tuple(reasons),
        region_restrictions=tuple(sorted(policy_districts)),
        narrow_purpose=narrow_purpose,
    )


def assert_policy_compatible(
    *,
    company: dict[str, Any],
    equipment: dict[str, Any],
    policy: dict[str, Any],
    matched_policy: dict[str, Any] | None = None,
) -> PolicyCompatibilityResult:
    result = evaluate_policy_compatibility(
        company=company,
        equipment=equipment,
        policy=policy,
        matched_policy=matched_policy,
    )
    if not result.compatible:
        raise ValueError(f"정책 불일치: {result.message()}")
    return result
