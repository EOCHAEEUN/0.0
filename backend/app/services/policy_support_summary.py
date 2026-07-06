from __future__ import annotations

import logging
from typing import Any, Iterable


logger = logging.getLogger(__name__)

COMPONENT_SELECT_FIELDS = (
    "id,policy_id,component_key,component_name,support_type,effect_layer,"
    "calculation_method,review_status,roi_apply_method,fixed_amount_manwon,"
    "cap_amount_manwon,support_ratio,eligible_cost_ratio,evidence_text,"
    "evidence_source_type,evidence_source_name,evidence_page_or_section,"
    "source_component_json,component_version"
)
FINANCING_TYPES = {"loan", "interest_support", "guarantee"}


def empty_policy_support_summary() -> dict[str, Any]:
    return {
        "business_roi_support": {
            "items": [],
            "pending_count": 0,
            "approved_count": 0,
            "roi_effect_applied": False,
        },
        "financing_support": {
            "items": [],
            "roi_effect_applied": False,
        },
        "execution_support": {
            "items": [],
            "roi_effect_applied": False,
        },
    }


def _component_item(component: dict[str, Any]) -> dict[str, Any]:
    return {
        key: component.get(key)
        for key in (
            "id",
            "policy_id",
            "component_key",
            "component_name",
            "support_type",
            "effect_layer",
            "calculation_method",
            "review_status",
            "roi_apply_method",
            "fixed_amount_manwon",
            "cap_amount_manwon",
            "support_ratio",
            "eligible_cost_ratio",
            "evidence_text",
            "evidence_source_type",
            "evidence_source_name",
            "evidence_page_or_section",
            "source_component_json",
            "component_version",
        )
    } | {
        # This read model never changes ROI. Actual application stays in P0.
        "applied_amount_manwon": 0,
        "roi_effect_applied": False,
    }


def build_policy_support_summary(
    components: Iterable[dict[str, Any]],
) -> dict[str, Any]:
    summary = empty_policy_support_summary()
    business_items = summary["business_roi_support"]["items"]
    financing_items = summary["financing_support"]["items"]
    execution_items = summary["execution_support"]["items"]

    for component in components:
        if not isinstance(component, dict):
            continue
        item = _component_item(component)
        support_type = str(component.get("support_type") or "")
        effect_layer = str(component.get("effect_layer") or "")

        if effect_layer == "capex_offset":
            business_items.append(item)
        elif effect_layer == "financing_effect" or support_type in FINANCING_TYPES:
            financing_items.append(item)
        else:
            execution_items.append(item)

    business_items.sort(
        key=lambda item: (
            str(item.get("policy_id") or ""),
            str(item.get("component_key") or ""),
            int(item.get("component_version") or 1),
        )
    )
    financing_items.sort(
        key=lambda item: (
            str(item.get("policy_id") or ""),
            str(item.get("component_key") or ""),
        )
    )
    execution_items.sort(
        key=lambda item: (
            str(item.get("policy_id") or ""),
            str(item.get("component_key") or ""),
        )
    )

    summary["business_roi_support"]["pending_count"] = sum(
        item.get("review_status") == "pending" for item in business_items
    )
    summary["business_roi_support"]["approved_count"] = sum(
        item.get("review_status") == "approved" for item in business_items
    )
    return summary


def fetch_policy_support_components(
    db: Any,
    policy_ids: Iterable[str],
) -> list[dict[str, Any]]:
    normalized_ids = sorted(
        {
            str(policy_id).strip()
            for policy_id in policy_ids
            if str(policy_id or "").strip()
        }
    )
    if not normalized_ids:
        return []
    result = (
        db.table("policy_support_component")
        .select(COMPONENT_SELECT_FIELDS)
        .in_("policy_id", normalized_ids)
        .execute()
    )
    return [
        row
        for row in (getattr(result, "data", None) or [])
        if isinstance(row, dict)
    ]


def load_policy_support_summary(
    db: Any,
    policy_ids: Iterable[str],
) -> dict[str, Any]:
    try:
        components = fetch_policy_support_components(db, policy_ids)
    except Exception:
        logger.exception("policy support component SELECT failed")
        return empty_policy_support_summary()
    return build_policy_support_summary(components)
