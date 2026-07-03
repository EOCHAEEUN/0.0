from __future__ import annotations

import sys
from pathlib import Path

import enrich_external_policy_with_gemini as gemini_enrichment


DEFAULT_CACHE_PATH = (
    Path(__file__).resolve().parent.parent
    / "cache"
    / "bizinfo_policy_gemini_enrichment.json"
)


def has_arg(name: str) -> bool:
    return any(arg == name or arg.startswith(f"{name}=") for arg in sys.argv[1:])


def main() -> None:
    defaults: list[str] = []
    if not has_arg("--target-table"):
        defaults.extend(["--target-table", "policy_validation_new"])
    if not has_arg("--source"):
        defaults.extend(["--source", "all"])
    if not has_arg("--cache-path"):
        defaults.extend(["--cache-path", str(DEFAULT_CACHE_PATH)])
    if not has_arg("--include-without-attachment"):
        defaults.append("--include-without-attachment")

    sys.argv = [sys.argv[0], *defaults, *sys.argv[1:]]
    gemini_enrichment.main()


if __name__ == "__main__":
    main()
