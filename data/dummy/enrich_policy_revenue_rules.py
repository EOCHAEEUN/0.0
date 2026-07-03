"""Run only revenue_rules enrichment for policies.

Usage:
    python data/scripts/enrich_policy_revenue_rules.py

Useful env vars:
    REVENUE_ENRICH_LIMIT=100
    ENRICH_SLEEP_SECONDS=0.5
    REVENUE_REPROCESS_EMPTY=1
    REVENUE_REPROCESS_HINT_ONLY=1
"""

from enrich_policy_details import run_revenue_enrichment


def main() -> None:
    print("=" * 80)
    print("policy revenue_rules enrichment start")
    run_revenue_enrichment()
    print("\n" + "=" * 80)
    print("policy revenue_rules enrichment complete")


if __name__ == "__main__":
    main()
