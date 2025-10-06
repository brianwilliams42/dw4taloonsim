"""Phase 1 simulation: selling iron plates to the armor merchant."""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Tuple

from . import constants as const


@dataclass
class Phase1Result:
    """Outcome of the armor merchant selling phase."""

    gold: float
    time_seconds: float
    restock_cycles: int
    offers_made: int


class Phase1Simulator:
    """Simulate Taloon selling iron plates to reach the shop threshold."""

    def __init__(self, rng: random.Random, price_threshold: int, min_shop_gold: int):
        self._rng = rng
        self._threshold = price_threshold
        self._min_shop_gold = min_shop_gold

    def run(self, start_gold: float) -> Phase1Result:
        gold = float(start_gold)
        time_spent = 0.0
        restock_cycles = 0
        offers = 0

        plates_remaining = 0

        while gold < self._min_shop_gold:
            if plates_remaining == 0:
                gold -= const.IRON_PLATE_COST * const.IRON_PLATE_RESTOCK_COUNT
                gold -= const.IRON_PLATE_WING_COST
                time_spent += const.IRON_PLATE_RESTOCK_TIME
                plates_remaining = const.IRON_PLATE_RESTOCK_COUNT
                restock_cycles += 1

            price, _ = self._roll_offer()
            offers += 1

            if price >= self._threshold:
                gold += price
                time_spent += const.OFFER_TIME_ACCEPT
                plates_remaining -= 1
            else:
                time_spent += const.OFFER_TIME_REJECT

            if plates_remaining == 0 and gold >= self._min_shop_gold:
                break

            if plates_remaining == 0 and gold < self._min_shop_gold:
                # Need to restock for additional plates
                continue

        return Phase1Result(gold=gold, time_seconds=time_spent, restock_cycles=restock_cycles, offers_made=offers)

    def _roll_offer(self) -> Tuple[int, bool]:
        """Generate a sale offer from the armor merchant."""

        if self._rng.random() < const.CRITICAL_SALE_CHANCE:
            low, high = const.CRITICAL_SALE_RANGE
            return self._rng.randint(low, high), True

        price = self._rng.choice(const.ARMOR_BUY_PRICES)
        return price, False
