from __future__ import annotations

import argparse
import json
from pathlib import Path


REPORT_DIR = Path("data/reports/policy_amount_url_reparse")


def latest_report() -> Path:
    reports = sorted(
        REPORT_DIR.glob("policy_amount_url_reparse_*.json"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not reports:
        raise FileNotFoundError("No policy_amount_url_reparse_*.json report found.")
    return reports[0]


def main() -> None:
    parser = argparse.ArgumentParser(description="Write sample contexts for a decision reason.")
    parser.add_argument("--reason", required=True)
    parser.add_argument("--input-json", default="")
    parser.add_argument("--output", default="")
    args = parser.parse_args()

    input_path = Path(args.input_json) if args.input_json else latest_report()
    rows = json.loads(input_path.read_text(encoding="utf-8"))
    hits = [
        row for row in rows
        if args.reason in (row.get("decision_reasons") or [])
    ]
    output_path = (
        Path(args.output)
        if args.output
        else REPORT_DIR / f"{args.reason}_samples.txt"
    )
    lines = [f"input={input_path}", f"reason={args.reason}", f"count={len(hits)}"]
    for row in hits:
        selected = row.get("new_selected_candidate") or {}
        context = (
            selected.get("local_context")
            or selected.get("evidence")
            or selected.get("raw_text")
            or ""
        ).replace("\n", " ")
        lines.extend(
            [
                "",
                "---",
                f"{row.get('policy_id')} | {row.get('title')}",
                (
                    f"old={row.get('old_amount_manwon')} {row.get('old_amount_type')} "
                    f"{row.get('old_roi_apply_method')} / "
                    f"new={row.get('new_selected_amount_manwon')} "
                    f"{row.get('new_selected_type')} {row.get('new_roi_apply_method')}"
                ),
                f"comparison={row.get('comparison_reasons')}",
                context[:1200],
            ]
        )
    output_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"rows={len(rows)}")
    print(f"hits={len(hits)}")
    print(f"output={output_path}")


if __name__ == "__main__":
    main()
