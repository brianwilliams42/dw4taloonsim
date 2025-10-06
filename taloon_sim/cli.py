"""Command line entry point for the Taloon speedrun simulator."""

from __future__ import annotations

import argparse
from typing import List, Sequence

from . import constants as const
from .simulation import SimulationConfig, TaloonSimulation


def parse_thresholds(raw: str) -> List[int]:
    values = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        value = int(part)
        if value < min(const.ARMOR_BUY_PRICES) or value > max(const.ARMOR_BUY_PRICES):
            raise argparse.ArgumentTypeError(
                f"Armor threshold {value} outside valid range {min(const.ARMOR_BUY_PRICES)}-"
                f"{max(const.ARMOR_BUY_PRICES)}"
            )
        values.append(value)
    if not values:
        raise argparse.ArgumentTypeError("At least one armor threshold must be provided.")
    return values


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Simulate Taloon's Chapter 3 money-making strategy.")
    parser.add_argument(
        "--start-gold",
        type=int,
        default=const.DEFAULT_START_GOLD,
        help="Gold on hand when the simulation begins (default: %(default)s).",
    )
    parser.add_argument(
        "--final-target",
        type=int,
        default=const.DEFAULT_FINAL_TARGET,
        help="Gold required after Neta sells the inventory (default: %(default)s).",
    )
    parser.add_argument(
        "--min-shop-gold",
        type=int,
        default=const.DEFAULT_MIN_SHOP_GOLD,
        help="Gold required before Taloon buys the shop (default: %(default)s).",
    )
    parser.add_argument(
        "--nights",
        type=int,
        default=const.DEFAULT_SLEEP_NIGHTS,
        help="Nights Taloon sleeps before collecting shop profits (default: %(default)s).",
    )
    parser.add_argument(
        "--runs",
        type=int,
        default=const.DEFAULT_SIMULATION_RUNS,
        help="Number of Monte Carlo simulations per armor threshold (default: %(default)s).",
    )
    parser.add_argument(
        "--thresholds",
        type=parse_thresholds,
        default=const.DEFAULT_ARMOR_THRESHOLDS,
        help=(
            "Comma-separated armor offer thresholds between "
            f"{min(const.ARMOR_BUY_PRICES)} and {max(const.ARMOR_BUY_PRICES)} "
            "(default: %(default)s)."
        ),
    )
    parser.add_argument(
        "--use-far-shop",
        action="store_true",
        help="Allow purchases from the further shop as part of the plan.",
    )
    parser.add_argument(
        "--additional-trip-cutoff",
        type=int,
        default=None,
        help=(
            "If provided, Taloon will immediately start another purchase trip whenever he has at least "
            "this much gold remaining after a trip."
        ),
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Seed for the underlying random number generator.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.final_target <= 0:
        parser.error("Final target must be positive.")
    if args.min_shop_gold <= const.SHOP_PURCHASE_COST:
        parser.error("Minimum shop gold must exceed the cost of the shop purchase.")
    if args.start_gold <= 0:
        parser.error("Start gold must be positive.")
    if args.nights <= 0:
        parser.error("Number of nights must be positive.")
    if args.runs <= 0:
        parser.error("Number of runs must be positive.")
    if args.additional_trip_cutoff is not None and args.additional_trip_cutoff < 0:
        parser.error("Additional trip cutoff must be non-negative.")

    config = SimulationConfig(
        start_gold=args.start_gold,
        final_target=args.final_target,
        min_shop_gold=args.min_shop_gold,
        use_far_shop=args.use_far_shop,
        nights_to_sleep=args.nights,
        runs=args.runs,
        armor_thresholds=args.thresholds,
        additional_trip_cutoff=args.additional_trip_cutoff,
        seed=args.seed,
    )

    simulation = TaloonSimulation(config)
    summaries = simulation.run()

    for summary in summaries:
        print(f"Threshold {summary.threshold}:")
        print(f"  Avg time: {summary.average_time:.2f}s (std dev {summary.std_dev_time:.2f}s)")
        print(f"  Avg iron-plate restock cycles: {summary.average_armor_restock_cycles:.2f}")
        print(f"  Avg shop profit cycles: {summary.average_shop_profit_cycles:.2f}")
        print(f"  Avg shop purchase trips: {summary.average_shop_purchase_trips:.2f}")
        print(f"  Time distribution ({const.TIME_BUCKET_SECONDS}s buckets):")
        for label, count in summary.bucket_counts.items():
            print(f"    {label}: {count}")
        print()


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    main()
