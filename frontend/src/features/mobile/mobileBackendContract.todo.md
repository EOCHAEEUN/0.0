# Mobile Backend Contract TODO

## Current Constraint

- `safety-check` upload/list API persists and queries evidence by `company_id + equipment_id`.
- The current request/response contract does not include `policy_id` or `application_id`.
- Because of this, mobile safety evidence can be filtered reliably only by equipment context.

## UI Guardrail

- Mobile safety screen must describe its scope as:
  - "선택 설비의 안전·점검 증빙"
- Do not present `safety-check` evidence as policy-specific evidence.
- Policy-specific required evidence should be shown in application/safety-evidence summary flows only.

## Backend Extension Needed

- Extend safety-check contract to support policy/application-level traceability.
- Proposed additive fields:
  - `analysis_id` (optional)
  - `policy_id` (optional)
  - `application_id` (optional)
- Add corresponding DB columns and API filters so evidence can be isolated by
  `analysis_id + policy_id + equipment_id` when required.
