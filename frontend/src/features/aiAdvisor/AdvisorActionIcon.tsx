import type { AdvisorActionId } from "./advisorActions"

type AdvisorActionIconProps = {
  actionId: AdvisorActionId
}

export default function AdvisorActionIcon({ actionId }: AdvisorActionIconProps) {
  switch (actionId) {
    case "roi_detail":
      return (
        <span className="ff-advisor-action-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none">
            <rect x="3" y="10" width="3.5" height="7" rx="1" fill="#22C55E" />
            <rect x="8.25" y="6" width="3.5" height="11" rx="1" fill="#EC4899" />
            <rect x="13.5" y="3" width="3.5" height="14" rx="1" fill="#3B82F6" />
          </svg>
        </span>
      )
    case "roi_compare":
      return (
        <span className="ff-advisor-action-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none">
            <path
              d="M4 7.5H13.5M13.5 7.5L10.5 4.5M13.5 7.5L10.5 10.5"
              stroke="#6366F1"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 12.5H6.5M6.5 12.5L9.5 9.5M6.5 12.5L9.5 15.5"
              stroke="#14B8A6"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )
    case "investment_simulation":
      return (
        <span className="ff-advisor-action-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none">
            <path
              d="M14.2 4.8L6.8 12.2C6.3 12.7 5.4 12.7 4.9 12.2C4.4 11.7 4.4 10.8 4.9 10.3L12.3 2.9"
              stroke="#F59E0B"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M11.5 3.5L15.5 3.5L15.5 7.5"
              stroke="#F59E0B"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="14.5" cy="14.5" r="2.5" fill="#FBBF24" />
            <path
              d="M13.2 14.5H15.8M14.5 13.2V15.8"
              stroke="#92400E"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )
    case "matched_policies":
      return (
        <span className="ff-advisor-action-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none">
            <path
              d="M4 16.5V8.5L10 5.5L16 8.5V16.5"
              stroke="#475569"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M7.5 16.5V11.5H12.5V16.5" fill="#CBD5E1" />
            <path d="M4 8.5H16" stroke="#64748B" strokeWidth="1.6" strokeLinecap="round" />
            <rect x="6.5" y="12.5" width="1.5" height="4" rx="0.5" fill="#94A3B8" />
            <rect x="12" y="12.5" width="1.5" height="4" rx="0.5" fill="#94A3B8" />
            <circle cx="10" cy="9.2" r="1.2" fill="#3B82F6" />
          </svg>
        </span>
      )
    case "application_draft_status":
      return (
        <span className="ff-advisor-action-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none">
            <path
              d="M6 3.5H12.2L15.5 6.8V16.5H6V3.5Z"
              fill="#F8FAFC"
              stroke="#64748B"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M12 3.5V7H15.5" stroke="#64748B" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8 10.5H13" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M8 13.5H11.5" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round" />
            <path
              d="M13.8 11.2L16.2 13.6"
              stroke="#F97316"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M14.8 10.2L16.8 12.2L15.4 13.6L13.4 11.6L14.8 10.2Z"
              fill="#FB923C"
              stroke="#EA580C"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )
    case "start_analysis":
      return (
        <span className="ff-advisor-action-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="7" fill="#DBEAFE" stroke="#2563EB" strokeWidth="1.5" />
            <path d="M8.5 7.5L13 10L8.5 12.5V7.5Z" fill="#2563EB" />
          </svg>
        </span>
      )
    case "roi_analyze":
      return (
        <span className="ff-advisor-action-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="7" fill="#E0E7FF" stroke="#4F46E5" strokeWidth="1.5" />
            <path
              d="M7 10H13M10 7V13"
              stroke="#4F46E5"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )
    default:
      return null
  }
}
