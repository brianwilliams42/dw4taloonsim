"""Core simulation orchestration for Taloon's strategy."""

from __future__ import annotations

import random
import statistics
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Sequence

from . import constants as const
from .phase1 import Phase1Simulator
from .phase2 import Phase2Simulator


@dataclass
class SimulationConfig:
    """Configuration values for a complete simulation run."""

    start_gold: int = const.DEFAULT_START_GOLD
    final_target: int = const.DEFAULT_FINAL_TARGET
    min_shop_gold: int = const.DEFAULT_MIN_SHOP_GOLD
    use_far_shop: bool = False
    nights_to_sleep: int = const.DEFAULT_SLEEP_NIGHTS
    runs: int = const.DEFAULT_SIMULATION_RUNS
    armor_thresholds: Sequence[int] = field(default_factory=lambda: const.DEFAULT_ARMOR_THRESHOLDS)
    additional_trip_cutoff: Optional[int] = None
    seed: Optional[int] = None


@dataclass
class SimulationRunResult:
    """Record the results for a single Monte Carlo run."""

    total_time: float
    armor_restock_cycles: int
    shop_profit_cycles: int
    shop_purchase_trips: int


@dataclass
class ThresholdSummary:
    """Aggregated statistics for a single armor price threshold."""

    threshold: int
    average_time: float
    std_dev_time: float
    average_armor_restock_cycles: float
    average_shop_profit_cycles: float
    average_shop_purchase_trips: float
    bucket_counts: Dict[str, int]


class TaloonSimulation:
    """Run the full Taloon simulation for multiple thresholds."""

    def __init__(self, config: SimulationConfig) -> None:
        self._config = config

    def run(self) -> List[ThresholdSummary]:
        summaries = []
        for threshold in self._config.armor_thresholds:
            results = self._run_threshold(threshold)
            summaries.append(self._summarize(threshold, results))
        return summaries

    def _run_threshold(self, threshold: int) -> List[SimulationRunResult]:
        results: List[SimulationRunResult] = []
        for run_index in range(self._config.runs):
            seed_offset = hash((self._config.seed, threshold, run_index)) & 0xFFFFFFFF
            rng = random.Random(seed_offset)
            phase1 = Phase1Simulator(rng, threshold, self._config.min_shop_gold)
            phase1_result = phase1.run(self._config.start_gold)

            phase2 = Phase2Simulator(
                rng,
                nights_to_sleep=self._config.nights_to_sleep,
                final_target=self._config.final_target,
                use_far_shop=self._config.use_far_shop,
                additional_trip_cutoff=self._config.additional_trip_cutoff,
            )
            phase2_result = phase2.run(phase1_result.gold)

            total_time = phase1_result.time_seconds + phase2_result.time_seconds

            results.append(
                SimulationRunResult(
                    total_time=total_time,
                    armor_restock_cycles=phase1_result.restock_cycles,
                    shop_profit_cycles=phase2_result.profit_cycles,
                    shop_purchase_trips=phase2_result.purchase_trips,
                )
            )
        return results

    def _summarize(self, threshold: int, results: Iterable[SimulationRunResult]) -> ThresholdSummary:
        results = list(results)
        times = [result.total_time for result in results]
        armor_restock_cycles = [result.armor_restock_cycles for result in results]
        shop_profit_cycles = [result.shop_profit_cycles for result in results]
        shop_purchase_trips = [result.shop_purchase_trips for result in results]

        bucket_counts: Dict[str, int] = {}
        for total_time in times:
            bucket_label = self._bucket_label(total_time)
            bucket_counts[bucket_label] = bucket_counts.get(bucket_label, 0) + 1

        return ThresholdSummary(
            threshold=threshold,
            average_time=statistics.mean(times) if times else 0.0,
            std_dev_time=statistics.pstdev(times) if len(times) > 1 else 0.0,
            average_armor_restock_cycles=
                statistics.mean(armor_restock_cycles) if armor_restock_cycles else 0.0,
            average_shop_profit_cycles=
                statistics.mean(shop_profit_cycles) if shop_profit_cycles else 0.0,
            average_shop_purchase_trips=
                statistics.mean(shop_purchase_trips) if shop_purchase_trips else 0.0,
            bucket_counts=dict(sorted(bucket_counts.items(), key=lambda item: self._bucket_key(item[0]))),
        )

    @staticmethod
    def _bucket_label(total_time: float) -> str:
        bucket_index = int(total_time // const.TIME_BUCKET_SECONDS)
        start = bucket_index * const.TIME_BUCKET_SECONDS
        end = start + const.TIME_BUCKET_SECONDS
        return f"{start:>4}-{end:>4}s"

    @staticmethod
    def _bucket_key(label: str) -> int:
        start_str = label.split("-", 1)[0].strip()
        return int(start_str[:-1]) if start_str.endswith("s") else int(start_str)
