"""Run only max_amount enrichment for policies.

Usage:
    python data/scripts/enrich_policy_amount_details.py

Useful env vars:
    ENRICH_LIMIT=100
    ENRICH_SLEEP_SECONDS=0.5
"""

from enrich_policy_details import run_amount_enrichment


def main() -> None:
    print("=" * 80)
    print("policy max_amount enrichment start")
    run_amount_enrichment()
    print("\n" + "=" * 80)
    print("policy max_amount enrichment complete")


if __name__ == "__main__":
    main()
