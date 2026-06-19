SUPPORTED_EQUIPMENT_CATEGORIES = {"press", "cnc", "injection"}


def normalize_equipment_category(*values) -> str:
    text = " ".join(str(value or "") for value in values).strip().lower()

    if "프레스" in text or "press" in text:
        return "press"

    if any(
        keyword in text
        for keyword in ("cnc", "공작기계", "머시닝", "가공기", "가공설비")
    ):
        return "cnc"

    if any(keyword in text for keyword in ("사출", "injection", "사출성형")):
        return "injection"

    return "unsupported"
