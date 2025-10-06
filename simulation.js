export const DEFAULT_TIME_BUCKET_SECONDS = 30;

export function formatDuration(totalSeconds) {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const wholeSeconds = Math.round(safeSeconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function createSeed(seedValue) {
  let seed = seedValue >>> 0;
  if (seed === 0) {
    seed = 0x9e3779b9;
  }
  return seed >>> 0;
}

function hashSeedComponents(seed, threshold, runIndex) {
  let value = 0x811c9dc5;
  const components = [seed ?? 0, threshold, runIndex];
  for (const component of components) {
    let part = Number(component) | 0;
    value ^= part & 0xffffffff;
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

function mulberry32(a) {
  let state = createSeed(a);
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed) {
  const next = mulberry32(seed);
  return {
    random: () => next(),
    randint(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    choice(items) {
      const index = Math.floor(next() * items.length);
      return items[index];
    },
    uniform(min, max) {
      return next() * (max - min) + min;
    },
  };
}

export const CONSTANTS = Object.freeze({
  IRON_PLATE_COST: 1500,
  IRON_PLATE_RESTOCK_COUNT: 7,
  IRON_PLATE_RESTOCK_TIME: 94.0,
  IRON_PLATE_WING_COST: 50,
  OFFER_TIME_ACCEPT: 4.9,
  OFFER_TIME_REJECT: 4.8,
  ARMOR_BUY_PRICES: [
    1265, 1289, 1312, 1335, 1358, 1382, 1406, 1429, 1453, 1476, 1500, 1523,
    1546, 1570, 1593, 1617, 1640, 1664, 1687, 1710, 1734, 1757, 1781, 1804,
    1828, 1851, 1875,
  ],
  CRITICAL_SALE_CHANCE: 1.0 / 32.0,
  CRITICAL_SALE_RANGE: [2250, 3000],
  DEFAULT_START_GOLD: 30000,
  DEFAULT_FINAL_TARGET: 26000,
  SHOP_PURCHASE_COST: 35000,
  DEFAULT_MIN_SHOP_GOLD: 35575,
  TIME_CLAIM_PROFITS_AND_TO_NEAR_SHOP: 20.3,
  TIME_TRAVEL_EXTRA_TO_FAR_SHOP: 3.87,
  TIME_PURCHASE_EQUIPPABLE: 4.1,
  TIME_PURCHASE_NOT_EQUIPPABLE: 5.2,
  TIME_RETURN_TO_NETA_FROM_NEAR: 7.4,
  TIME_RETURN_EXTRA_FROM_FAR: 3.87,
  TIME_GIVE_ITEM_TO_NETA: 5.0,
  TIME_EAT_LUNCH: 3.0,
  TIME_RETURN_FOR_SLEEP: 8.7,
  TIME_SLEEP_ONE_NIGHT: 7.35,
  INVENTORY_CAPACITY: 8,
  SALE_PROBABILITY_PER_NIGHT: 0.75,
  CRITICAL_RETURN_RANGE: [1.5, 2.0],
  DEFAULT_SIMULATION_RUNS: 1000,
  DEFAULT_SLEEP_NIGHTS: 3,
  DEFAULT_ARMOR_THRESHOLDS: [
    1570, 1593, 1617, 1640, 1664, 1687, 1710, 1734, 1757, 1781,
  ],
  CLOSER_SHOP_ITEMS: [
    { name: 'Iron Apron', cost: 550, equippable: true },
    { name: 'Iron Spear', cost: 750, equippable: true },
    { name: 'Half Plate', cost: 880, equippable: true },
    { name: 'Full Plate', cost: 1250, equippable: false },
    { name: 'Steel Broadsword', cost: 1600, equippable: true },
  ],
  FURTHER_SHOP_ITEMS: [
    { name: 'Divine Dagger', cost: 350, equippable: true },
    { name: 'Morning Star', cost: 700, equippable: true },
    { name: 'Iron Shield', cost: 1200, equippable: false },
    { name: 'Battle Axe', cost: 1500, equippable: true },
    { name: 'Clothes H', cost: 180, equippable: true },
    { name: 'Leather Armor', cost: 650, equippable: true },
  ],
});

function runPhase1(rng, priceThreshold, minShopGold, startGold) {
  let gold = Number(startGold);
  let timeSpent = 0;
  let restockCycles = 0;
  let offers = 0;
  let platesRemaining = 0;

  while (gold < minShopGold) {
    if (platesRemaining === 0) {
      gold -=
        CONSTANTS.IRON_PLATE_COST * CONSTANTS.IRON_PLATE_RESTOCK_COUNT +
        CONSTANTS.IRON_PLATE_WING_COST;
      timeSpent += CONSTANTS.IRON_PLATE_RESTOCK_TIME;
      platesRemaining = CONSTANTS.IRON_PLATE_RESTOCK_COUNT;
      restockCycles += 1;
    }

    const [price] = rollOffer(rng);
    offers += 1;

    if (price >= priceThreshold) {
      gold += price;
      timeSpent += CONSTANTS.OFFER_TIME_ACCEPT;
      platesRemaining -= 1;
    } else {
      timeSpent += CONSTANTS.OFFER_TIME_REJECT;
    }

    if (platesRemaining === 0 && gold >= minShopGold) {
      break;
    }
  }

  return {
    gold,
    timeSeconds: timeSpent,
    restockCycles,
    offersMade: offers,
  };
}

function rollOffer(rng) {
  if (rng.random() < CONSTANTS.CRITICAL_SALE_CHANCE) {
    const [low, high] = CONSTANTS.CRITICAL_SALE_RANGE;
    return [rng.randint(low, high), true];
  }
  return [rng.choice(CONSTANTS.ARMOR_BUY_PRICES), false];
}

function planPurchases(rngConfig) {
  const {
    gold,
    useFarShop,
  } = rngConfig;
  const nearItems = [];
  const farItems = [];
  let capacityRemaining = CONSTANTS.INVENTORY_CAPACITY;
  let availableGold = Math.floor(gold);

  const candidates = CONSTANTS.CLOSER_SHOP_ITEMS.map((item) => ({
    location: 'near',
    item,
  }));

  if (useFarShop) {
    CONSTANTS.FURTHER_SHOP_ITEMS.forEach((item) =>
      candidates.push({ location: 'far', item })
    );
  }

  candidates.sort((a, b) => b.item.cost - a.item.cost);

  for (const candidate of candidates) {
    if (capacityRemaining === 0) {
      break;
    }
    const { item, location } = candidate;
    const maxCopies = Math.min(
      Math.floor(availableGold / item.cost),
      capacityRemaining
    );
    for (let i = 0; i < maxCopies; i += 1) {
      if (location === 'near') {
        nearItems.push(item);
      } else {
        farItems.push(item);
      }
      availableGold -= item.cost;
      capacityRemaining -= 1;
      if (capacityRemaining === 0) {
        break;
      }
    }
  }

  return {
    nearItems,
    farItems,
    totalCost:
      nearItems.reduce((sum, item) => sum + item.cost, 0) +
      farItems.reduce((sum, item) => sum + item.cost, 0),
    totalItems: nearItems.length + farItems.length,
    visitsFarShop: farItems.length > 0,
  };
}

function runPhase2(rng, config) {
  const {
    nightsToSleep,
    finalTarget,
    useFarShop,
    additionalTripCutoff,
    twoSleepItemThreshold,
    oneSleepItemThreshold,
  } = config;

  let gold = Number(config.startGold) - CONSTANTS.SHOP_PURCHASE_COST;
  if (gold < 0) {
    throw new Error('Insufficient gold to purchase the shop.');
  }

  let timeSpent = 0;
  let netaCycles = 0;
  let totalTrips = 0;
  let pendingProfits = 0;
  let netaInventory = [];

  while (gold < finalTarget || pendingProfits > 0 || netaInventory.length) {
    if (pendingProfits > 0) {
      gold += pendingProfits;
      pendingProfits = 0;
    }

    if (gold >= finalTarget && netaInventory.length === 0) {
      break;
    }

    let tripsThisCycle = 0;
    let purchasedAny = false;
    let itemsAddedThisCycle = 0;

    while (true) {
      const plan = planPurchases({ gold, useFarShop });
      if (plan.totalItems === 0) {
        break;
      }

      if (tripsThisCycle > 0) {
        if (additionalTripCutoff != null) {
          if (gold < additionalTripCutoff || tripsThisCycle >= 2) {
            break;
          }
        } else {
          break;
        }
      }

      tripsThisCycle += 1;
      totalTrips += 1;
      purchasedAny = true;

      timeSpent += CONSTANTS.TIME_CLAIM_PROFITS_AND_TO_NEAR_SHOP;

      for (const item of plan.nearItems) {
        timeSpent += item.equippable
          ? CONSTANTS.TIME_PURCHASE_EQUIPPABLE
          : CONSTANTS.TIME_PURCHASE_NOT_EQUIPPABLE;
      }

      if (plan.visitsFarShop) {
        timeSpent += CONSTANTS.TIME_TRAVEL_EXTRA_TO_FAR_SHOP;
        for (const item of plan.farItems) {
          timeSpent += item.equippable
            ? CONSTANTS.TIME_PURCHASE_EQUIPPABLE
            : CONSTANTS.TIME_PURCHASE_NOT_EQUIPPABLE;
        }
      }

      timeSpent += CONSTANTS.TIME_RETURN_TO_NETA_FROM_NEAR;
      if (plan.visitsFarShop) {
        timeSpent += CONSTANTS.TIME_RETURN_EXTRA_FROM_FAR;
      }

      timeSpent += CONSTANTS.TIME_EAT_LUNCH;
      timeSpent += plan.totalItems * CONSTANTS.TIME_GIVE_ITEM_TO_NETA;

      gold -= plan.totalCost;
      for (const item of plan.nearItems) {
        netaInventory.push(item.cost);
      }
      for (const item of plan.farItems) {
        netaInventory.push(item.cost);
      }
      itemsAddedThisCycle += plan.totalItems;
    }

    if (!purchasedAny && netaInventory.length === 0) {
      break;
    }

    timeSpent += CONSTANTS.TIME_RETURN_FOR_SLEEP;
    netaCycles += 1;
    let nightsThisCycle = nightsToSleep;
    if (itemsAddedThisCycle > 0) {
      if (
        oneSleepItemThreshold != null &&
        itemsAddedThisCycle <= oneSleepItemThreshold
      ) {
        nightsThisCycle = Math.min(nightsThisCycle, 1);
      } else if (
        twoSleepItemThreshold != null &&
        itemsAddedThisCycle <= twoSleepItemThreshold
      ) {
        nightsThisCycle = Math.min(nightsThisCycle, 2);
      }
    }

    timeSpent += nightsThisCycle * CONSTANTS.TIME_SLEEP_ONE_NIGHT;

    for (let night = 0; night < nightsThisCycle; night += 1) {
      const remainingInventory = [];
      for (const cost of netaInventory) {
        if (rng.random() < CONSTANTS.SALE_PROBABILITY_PER_NIGHT) {
          const multiplier = rng.uniform(
            CONSTANTS.CRITICAL_RETURN_RANGE[0],
            CONSTANTS.CRITICAL_RETURN_RANGE[1]
          );
          const saleValue = Math.round(cost * multiplier);
          pendingProfits += saleValue;
        } else {
          remainingInventory.push(cost);
        }
      }
      netaInventory = remainingInventory;
    }
  }

  if (pendingProfits > 0) {
    gold += pendingProfits;
  }

  return {
    gold,
    timeSeconds: timeSpent,
    netaCycles,
    purchaseTrips: totalTrips,
  };
}

function mean(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function populationStdDev(values) {
  if (values.length <= 1) {
    return 0;
  }
  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function bucketStart(totalTime, bucketSize) {
  const bucketIndex = Math.floor(totalTime / bucketSize);
  return bucketIndex * bucketSize;
}

function normalizeSeed(seedValue) {
  if (seedValue == null || seedValue === '') {
    return 0;
  }
  const numeric = Number(seedValue);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.trunc(numeric) >>> 0;
}

export function runSimulation(config) {
  const summaries = [];
  const bucketSize =
    typeof config.time_bucket_seconds === 'number'
      ? config.time_bucket_seconds
      : DEFAULT_TIME_BUCKET_SECONDS;
  const thresholds = Array.from(config.armor_thresholds || []);
  const baseSeed = normalizeSeed(config.seed);

  for (let thresholdIndex = 0; thresholdIndex < thresholds.length; thresholdIndex += 1) {
    const threshold = thresholds[thresholdIndex];
    const results = [];

    for (let runIndex = 0; runIndex < config.runs; runIndex += 1) {
      const seed = hashSeedComponents(baseSeed, threshold, runIndex);
      const rng = createRng(seed);

      const phase1Result = runPhase1(
        rng,
        threshold,
        config.min_shop_gold,
        config.start_gold
      );

      const phase2Result = runPhase2(rng, {
        startGold: phase1Result.gold,
        nightsToSleep: config.nights_to_sleep,
        finalTarget: config.final_target,
        useFarShop: config.use_far_shop,
        additionalTripCutoff: config.additional_trip_cutoff,
        twoSleepItemThreshold: config.two_sleep_item_threshold,
        oneSleepItemThreshold: config.one_sleep_item_threshold,
      });

      const totalTime = phase1Result.timeSeconds + phase2Result.timeSeconds;
      results.push({
        totalTime,
        armorRestockCycles: phase1Result.restockCycles,
        netaCycles: phase2Result.netaCycles,
        shopPurchaseTrips: phase2Result.purchaseTrips,
      });
    }

    const times = results.map((result) => result.totalTime);
    const armorRestockCycles = results.map(
      (result) => result.armorRestockCycles
    );
    const netaCycles = results.map((result) => result.netaCycles);
    const shopPurchaseTrips = results.map(
      (result) => result.shopPurchaseTrips
    );
    const averageShopCycles = mean(netaCycles);
    const averageShopTrips = mean(shopPurchaseTrips);
    const averageTripsPerCycle =
      averageShopCycles === 0 ? 0 : averageShopTrips / averageShopCycles;

    const bucketMap = new Map();
    for (const time of times) {
      const start = bucketStart(time, bucketSize);
      bucketMap.set(start, (bucketMap.get(start) || 0) + 1);
    }

    const bucketCounts = Array.from(bucketMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([start, count]) => ({
        label: `${formatDuration(start)}-${formatDuration(start + bucketSize)}`,
        count,
      }));

    const fastestTime = Math.min(...times);

    summaries.push({
      threshold,
      average_time: mean(times),
      std_dev_time: populationStdDev(times),
      average_armor_restock_cycles: mean(armorRestockCycles),
      average_shop_cycles: averageShopCycles,
      average_shop_trips: averageShopTrips,
      average_shop_trips_per_cycle: averageTripsPerCycle,
      bucket_counts: bucketCounts,
      fastest_time: fastestTime,
    });
  }

  return { seed: baseSeed, summaries };
}
