"""Calendar Agent — 마감일 정렬 + D-day 알림"""
from app.tools.deadline import calc_dday, sort_by_deadline

def get_deadline_summary(policies: list[dict]) -> dict:
    sorted_p = sort_by_deadline(policies)
    return {
        "total": len(sorted_p),
        "urgent": [p for p in sorted_p if calc_dday(p.get("deadline")) <= 60],
        "all": sorted_p,
    }
