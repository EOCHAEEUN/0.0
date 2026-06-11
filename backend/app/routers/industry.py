from fastapi import APIRouter
from app.core.industry import name_to_codes, code_to_name, get_all_industries

router = APIRouter()


@router.get("/industries")
async def get_industries():
    """전체 업종 목록 반환 (프론트 드롭다운용)"""
    return {
        "success": True,
        "data": get_all_industries()
    }


@router.get("/industry/code/{name}")
async def get_code_by_name(name: str):
    """업종명 → 업종코드 변환"""
    codes = name_to_codes(name)
    if not codes:
        return {
            "success": False,
            "message": f"'{name}'에 해당하는 업종코드를 찾을 수 없습니다."
        }
    return {
        "success": True,
        "data": {
            "name": name,
            "codes": codes
        }
    }


@router.get("/industry/name/{code}")
async def get_name_by_code(code: str):
    """업종코드 → 업종명 변환"""
    name = code_to_name(code.upper())
    if name == "알 수 없음":
        return {
            "success": False,
            "message": f"'{code}'에 해당하는 업종명을 찾을 수 없습니다."
        }
    return {
        "success": True,
        "data": {
            "code": code.upper(),
            "name": name
        }
    }
