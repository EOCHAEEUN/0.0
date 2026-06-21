from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.application_report import (  # noqa: E402
    build_application_report_pdf,
    load_application_report_data,
    report_file_name,
)


DEMO_COMPANY_ID = "8da9a28d-53b7-4859-8d22-aefd5a86fb13"
DEMO_EQUIPMENT_ID = "dab19f1e-4369-47d5-acb5-4ebd92ba54a2"
DEMO_POLICY_ID = "mss-2026-007"


def main() -> None:
    output_dir = BACKEND_DIR / "generated_reports"
    output_dir.mkdir(parents=True, exist_ok=True)
    for tone in ("analyst", "nominal", "submission"):
        data = load_application_report_data(
            DEMO_COMPANY_ID,
            DEMO_EQUIPMENT_ID,
            DEMO_POLICY_ID,
            tone=tone,
        )
        output_path = output_dir / report_file_name(data)
        output_path.write_bytes(build_application_report_pdf(data))
        print(output_path)


if __name__ == "__main__":
    main()
