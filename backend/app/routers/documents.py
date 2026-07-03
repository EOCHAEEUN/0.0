from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.core.config import settings
from app.core.database import get_db


router = APIRouter()

BUCKET_NAME = "company-documents"

ALLOWED_DOCUMENT_TYPES = {
    "business_application_form": "사업신청서",
    "research_institute_certificate": "기업부설연구소 인정서",
    "business_plan": "사업계획서",
    "business_registration": "사업자등록증",
    "sme_confirmation": "중소기업확인서",
    "privacy_consent": "개인정보 수집·이용 동의서",
    "participation_commitment": "참여확약서",
    "credit_info_consent": "신용정보 조회 동의서",
    "corporate_registry": "법인등기부등본",
    "factory_registration": "공장등록증",
    "financial_statement": "재무제표",
    "national_tax_certificate": "국세 납세증명서",
    "local_tax_certificate": "지방세 납세증명서",
    "vat_tax_base_certificate": "부가가치세과세표준증명원",
    "ip_certification_evidence": "지식재산권·인증 증빙",
    "quotation": "견적서",
}

ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


def _make_public_url(storage_path: str) -> str:
    """
    Supabase public bucket 기준 파일 접근 URL 생성.
    """
    base_url = settings.supabase_url.rstrip("/")
    return f"{base_url}/storage/v1/object/public/{BUCKET_NAME}/{storage_path}"


def _validate_uuid(value: str, field_name: str) -> str:
    """
    company_documents.user_id 컬럼이 uuid 타입인 경우를 대비해서
    user_id가 UUID 형식인지 먼저 확인합니다.

    company_id는 프로젝트마다 text 또는 uuid일 수 있으므로 여기서는 검증하지 않습니다.
    """
    try:
        return str(UUID(value))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name}는 UUID 형식이어야 합니다. 예: 00000000-0000-0000-0000-000000000001",
        )


@router.post("/documents/upload")
async def upload_company_document(
    user_id: str = Form(...),
    company_id: str = Form(...),
    document_type: str = Form(...),
    document_label: Optional[str] = Form(None),
    file: UploadFile = File(...),
):
    """
    마이페이지 문서 업로드 API.

    - user_id를 직접 입력받아 company_documents.user_id에 저장합니다.
    - company_id를 기준으로 회사별 문서를 구분합니다.
    - 파일 원본은 Supabase Storage public bucket에 저장합니다.
    - DB에는 파일 메타데이터와 public_url을 저장합니다.

    테스트용으로 company 테이블 소유권 검증은 넣지 않았습니다.
    실제 배포 시에는 access_token에서 user_id를 꺼내는 get_current_user 방식으로 바꾸는 것을 추천합니다.
    """
    db = get_db()

    # 1. user_id UUID 검증
    # DB의 user_id 컬럼이 uuid 타입이면 test-user-1 같은 값은 저장되지 않습니다.
    user_id = _validate_uuid(user_id, "user_id")

    # 2. document_type 검증
    if document_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"지원하지 않는 document_type입니다: {document_type}",
        )

    # 3. 파일 형식 검증
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="jpg, png, webp, pdf 파일만 업로드할 수 있습니다.",
        )

    contents = await file.read()

    # 4. 파일 크기 검증
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="파일 크기는 20MB 이하만 업로드할 수 있습니다.",
        )

    # 5. Storage 저장 경로 생성
    document_id = str(uuid4())
    ext = ALLOWED_MIME_TYPES[file.content_type]

    # 예: user_id/company_id/business_registration/document_id.jpg
    storage_path = f"{user_id}/{company_id}/{document_type}/{document_id}{ext}"

    # 6. Supabase Storage 업로드
    try:
        db.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=contents,
            file_options={
                "content-type": file.content_type,
                "upsert": "false",
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase Storage 업로드 실패: {str(exc)}",
        )

    # 7. public_url 생성
    public_url = _make_public_url(storage_path)

    # 8. company_documents 테이블 저장
    payload = {
        "document_id": document_id,
        "user_id": user_id,
        "company_id": company_id,
        "document_type": document_type,
        "document_label": document_label or ALLOWED_DOCUMENT_TYPES[document_type],
        "original_filename": file.filename,
        "storage_bucket": BUCKET_NAME,
        "storage_path": storage_path,
        "public_url": public_url,
        "mime_type": file.content_type,
        "file_size": len(contents),
        "parse_status": "stored",
    }

    try:
        insert_result = db.table("company_documents").insert(payload).execute()
    except Exception as exc:
        # DB 저장 실패 시 Storage에 올라간 파일 삭제 시도
        try:
            db.storage.from_(BUCKET_NAME).remove([storage_path])
        except Exception:
            pass

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"DB 저장 실패: {str(exc)}",
        )

    return {
        "success": True,
        "message": "마이페이지 서류가 업로드되었습니다.",
        "data": insert_result.data[0] if insert_result.data else payload,
    }


@router.get("/documents/company/{company_id}")
def get_company_documents(
    company_id: str,
    document_type: Optional[str] = None,
    user_id: Optional[str] = None,
):
    """
    회사별 저장 문서 조회 API.

    - company_id 기준으로 조회합니다.
    - user_id를 넣으면 특정 사용자가 업로드한 문서만 조회합니다.
    - document_type을 넣으면 사업자등록증, 재무제표 등 특정 문서 종류만 조회합니다.
    """
    db = get_db()

    try:
        query = (
            db.table("company_documents")
            .select("*")
            .eq("company_id", company_id)
            .order("created_at", desc=True)
        )

        if user_id:
            user_id = _validate_uuid(user_id, "user_id")
            query = query.eq("user_id", user_id)

        if document_type:
            query = query.eq("document_type", document_type)

        result = query.execute()

        return {
            "success": True,
            "documents": result.data or [],
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"문서 조회 중 오류 발생: {str(exc)}",
        )
