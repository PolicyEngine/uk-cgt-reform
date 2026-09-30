"""Command-line runner for the rate explorer: ``uk-cgt-reform-explore``.

Scores one CGT rate schedule on one registered dataset for every modelled
year, on this machine, through the same code the Modal workers run. Results
are served from and written to the local cache (``data/explore_results``);
``--json`` prints the full result on stdout (progress goes to stderr), which
is how the dashboard's Next route uses it when no backend is configured.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .explore import (
    DEFAULT_ELASTICITY,
    ELASTICITY_OPTIONS,
    ExploreValidationError,
    api_options,
    run_locally,
    validate_request,
)
from .simulations import DATASETS, DEFAULT_DATASET_KEY


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="uk-cgt-reform-explore",
        description=(
            "Score a CGT rate schedule (main and residential property rates, and "
            "Business Asset Disposal Relief) on a "
            "registered dataset for 2026-27 to 2030-31, with the pipeline's behavioural "
            "response. Rates are fractions: 0.3 for 30%."
        ),
    )
    parser.add_argument("--basic", type=float, help="Basic rate, e.g. 0.18")
    parser.add_argument("--higher", type=float, help="Higher rate, e.g. 0.30")
    parser.add_argument(
        "--additional", type=float, help="Additional rate (at least the higher rate)"
    )
    parser.add_argument(
        "--withdraw-badr",
        action="store_true",
        help="Withdraw Business Asset Disposal Relief: qualifying gains take the main rates.",
    )
    parser.add_argument(
        "--badr-rate",
        type=float,
        default=None,
        help="Keep the relief at this rate (a fraction; default: current law, 0.18).",
    )
    parser.add_argument(
        "--badr-limit",
        type=int,
        default=None,
        help="Keep the relief up to this lifetime limit (default: current law, 1000000).",
    )
    parser.add_argument(
        "--options",
        action="store_true",
        help=(
            "Print the API options (bounds, presets, elasticities, ready-reckoner rows, "
            "datasets) as JSON and exit."
        ),
    )
    parser.add_argument(
        "--dataset",
        choices=list(DATASETS),
        default=DEFAULT_DATASET_KEY,
        help=f"Dataset to run on (default: {DEFAULT_DATASET_KEY}).",
    )
    parser.add_argument(
        "--elasticity",
        type=float,
        default=DEFAULT_ELASTICITY,
        help=(
            "Elasticity of realised gains with respect to the retention rate (1 - t); one of "
            + ", ".join(str(o["e_retention"]) for o in ELASTICITY_OPTIONS)
            + f" (default {DEFAULT_ELASTICITY})."
        ),
    )
    parser.add_argument(
        "--data-folder",
        type=Path,
        default=None,
        help="Folder holding the per-year dataset folders (default: data/policyengine_datasets).",
    )
    parser.add_argument(
        "--no-cache", action="store_true", help="Recompute even if a result is cached."
    )
    parser.add_argument(
        "--json", action="store_true", help="Print the full result as JSON on stdout."
    )
    parser.add_argument("--quiet", action="store_true", help="No progress on stderr.")
    return parser


def print_headline(result: dict) -> None:
    md = result["metadata"]
    rates = md["reform"]
    cache = md.get("cache", {})
    print(
        f"{md['dataset_short_label']}: basic {rates['basic_rate']:.0%}, higher "
        f"{rates['higher_rate']:.0%}, additional {rates['additional_rate']:.0%}; "
        f"BADR {md['reform_badr']}; elasticity {md['elasticity']}"
        + (" (served from cache)" if cache.get("hit") else "")
    )
    for row in result["budget"]:
        print(
            f"  {row['year']}: gov balance {row['gov_balance_change_bn']:+.2f}bn "
            f"(CGT {row['cgt_change_bn']:+.2f}bn, entrants {row['cgt_change_from_entrants_bn']:+.2f}bn)"
        )
    print(f"  Five-year total: {result['five_year_total_bn']:+.2f}bn")
    first = result["budget"][0]["year"]
    top = result["income_change_groups"][first]["quintile"][-1]
    print(
        f"  Top quintile, {first}: {top['relative_change_pct']:+.2f}% "
        f"({top['avg_change_gbp']:+,.0f} per household)"
    )
    timing = md.get("timing", {})
    if timing.get("total_seconds") is not None:
        print(f"  Simulation time: {timing['total_seconds']}s ({timing['per_year_seconds']})")
    print(f"  Cache key: {cache.get('key')}")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.options:
        json.dump(api_options(), sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0
    if None in (args.basic, args.higher, args.additional):
        parser.error("--basic, --higher and --additional are required (fractions, e.g. 0.3)")
    if args.withdraw_badr and (args.badr_rate is not None or args.badr_limit is not None):
        parser.error("--withdraw-badr cannot be combined with --badr-rate or --badr-limit")
    if args.withdraw_badr:
        badr = {"withdrawn": True}
    else:
        badr = {
            key: value
            for key, value in (("rate", args.badr_rate), ("lifetime_limit", args.badr_limit))
            if value is not None
        }
    payload = {
        "dataset": args.dataset,
        "rates": {
            "basic_rate": args.basic,
            "higher_rate": args.higher,
            "additional_rate": args.additional,
        },
        "badr": badr,
        "elasticity": args.elasticity,
    }
    try:
        request = validate_request(payload)
    except ExploreValidationError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    log = None if args.quiet else (lambda message: print(message, file=sys.stderr, flush=True))
    result = run_locally(
        request, data_folder=args.data_folder, use_cache=not args.no_cache, log=log
    )
    if args.json:
        json.dump(result, sys.stdout)
        sys.stdout.write("\n")
    else:
        print_headline(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
