"""Phase 2 simulation where Neta sells Taloon's inventory."""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import List, Sequence

from . import constants as const


@dataclass
class Phase2Result:
    """Outcome from running the Neta shop phase."""

    gold: float
    time_seconds: float
    profit_cycles: int
    purchase_trips: int


@dataclass
class PurchasePlan:
    """Items Taloon will buy during one shop trip."""

    near_items: List[const.ShopItem]
    far_items: List[const.ShopItem]

    @property
    def total_cost(self) -> int:
        return sum(item.cost for item in self.near_items + self.far_items)

    @property
    def total_items(self) -> int:
        return len(self.near_items) + len(self.far_items)

    @property
    def visits_far_shop(self) -> bool:
        return bool(self.far_items)


class Phase2Simulator:
    """Simulates Taloon purchasing equipment for Neta to sell."""

    def __init__(
        self,
        rng: random.Random,
        nights_to_sleep: int,
        final_target: int,
        use_far_shop: bool,
        additional_trip_cutoff: int | None,
    ) -> None:
        self._rng = rng
        self._nights_to_sleep = nights_to_sleep
        self._final_target = final_target
        self._use_far_shop = use_far_shop
        self._additional_trip_cutoff = additional_trip_cutoff
        candidate_items = list(const.CLOSER_SHOP_ITEMS)
        if use_far_shop:
            candidate_items.extend(const.FURTHER_SHOP_ITEMS)
        self._cheapest_item_cost = min(item.cost for item in candidate_items)

    def run(self, start_gold: float) -> Phase2Result:
        gold = float(start_gold) - const.SHOP_PURCHASE_COST
        if gold < 0:
            raise ValueError("Insufficient gold to purchase the shop.")

        time_spent = 0.0
        profit_cycles = 0
        total_trips = 0
        pending_profits = 0.0
        neta_inventory: List[int] = []

        while gold < self._final_target or pending_profits > 0 or neta_inventory:
            if pending_profits:
                gold += pending_profits
                pending_profits = 0.0

            if gold >= self._final_target and not neta_inventory:
                break

            profit_cycles += 1

            trips_this_cycle = 0
            purchased_any = False

            while True:
                plan = self._plan_purchases(gold)
                if plan.total_items == 0:
                    break

                if trips_this_cycle > 0 and self._additional_trip_cutoff is not None:
                    if gold < self._additional_trip_cutoff or trips_this_cycle >= 2:
                        break
                if trips_this_cycle > 0 and self._additional_trip_cutoff is None:
                    break

                trips_this_cycle += 1
                total_trips += 1
                purchased_any = True

                time_spent += const.TIME_CLAIM_PROFITS_AND_TO_NEAR_SHOP

                # Purchase near shop items
                for item in plan.near_items:
                    time_spent += const.TIME_PURCHASE_EQUIPPABLE if item.equippable else const.TIME_PURCHASE_NOT_EQUIPPABLE

                if plan.visits_far_shop:
                    time_spent += const.TIME_TRAVEL_EXTRA_TO_FAR_SHOP
                    for item in plan.far_items:
                        time_spent += const.TIME_PURCHASE_EQUIPPABLE if item.equippable else const.TIME_PURCHASE_NOT_EQUIPPABLE

                time_spent += const.TIME_RETURN_TO_NETA_FROM_NEAR
                if plan.visits_far_shop:
                    time_spent += const.TIME_RETURN_EXTRA_FROM_FAR

                time_spent += const.TIME_EAT_LUNCH
                time_spent += plan.total_items * const.TIME_GIVE_ITEM_TO_NETA

                gold -= plan.total_cost
                for item in plan.near_items:
                    neta_inventory.append(item.cost)
                for item in plan.far_items:
                    neta_inventory.append(item.cost)

            if not purchased_any and not neta_inventory:
                # Nothing to sell and not enough gold: exit to avoid infinite loop
                break

            # Move to the sleeping portion of the cycle
            time_spent += const.TIME_RETURN_FOR_SLEEP
            time_spent += self._nights_to_sleep * const.TIME_SLEEP_ONE_NIGHT

            # Simulate sales over the sleeping nights
            for _ in range(self._nights_to_sleep):
                remaining_inventory: List[int] = []
                for cost in neta_inventory:
                    if self._rng.random() < const.SALE_PROBABILITY_PER_NIGHT:
                        multiplier = self._rng.uniform(*const.CRITICAL_RETURN_RANGE)
                        sale_value = round(cost * multiplier)
                        pending_profits += sale_value
                    else:
                        remaining_inventory.append(cost)
                neta_inventory = remaining_inventory

        # Collect any final pending profits if needed
        if pending_profits:
            gold += pending_profits
            pending_profits = 0.0

        return Phase2Result(
            gold=gold,
            time_seconds=time_spent,
            profit_cycles=profit_cycles,
            purchase_trips=total_trips,
        )

    def _plan_purchases(self, gold: float) -> PurchasePlan:
        """Choose items to purchase based on available gold and capacity."""

        near_items: List[const.ShopItem] = []
        far_items: List[const.ShopItem] = []

        capacity_remaining = const.INVENTORY_CAPACITY
        available_gold = int(gold)

        candidates: List[tuple[str, const.ShopItem]] = [
            ("near", item) for item in const.CLOSER_SHOP_ITEMS
        ]
        if self._use_far_shop:
            candidates.extend(("far", item) for item in const.FURTHER_SHOP_ITEMS)

        candidates.sort(key=lambda pair: pair[1].cost, reverse=True)

        for shop_name, item in candidates:
            if capacity_remaining == 0:
                break
            max_copies = min(available_gold // item.cost, capacity_remaining)
            for _ in range(max_copies):
                if shop_name == "near":
                    near_items.append(item)
                else:
                    far_items.append(item)
                available_gold -= item.cost
                capacity_remaining -= 1
                if capacity_remaining == 0:
                    break

        return PurchasePlan(near_items=near_items, far_items=far_items)
