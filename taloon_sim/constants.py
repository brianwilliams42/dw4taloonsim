"""Simulation constants for Taloon's money-making strategy."""

from dataclasses import dataclass
from typing import Tuple


IRON_PLATE_COST: int = 1500
IRON_PLATE_RESTOCK_COUNT: int = 7
IRON_PLATE_RESTOCK_TIME: float = 94.0
IRON_PLATE_WING_COST: int = 50

OFFER_TIME_ACCEPT: float = 4.9
OFFER_TIME_REJECT: float = 4.8

ARMOR_BUY_PRICES = (
    1265,
    1289,
    1312,
    1335,
    1358,
    1382,
    1406,
    1429,
    1453,
    1476,
    1500,
    1523,
    1546,
    1570,
    1593,
    1617,
    1640,
    1664,
    1687,
    1710,
    1734,
    1757,
    1781,
    1804,
    1828,
    1851,
    1875,
)

CRITICAL_SALE_CHANCE: float = 1.0 / 32.0
CRITICAL_SALE_RANGE: Tuple[int, int] = (2250, 3000)

DEFAULT_START_GOLD: int = 30000
DEFAULT_FINAL_TARGET: int = 26000
SHOP_PURCHASE_COST: int = 35000
DEFAULT_MIN_SHOP_GOLD: int = 35575

TIME_CLAIM_PROFITS_AND_TO_NEAR_SHOP: float = 20.3
TIME_TRAVEL_EXTRA_TO_FAR_SHOP: float = 3.87
TIME_PURCHASE_EQUIPPABLE: float = 4.1
TIME_PURCHASE_NOT_EQUIPPABLE: float = 5.2
TIME_RETURN_TO_NETA_FROM_NEAR: float = 7.4
TIME_RETURN_EXTRA_FROM_FAR: float = 3.87
TIME_GIVE_ITEM_TO_NETA: float = 5.0
TIME_EAT_LUNCH: float = 3.0
TIME_RETURN_FOR_SLEEP: float = 8.7
TIME_SLEEP_ONE_NIGHT: float = 7.35

INVENTORY_CAPACITY: int = 8

SALE_PROBABILITY_PER_NIGHT: float = 0.75
CRITICAL_RETURN_RANGE: Tuple[float, float] = (1.5, 2.0)

DEFAULT_SIMULATION_RUNS: int = 1000
DEFAULT_SLEEP_NIGHTS: int = 3

DEFAULT_ARMOR_THRESHOLDS = (1523, 1600, 1700, 1800)


@dataclass(frozen=True)
class ShopItem:
    """Description of a purchasable item for Neta's shop."""

    name: str
    cost: int
    equippable: bool


CLOSER_SHOP_ITEMS = (
    ShopItem("Iron Apron", 550, True),
    ShopItem("Iron Spear", 750, True),
    ShopItem("Half Plate", 880, True),
    ShopItem("Full Plate", 1250, False),
    ShopItem("Steel Broadsword", 1600, True),
)

FURTHER_SHOP_ITEMS = (
    ShopItem("Divine Dagger", 350, True),
    ShopItem("Morning Star", 700, True),
    ShopItem("Iron Shield", 1200, False),
    ShopItem("Battle Axe", 1500, True),
    ShopItem("Clothes H", 180, True),
    ShopItem("Leather Armor", 650, True),
)


TIME_BUCKET_SECONDS: int = 15
