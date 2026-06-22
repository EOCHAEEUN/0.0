from app.agents.policy import format_raw_policy_candidate


def _as_dict(value):
    return value if isinstance(value, dict) else {}


def _first_value(*values):
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def _first_text(*values) -> str:
    value = _first_value(*values)
    return "" if value is None else str(value)


def _policy_id(policy: dict):
    metadata = _as_dict(policy.get("metadata"))
    return _first_value(
        policy.get("policy_id"),
        policy.get("id"),
        policy.get("matched_policy_id"),
        policy.get("import_row_id"),
        metadata.get("policy_id"),
        metadata.get("id"),
        metadata.get("matched_policy_id"),
        metadata.get("import_row_id"),
    )


def format_policy_for_frontend(policy: dict) -> dict:
    """Add stable aliases required by the policy detail UI."""
    metadata = dict(_as_dict(policy.get("metadata")))

    policy_id = _policy_id(policy)
    title = _first_text(
        policy.get("title"),
        metadata.get("title"),
        metadata.get("policy_title"),
        metadata.get("name"),
    )
    organization = _first_text(
        policy.get("organization"),
        policy.get("agency"),
        policy.get("provider"),
        metadata.get("organization"),
        metadata.get("agency"),
        metadata.get("provider"),
    )
    deadline = _first_value(
        policy.get("deadline"),
        policy.get("deadline_display"),
        policy.get("end_date"),
        metadata.get("deadline"),
        metadata.get("deadline_display"),
        metadata.get("end_date"),
    )
    max_amount = _first_value(
        policy.get("max_amount"),
        policy.get("max_amount_manwon"),
        policy.get("support_amount"),
        policy.get("subsidy_amount"),
        policy.get("support_limit"),
        metadata.get("max_amount"),
        metadata.get("max_amount_manwon"),
        metadata.get("support_amount"),
        metadata.get("subsidy_amount"),
        metadata.get("support_limit"),
    )
    url = _first_text(
        policy.get("url"),
        policy.get("source_url"),
        policy.get("policy_url"),
        policy.get("notice_url"),
        policy.get("homepage_url"),
        metadata.get("url"),
        metadata.get("source_url"),
        metadata.get("policy_url"),
        metadata.get("notice_url"),
        metadata.get("homepage_url"),
    )
    summary = _first_text(
        policy.get("summary"),
        policy.get("support_summary"),
        policy.get("description"),
        metadata.get("summary"),
        metadata.get("support_summary"),
        metadata.get("description"),
    )
    raw_text = _first_text(
        policy.get("raw_text"),
        policy.get("content"),
        policy.get("support_content"),
        policy.get("supportContent"),
        metadata.get("raw_text"),
        metadata.get("content"),
        metadata.get("support_content"),
        metadata.get("supportContent"),
    )
    content = _first_text(raw_text, summary)
    support_content = _first_text(summary, raw_text)
    created_at = _first_value(
        policy.get("posted_date"),
        policy.get("posted_at"),
        policy.get("registered_at"),
        policy.get("notice_date"),
        policy.get("created_at"),
        metadata.get("posted_date"),
        metadata.get("posted_at"),
        metadata.get("registered_at"),
        metadata.get("notice_date"),
        metadata.get("created_at"),
    )
    policy_category = _first_text(
        policy.get("policy_category"),
        policy.get("category"),
        policy.get("service_category"),
        metadata.get("policy_category"),
        metadata.get("category"),
        metadata.get("service_category"),
        "지원사업",
    )
    policy_subcategory = _first_value(
        policy.get("policy_subcategory"),
        policy.get("subcategory"),
        metadata.get("policy_subcategory"),
        metadata.get("subcategory"),
    )

    enriched_metadata = {
        **metadata,
        "policy_id": policy_id,
        "title": title,
        "organization": organization,
        "deadline": deadline,
        "max_amount": max_amount,
        "url": url,
        "source_url": url,
        "policy_url": url,
        "summary": summary,
        "description": summary or content,
        "content": content,
        "support_content": support_content,
        "posted_date": created_at,
        "created_at": created_at,
        "policy_category": policy_category,
        "policy_subcategory": policy_subcategory,
    }

    return {
        **policy,
        "policy_id": policy_id,
        "id": policy.get("id") or policy_id,
        "title": title,
        "organization": organization,
        "deadline": deadline,
        "max_amount": max_amount,
        "url": url,
        "source_url": url,
        "policy_url": url,
        "summary": summary,
        "description": summary or content,
        "content": content,
        "support_content": support_content,
        "posted_date": created_at,
        "created_at": created_at,
        "policy_category": policy_category,
        "policy_subcategory": policy_subcategory,
        "metadata": enriched_metadata,
    }


def format_raw_policy_candidate_for_frontend(policy: dict) -> dict:
    """Preserve raw-candidate fields while adding frontend detail aliases."""
    formatted = format_raw_policy_candidate(policy)
    return format_policy_for_frontend({**policy, **formatted})


def format_policy_collections(
    matched_policies: list[dict],
    raw_candidates: list[dict],
) -> tuple[list[dict], list[dict]]:
    return (
        [format_policy_for_frontend(policy) for policy in matched_policies],
        [
            format_raw_policy_candidate_for_frontend(policy)
            for policy in raw_candidates
        ],
    )
