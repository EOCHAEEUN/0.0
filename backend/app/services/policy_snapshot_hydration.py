from __future__ import annotations

from typing import Any


POLICY_HYDRATION_FIELDS = [
    "support_items",
    "support_method",
    "support_primary_category",
    "support_categories",
    "roi_support_type",
    "policy_primary_nature",
    "max_amount_type_ko",
    "max_amount_actual",
    "support_ratio",
]

POLICY_HYDRATION_SELECT = ",".join(["policy_id", *POLICY_HYDRATION_FIELDS])


def _is_empty_value(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, (list, dict, tuple, set)):
        return len(value) == 0
    return False


def _policy_id(policy: dict[str, Any]) -> str:
    metadata = policy.get("metadata") if isinstance(policy.get("metadata"), dict) else {}
    raw_id = (
        policy.get("policy_id")
        or policy.get("policyId")
        or policy.get("id")
        or metadata.get("policy_id")
        or metadata.get("policyId")
        or metadata.get("id")
    )
    return str(raw_id or "").strip()


def fetch_policy_hydration_details(db: Any, policy_ids: list[Any]) -> dict[str, dict[str, Any]]:
    unique_ids: list[str] = []
    seen: set[str] = set()
    for policy_id in policy_ids:
        normalized = str(policy_id or "").strip()
        if normalized and normalized not in seen:
            unique_ids.append(normalized)
            seen.add(normalized)

    if not unique_ids:
        return {}

    try:
        result = (
            db.table("policy")
            .select(POLICY_HYDRATION_SELECT)
            .in_("policy_id", unique_ids)
            .execute()
        )
    except Exception as exc:
        print(f"policy snapshot hydration 조회 실패: {exc}")
        return {}

    details: dict[str, dict[str, Any]] = {}
    for row in getattr(result, "data", None) or []:
        if not isinstance(row, dict):
            continue
        policy_id = str(row.get("policy_id") or "").strip()
        if policy_id:
            details[policy_id] = row
    return details


def hydrate_canonical_policies_from_public_policy(
    db: Any,
    policies: list[Any],
) -> list[Any]:
    policy_records = [policy for policy in policies if isinstance(policy, dict)]
    details = fetch_policy_hydration_details(
        db,
        [_policy_id(policy) for policy in policy_records],
    )
    if not details:
        return policies

    return hydrate_canonical_policies_with_details(policies, details)


def hydrate_canonical_policies_with_details(
    policies: list[Any],
    details: dict[str, dict[str, Any]],
) -> list[Any]:
    if not details:
        return policies

    hydrated: list[Any] = []
    for policy in policies:
        if not isinstance(policy, dict):
            hydrated.append(policy)
            continue

        policy_id = _policy_id(policy)
        detail = details.get(policy_id)
        if not detail:
            hydrated.append(policy)
            continue

        next_policy = dict(policy)
        for field in POLICY_HYDRATION_FIELDS:
            value = detail.get(field)
            if _is_empty_value(next_policy.get(field)) and not _is_empty_value(value):
                next_policy[field] = value

        hydrated.append(next_policy)

    return hydrated


def hydrate_policy_snapshot_for_response(db: Any, snapshot: Any) -> Any:
    if not isinstance(snapshot, dict):
        return snapshot
    policies = snapshot.get("policies")
    if not isinstance(policies, list) or not policies:
        return snapshot

    hydrated_policies = hydrate_canonical_policies_from_public_policy(db, policies)
    if hydrated_policies is policies:
        return snapshot
    return {**snapshot, "policies": hydrated_policies}


def hydrate_roi_output_policy_snapshot_for_response(db: Any, roi_output: Any) -> Any:
    if not isinstance(roi_output, dict):
        return roi_output
    hydrated_snapshot = hydrate_policy_snapshot_for_response(
        db,
        roi_output.get("policy_snapshot"),
    )
    if hydrated_snapshot is roi_output.get("policy_snapshot"):
        return roi_output
    return {**roi_output, "policy_snapshot": hydrated_snapshot}


def hydrate_roi_outputs_policy_snapshots_for_response(
    db: Any,
    roi_outputs: list[Any],
) -> list[Any]:
    policy_ids: list[str] = []
    for roi_output in roi_outputs:
        if not isinstance(roi_output, dict):
            continue
        snapshot = roi_output.get("policy_snapshot")
        if not isinstance(snapshot, dict):
            continue
        policies = snapshot.get("policies")
        if not isinstance(policies, list):
            continue
        policy_ids.extend(_policy_id(policy) for policy in policies if isinstance(policy, dict))

    details = fetch_policy_hydration_details(db, policy_ids)
    if not details:
        return roi_outputs

    hydrated_outputs: list[Any] = []
    for roi_output in roi_outputs:
        if not isinstance(roi_output, dict):
            hydrated_outputs.append(roi_output)
            continue
        snapshot = roi_output.get("policy_snapshot")
        if not isinstance(snapshot, dict):
            hydrated_outputs.append(roi_output)
            continue
        policies = snapshot.get("policies")
        if not isinstance(policies, list) or not policies:
            hydrated_outputs.append(roi_output)
            continue
        hydrated_outputs.append(
            {
                **roi_output,
                "policy_snapshot": {
                    **snapshot,
                    "policies": hydrate_canonical_policies_with_details(
                        policies,
                        details,
                    ),
                },
            }
        )
    return hydrated_outputs
