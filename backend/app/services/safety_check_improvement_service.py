"""
Safety Check Improvement Service
- 설비관리 탭: 근거 등록 (CREATE + 파일 업로드)
- 신청서 탭: 데이터 조회 (READ), 개선대책 저장 (UPDATE)
- 삭제 (DELETE)
"""

import os
from datetime import datetime
from uuid import UUID
from pathlib import Path

from fastapi import HTTPException, status, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.database import get_db
from app.models.safety_check_improvement import (
    SafetyCheckImprovement,
    InspectionStatusEnum,
)

# Storage 설정
STORAGE_BUCKET = "inspection-files"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


class SafetyCheckImprovementService:
    """Safety Check Improvement CRUD 서비스"""
    
    @staticmethod
    async def create_with_file_upload(
        db: Session,
        chat_id: str,
        inspection_purpose: str,
        current_safety_measures: str,
        pdf_file: UploadFile,
        equipment_id: str | None = None,
        equipment_name: str | None = None,
        inspection_purpose_label: str | None = None,
        inspection_rule_id: str | None = None,
        check_item: str | None = None,
        check_content: str | None = None,
    ) -> SafetyCheckImprovement:
        """
        [설비관리 탭] - 근거 등록 + 파일 업로드
        
        1. PDF 파일 검증
        2. Supabase Storage에 업로드
        3. DB에 저장
        4. 에러 시 스토리지 파일 삭제 (롤백)
        
        Args:
            db: Database 세션
            chat_id: 신청서 ID
            inspection_purpose: 점검 목적 (safety_device, maintenance, safety_training)
            current_safety_measures: 근거 제목
            pdf_file: 업로드된 PDF 파일
            equipment_id: 설비 ID (문자열)
            equipment_name: 설비명
            inspection_purpose_label: 한글 레이블
            inspection_rule_id: 규칙 ID
            check_item: 점검항목
            check_content: 점검내용
        
        Returns:
            생성된 SafetyCheckImprovement 객체
        
        Raises:
            HTTPException: 파일 검증 또는 업로드 실패
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
        supabase = get_db()
        
        try:
            supabase.storage.from_(STORAGE_BUCKET).upload(
                path=storage_path,
                file=file_content,
                file_options={
                    "content-type": "application/pdf",
                    "metadata": {
                        "chat_id": chat_id,
                        "inspection_purpose": inspection_purpose,
                        "uploaded_at": datetime.utcnow().isoformat(),
                    }
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
            # equipment_id가 문자열이면 UUID로 변환 (선택사항)
            converted_equipment_id = None
            if equipment_id:
                try:
                    converted_equipment_id = UUID(equipment_id)
                except (ValueError, TypeError):
                    converted_equipment_id = None
            
            item = SafetyCheckImprovement(
                chat_id=chat_id,
                equipment_id=converted_equipment_id,
                equipment_name=equipment_name,
                inspection_purpose=inspection_purpose,
                inspection_purpose_label=inspection_purpose_label,
                inspection_rule_id=inspection_rule_id,
                check_item=check_item,
                check_content=check_content,
                inspection_pdf_file=final_filename,
                pdf_file_url=public_url,
                current_safety_measures=current_safety_measures,
                pdf_uploaded_at=datetime.utcnow(),
                status=InspectionStatusEnum.SAVED.value,
            )
            
            db.add(item)
            db.commit()
            db.refresh(item)
            return item
        
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
        db: Session,
        chat_id: str,
        inspection_purpose: str,
        current_safety_measures: str,
        inspection_pdf_file: str,
        pdf_file_url: str,
        equipment_id: UUID | None = None,
        equipment_name: str | None = None,
        inspection_purpose_label: str | None = None,
        inspection_rule_id: str | None = None,
        check_item: str | None = None,
        check_content: str | None = None,
    ) -> SafetyCheckImprovement:
        """
        [설비관리 탭] - 근거 등록 (기존 방식, 파일 없이 URL만 저장)
        
        Args:
            chat_id: 신청서 ID
            inspection_purpose: safety_device, maintenance, safety_training
            current_safety_measures: 근거 제목 (사용자 입력)
            inspection_pdf_file: PDF 파일명
            pdf_file_url: Supabase URL
            equipment_id: 설비 ID
            equipment_name: 설비명
            inspection_purpose_label: 한글 레이블
            inspection_rule_id: 규칙 ID
            check_item: 점검항목
            check_content: 점검내용
        
        Returns:
            생성된 SafetyCheckImprovement 객체
        """
        
        item = SafetyCheckImprovement(
            chat_id=chat_id,
            equipment_id=equipment_id,
            equipment_name=equipment_name,
            inspection_purpose=inspection_purpose,
            inspection_purpose_label=inspection_purpose_label,
            inspection_rule_id=inspection_rule_id,
            check_item=check_item,
            check_content=check_content,
            inspection_pdf_file=inspection_pdf_file,
            pdf_file_url=pdf_file_url,
            current_safety_measures=current_safety_measures,
            pdf_uploaded_at=datetime.utcnow(),
            status=InspectionStatusEnum.SAVED.value,
        )
        
        db.add(item)
        db.commit()
        db.refresh(item)
        return item
    
    @staticmethod
    def get_by_chat_id(
        db: Session,
        chat_id: str,
    ) -> list[SafetyCheckImprovement]:
        """
        [신청서 탭] - chat_id의 모든 점검항목 조회
        
        Args:
            chat_id: 신청서 ID
        
        Returns:
            SafetyCheckImprovement 리스트
        """
        return (
            db.query(SafetyCheckImprovement)
            .filter(SafetyCheckImprovement.chat_id == chat_id)
            .all()
        )
    
    @staticmethod
    def get_by_chat_and_purpose(
        db: Session,
        chat_id: str,
        inspection_purpose: str,
    ) -> list[SafetyCheckImprovement]:
        """
        [신청서 탭] - 특정 점검목적의 항목들만 조회
        
        Args:
            chat_id: 신청서 ID
            inspection_purpose: safety_device, maintenance, safety_training
        
        Returns:
            해당 inspection_purpose의 항목들
        """
        return (
            db.query(SafetyCheckImprovement)
            .filter(
                and_(
                    SafetyCheckImprovement.chat_id == chat_id,
                    SafetyCheckImprovement.inspection_purpose == inspection_purpose,
                )
            )
            .all()
        )
    
    @staticmethod
    def get_by_id(
        db: Session,
        item_id: UUID,
    ) -> SafetyCheckImprovement | None:
        """
        ID로 단일 항목 조회
        
        Args:
            item_id: 항목 ID
        
        Returns:
            SafetyCheckImprovement 객체 또는 None
        """
        return (
            db.query(SafetyCheckImprovement)
            .filter(SafetyCheckImprovement.id == item_id)
            .first()
        )
    
    @staticmethod
    def update_improvement(
        db: Session,
        item_id: UUID,
        improvement_plan: str,
    ) -> SafetyCheckImprovement:
        """
        [신청서 탭] - 개선대책 저장/수정
        
        Args:
            item_id: 항목 ID
            improvement_plan: 개선대책 (사용자 입력)
        
        Returns:
            업데이트된 SafetyCheckImprovement 객체
        
        Raises:
            ValueError: 항목이 없을 경우
        """
        item = SafetyCheckImprovementService.get_by_id(db, item_id)
        
        if not item:
            raise ValueError(f"Safety check improvement item not found: {item_id}")
        
        item.improvement_plan = improvement_plan
        item.improvement_saved_at = datetime.utcnow()
        item.status = InspectionStatusEnum.SAVED.value
        item.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(item)
        return item
    
    @staticmethod
    def delete(
        db: Session,
        item_id: UUID,
    ) -> bool:
        """
        항목 삭제
        
        Args:
            item_id: 항목 ID
        
        Returns:
            삭제 성공 여부
        """
        item = SafetyCheckImprovementService.get_by_id(db, item_id)
        
        if not item:
            return False
        
        db.delete(item)
        db.commit()
        return True
    
    @staticmethod
    def delete_by_chat_and_purpose(
        db: Session,
        chat_id: str,
        inspection_purpose: str,
    ) -> int:
        """
        특정 chat_id와 inspection_purpose의 모든 항목 삭제
        
        Args:
            chat_id: 신청서 ID
            inspection_purpose: 점검 목적
        
        Returns:
            삭제된 행의 개수
        """
        count = (
            db.query(SafetyCheckImprovement)
            .filter(
                and_(
                    SafetyCheckImprovement.chat_id == chat_id,
                    SafetyCheckImprovement.inspection_purpose == inspection_purpose,
                )
            )
            .delete()
        )
        db.commit()
        return count
    
    @staticmethod
    def count_by_chat_id(
        db: Session,
        chat_id: str,
    ) -> int:
        """
        chat_id의 항목 개수 조회
        
        Args:
            chat_id: 신청서 ID
        
        Returns:
            항목 개수
        """
        return (
            db.query(SafetyCheckImprovement)
            .filter(SafetyCheckImprovement.chat_id == chat_id)
            .count()
        )
    
    @staticmethod
    def check_exists(
        db: Session,
        chat_id: str,
        inspection_purpose: str,
        inspection_rule_id: str,
    ) -> bool:
        """
        중복 항목 존재 여부 확인
        
        Args:
            chat_id: 신청서 ID
            inspection_purpose: 점검 목적
            inspection_rule_id: 규칙 ID
        
        Returns:
            존재 여부
        """
        return (
            db.query(SafetyCheckImprovement)
            .filter(
                and_(
                    SafetyCheckImprovement.chat_id == chat_id,
                    SafetyCheckImprovement.inspection_purpose == inspection_purpose,
                    SafetyCheckImprovement.inspection_rule_id == inspection_rule_id,
                )
            )
            .first()
            is not None
        )
