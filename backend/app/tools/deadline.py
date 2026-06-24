from datetime import date

def calc_dday(deadline: date) -> int:
    return (deadline - date.today()).days

def is_urgent(deadline: date, threshold: int = 60) -> bool:
    return calc_dday(deadline) <= threshold

def sort_by_deadline(policies: list[dict]) -> list[dict]:
    return sorted(policies, key=lambda p: p.get("deadline", date.max))
