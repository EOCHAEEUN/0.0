@echo off
setlocal
cd /d "%~dp0.."

echo === branch ===
git branch --show-current

echo === status (before) ===
git status -sb

git add backend/app/agents/chat_orchestrator.py backend/app/agents/equipment_safety.py backend/app/core/config.py backend/app/core/llm.py backend/app/routers/analyze.py backend/app/services/application_draft_workspace.py
git add frontend/src/components/advisor/AdvisorMobilePanel.tsx frontend/src/components/advisor/advisor.constants.ts frontend/src/components/advisor/advisor.types.ts frontend/src/components/layout/DashboardWorkspaceSidebar.tsx
git add frontend/src/features/aiAdvisor/AdvisorActionIcon.tsx frontend/src/features/aiAdvisor/advisorActions.ts frontend/src/features/aiAdvisor/aiAdvisor.css frontend/src/features/aiAdvisor/AnalysisPickerDialog.tsx
git add frontend/src/features/applicationDraft/ApplicationDraftPage.css frontend/src/features/applicationDraft/ApplicationDraftWorkspaceView.tsx frontend/src/features/applicationDraft/applicationDraft.contract.ts frontend/src/features/applicationDraft/applicationDraft.utils.ts frontend/src/features/applicationDraft/policyPickerOptions.ts
git add frontend/src/features/applicationDraft/components/ApplicationDraftPdfPreview.tsx frontend/src/features/applicationDraft/components/ApplicationDraftRecommendedPolicies.tsx frontend/src/features/applicationDraft/components/ApplicationDraftSafetyEvidence.tsx frontend/src/features/applicationDraft/components/ApplicationDraftSummary.tsx frontend/src/features/applicationDraft/components/ApplicationDraftWorkspace.tsx
git add frontend/src/features/applicationDraft/hooks/useApplicationDraftWorkspace.ts
git add frontend/src/features/dashboard/dashboard.workspace.css
git add frontend/src/features/equipmentStatus/EquipmentGuideChatLauncher.tsx frontend/src/features/equipmentStatus/EquipmentGuideChatPanel.tsx frontend/src/features/equipmentStatus/EquipmentStatusFeature.tsx frontend/src/features/equipmentStatus/components/EquipmentEvidenceSection.tsx frontend/src/features/equipmentStatus/components/EquipmentRegistrationFormCard.tsx frontend/src/features/equipmentStatus/equipmentGuideChat.css frontend/src/features/equipmentStatus/equipmentStatus.workspace.css frontend/src/features/equipmentStatus/equipmentStatusPaths.ts
git add frontend/src/features/mypage/MyPageFeature.tsx frontend/src/features/onboarding/onboarding.css frontend/src/features/onboarding/pages/AnalysisNewPage.tsx
git add frontend/src/features/safetyCheck/SafetyCheckEmbeddedPanel.tsx frontend/src/features/safetyCheck/SafetyCheckFeature.tsx frontend/src/features/safetyCheck/components/SafetyCheckCreateModal.tsx frontend/src/features/safetyCheck/components/SafetyCheckEquipmentEvidenceTab.tsx frontend/src/features/safetyCheck/safetyCheck.workspace.css
git add frontend/src/pages/AiAdvisorPage.tsx

git commit -m "feat: restore draft policy picker and unify workspace UI polish" -m "- Restore application draft top5 policy picker and regenerate flow" -m "- Fix application draft white screen (ArrowRight import)" -m "- Unify new equipment registration form with equipment status UI" -m "- Advisor, safety check, PDF preview, and dashboard compact refinements"

if errorlevel 1 (
  echo Commit failed or nothing to commit.
  exit /b 1
)

echo === push ===
git push -u origin HEAD

echo === done ===
git log -1 --oneline
git status -sb

endlocal
