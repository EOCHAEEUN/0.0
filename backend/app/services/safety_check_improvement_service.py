"""
Safety Check Improvement Service
- Supabase 클라이언트 방식
- chat_id 제거, equipment_id + company_id 기준
- 설비관리 탭: 근거 등록 (CREATE + 파일 업로드)
- 신청서 탭: 데이터 조회 (READ), 향후 관리 계획 저장 (UPDATE)
- 삭제 (DELETE)
"""

import os
from datetime import datetime
from uuid import UUID
from pathlib import Path

from fastapi import HTTPException, status, UploadFile
from supabase import Client

from app.models.safety_check_improvement import (
    InspectionStatusEnum,
)

# Storage 설정
STORAGE_BUCKET = "inspection-files"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
TABLE_NAME = "safety_check_improvement"


class SafetyCheckImprovementService:
    """Safety Check Improvement CRUD 서비스 (Supabase 클라이언트 방식)"""

    @staticmethod
    async def create_with_file_upload(
        supabase: Client,
        company_id: UUID,
        user_id: UUID,
        equipment_id: UUID,
        inspection_purpose: str,
        current_safety_measures: str,
        pdf_file: UploadFile,
        equipment_name: str | None = None,
        inspection_purpose_label: str | None = None,
        inspection_rule_id: str | None = None,
        check_item: str | None = None,
        check_content: str | None = None,
    ) -> dict:
        """
        [설비관리 탭] - 근거 등록 + 파일 업로드

        1. PDF 파일 검증
        2. Supabase Storage에 업로드
        3. DB에 저장
        4. 에러 시 스토리지 파일 삭제 (롤백)
        """

        # 1️⃣ 파일 검증
        file_content = await pdf_file.read()

        # 파일명 검증
        if not pdf_file.filename or not pdf_file.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PDF 파일만 업로드 가능합니다.",
            )

        # 파일 크기 검증
        if len(file_content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="빈 파일은 업로드할 수 없습니다.",
            )

        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"파일 크기는 {MAX_FILE_SIZE / 1024 / 1024:.0f}MB 이하만 가능합니다.",
            )

        # PDF 헤더 검증
        if not file_content.startswith(b"%PDF"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="유효한 PDF 파일이 아닙니다.",
            )

        # 2️⃣ 저장 경로 생성
        timestamp = datetime.utcnow().strftime("%Y-%m-%d_%H%M%S")
        file_name_without_ext = Path(pdf_file.filename).stem
        file_ext = Path(pdf_file.filename).suffix

        final_filename = f"{timestamp}_{file_name_without_ext}{file_ext}"
        storage_path = f"{inspection_purpose}/{final_filename}"

        # 3️⃣ Supabase Storage에 업로드
        try:
            supabase.storage.from_(STORAGE_BUCKET).upload(
                path=storage_path,
                file=file_content,
                file_options={
                    "content-type": "application/pdf",
                }
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"파일 업로드 실패: {str(e)}",
            )

        # 4️⃣ 공개 URL 생성
        supabase_url = os.getenv("SUPABASE_URL")
        public_url = f"{supabase_url}/storage/v1/object/public/{STORAGE_BUCKET}/{storage_path}"

        # 5️⃣ DB에 저장
        try:
            data = {
                "company_id": str(company_id),
                "user_id": str(user_id),
                "equipment_id": str(equipment_id),
                "equipment_name": equipment_name,
                "inspection_purpose": inspection_purpose,
                "inspection_purpose_label": inspection_purpose_label,
                "inspection_rule_id": inspection_rule_id,
                "check_item": check_item,
                "check_content": check_content,
                "inspection_pdf_file": final_filename,
                "pdf_file_url": public_url,
                "current_safety_measures": current_safety_measures,
                "pdf_uploaded_at": datetime.utcnow().isoformat(),
                "status": InspectionStatusEnum.SAVED.value,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }

            response = supabase.table(TABLE_NAME).insert(data).execute()
            return response.data[0] if response.data else None

        except Exception as e:
            # 에러 발생 시 업로드된 파일 삭제 (롤백)
            try:
                supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
            except Exception:
                pass

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"데이터 저장 실패: {str(e)}",
            )

    @staticmethod
    def create(
        supabase: Client,
        company_id: UUID,
        user_id: UUID,
        equipment_id: UUID,
        inspection_purpose: str,
        current_safety_measures: str,
        inspection_pdf_file: str,
        pdf_file_url: str,
        equipment_name: str | None = None,
        inspection_purpose_label: str | None = None,
        inspection_rule_id: str | None = None,
        check_item: str | None = None,
        check_content: str | None = None,
    ) -> dict:
        """
        [설비관리 탭] - 근거 등록 (파일 없이 URL만 저장)
        """

        try:
            data = {
                "company_id": str(company_id),
                "user_id": str(user_id),
                "equipment_id": str(equipment_id),
                "equipment_name": equipment_name,
                "inspection_purpose": inspection_purpose,
                "inspection_purpose_label": inspection_purpose_label,
                "inspection_rule_id": inspection_rule_id,
                "check_item": check_item,
                "check_content": check_content,
                "inspection_pdf_file": inspection_pdf_file,
                "pdf_file_url": pdf_file_url,
                "current_safety_measures": current_safety_measures,
                "pdf_uploaded_at": datetime.utcnow().isoformat(),
                "status": InspectionStatusEnum.SAVED.value,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }

            response = supabase.table(TABLE_NAME).insert(data).execute()
            return response.data[0] if response.data else None

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"데이터 저장 실패: {str(e)}",
            )

    @staticmethod
    def get_by_company_and_equipment(
        supabase: Client,
        company_id: UUID,
        equipment_id: UUID,
    ) -> list[dict]:
        """
        [신청서 탭] - company_id와 equipment_id의 모든 점검항목 조회
        """
        try:
            response = (
                supabase.table(TABLE_NAME)
                .select("*")
                .eq("company_id", str(company_id))
                .eq("equipment_id", str(equipment_id))
                .execute()
            )
            return response.data if response.data else []
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"데이터 조회 실패: {str(e)}",
            )

    @staticmethod
    def get_by_company_equipment_and_purpose(
        supabase: Client,
        company_id: UUID,
        equipment_id: UUID,
        inspection_purpose: str,
    ) -> list[dict]:
        """
        [신청서 탭] - company_id, equipment_id, inspection_purpose로 조회
        """
        try:
            response = (
                supabase.table(TABLE_NAME)
                .select("*")
                .eq("company_id", str(company_id))
                .eq("equipment_id", str(equipment_id))
                .eq("inspection_purpose", inspection_purpose)
                .execute()
            )
            return response.data if response.data else []
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"데이터 조회 실패: {str(e)}",
            )

    @staticmethod
    def get_by_id(
        supabase: Client,
        item_id: UUID,
    ) -> dict | None:
        """
        ID로 단일 항목 조회
        """
        try:
            response = (
                supabase.table(TABLE_NAME)
                .select("*")
                .eq("id", str(item_id))
                .execute()
            )
            return response.data[0] if response.data else None
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"데이터 조회 실패: {str(e)}",
            )

    @staticmethod
    def update_improvement(
        supabase: Client,
        item_id: UUID,
        improvement_plan: str,
    ) -> dict:
        """
        [신청서 탭] - 향후 관리 계획 저장/수정
        """

        # 항목 존재 확인
        item = SafetyCheckImprovementService.get_by_id(supabase, item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Safety check improvement item not found: {item_id}",
            )

        try:
            data = {
                "improvement_plan": improvement_plan,
                "improvement_saved_at": datetime.utcnow().isoformat(),
                "status": InspectionStatusEnum.SAVED.value,
                "updated_at": datetime.utcnow().isoformat(),
            }

            response = (
                supabase.table(TABLE_NAME)
                .update(data)
                .eq("id", str(item_id))
                .execute()
            )
            return response.data[0] if response.data else None

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"데이터 수정 실패: {str(e)}",
            )

    @staticmethod
    def delete(
        supabase: Client,
        item_id: UUID,
    ) -> bool:
        """
        항목 삭제
        """
        try:
            response = (
                supabase.table(TABLE_NAME)
                .delete()
                .eq("id", str(item_id))
                .execute()
            )
            return len(response.data) > 0
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"데이터 삭제 실패: {str(e)}",
            )

    @staticmethod
    def delete_by_company_and_equipment(
        supabase: Client,
        company_id: UUID,
        equipment_id: UUID,
    ) -> int:
        """
        특정 company_id와 equipment_id의 모든 항목 삭제
        """
        try:
            response = (
                supabase.table(TABLE_NAME)
                .delete()
                .eq("company_id", str(company_id))
                .eq("equipment_id", str(equipment_id))
                .execute()
            )
            return len(response.data) if response.data else 0
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"데이터 삭제 실패: {str(e)}",
            )

    @staticmethod
    def count_by_company_and_equipment(
        supabase: Client,
        company_id: UUID,
        equipment_id: UUID,
    ) -> int:
        """
        company_id와 equipment_id의 항목 개수 조회
        """
        try:
            response = (
                supabase.table(TABLE_NAME)
                .select("id", count="exact")
                .eq("company_id", str(company_id))
                .eq("equipment_id", str(equipment_id))
                .execute()
            )
            return response.count if hasattr(response, 'count') else 0
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"개수 조회 실패: {str(e)}",
            )

    @staticmethod
    def check_exists(
        supabase: Client,
        company_id: UUID,
        equipment_id: UUID,
        inspection_purpose: str,
        inspection_rule_id: str,
    ) -> bool:
        """
        중복 항목 존재 여부 확인
        """
        try:
            response = (
                supabase.table(TABLE_NAME)
                .select("id")
                .eq("company_id", str(company_id))
                .eq("equipment_id", str(equipment_id))
                .eq("inspection_purpose", inspection_purpose)
                .eq("inspection_rule_id", inspection_rule_id or "")
                .execute()
            )
            return len(response.data) > 0 if response.data else False
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"존재 확인 실패: {str(e)}",
            )
