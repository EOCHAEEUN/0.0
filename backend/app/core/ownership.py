from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException, status

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.auth import CurrentUser


def require_owned_company(
    company_id: UUID | str,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_db()
    result = (
        db.table("company")
        .select("*")
        .eq("company_id", str(company_id))
        .eq("user_id", str(current_user.id))
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 회사에 접근할 권한이 없습니다.",
        )

    return result.data


def get_owned_equipment_or_404(
    equipment_id: UUID | str | None,
    company: dict[str, Any],
) -> dict[str, Any]:
    db = get_db()
    query = (
        db.table("equipment")
        .select("*")
        .eq("company_id", company["company_id"])
    )
    if equipment_id:
        query = query.eq("equipment_id", str(equipment_id))

    result = query.limit(1).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 회사의 설비를 찾을 수 없습니다.",
        )

    return result.data[0]


def require_owned_equipment(
    equipment_id: UUID | str,
    company: dict[str, Any] = Depends(require_owned_company),
) -> dict[str, Any]:
    return get_owned_equipment_or_404(equipment_id, company)


def require_owned_equipment_by_id(
    equipment_id: UUID | str,
    current_user: CurrentUser,
) -> tuple[dict[str, Any], dict[str, Any]]:
    db = get_db()
    result = (
        db.table("equipment")
        .select("*")
        .eq("equipment_id", str(equipment_id))
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="설비 정보를 찾을 수 없습니다.",
        )

    company = require_owned_company(result.data["company_id"], current_user)
    return company, result.data


def require_owned_context(
    *,
    company_id: UUID | str,
    current_user: CurrentUser,
    equipment_id: UUID | str | None = None,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    company = require_owned_company(company_id, current_user)
    equipment = (
        get_owned_equipment_or_404(equipment_id, company)
        if equipment_id is not None
        else None
    )
    return company, equipment
