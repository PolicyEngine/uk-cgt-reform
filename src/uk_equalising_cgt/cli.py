"""Command-line entry point for the CGT-equalisation pipeline.

Exposes a :func:`main` callable that ``[project.scripts]`` registers as
``uk-equalising-cgt-build`` and that ``__main__.py`` invokes for
``python -m uk_equalising_cgt``.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from .pipeline import DATA_DIR, run
from .simulations import DATASETS


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="uk-equalising-cgt-build",
        description=(
            "Generate dashboard-ready results for equalising CGT rates with "
            "income tax rates (the 'Burnham' reform), 2026-27 to 2030-31, on "
            "every registered dataset."
        ),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DATA_DIR,
        help=(
            "Directory for the results JSON files (default: data/). Writes one "
            "cgt_equalisation_results_<dataset>.json per dataset, the dashboard's "
            "cgt_equalisation_results.json for the default dataset, and "
            "dataset_comparison.json when every dataset ran."
        ),
    )
    parser.add_argument(
        "--dataset",
        action="append",
        choices=[*DATASETS, "all"],
        help=(
            "Dataset to run (repeatable). Default: all registered datasets "
            f"({', '.join(DATASETS)})."
        ),
    )
    parser.add_argument(
        "--audit-only",
        action="store_true",
        help=(
            "Write only the uprating audit (data/cgt_uprating_audit.json) from the "
            "installed engine's parameters; runs no simulations, so the per-year "
            "baseline block is left empty."
        ),
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.audit_only:
        from .pipeline import write_uprating_audit

        write_uprating_audit()
        return 0
    keys = None if not args.dataset or "all" in args.dataset else args.dataset
    run(output_dir=args.output_dir, dataset_keys=keys)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
