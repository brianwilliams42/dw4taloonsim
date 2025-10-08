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
  IRON_PLATE_WING_COST: 25,
  OFFER_TIME_ACCEPT: 4.9,
  OFFER_TIME_REJECT: 4.8,
  ARMOR_BUY_PRICES: [
    1265, 1289, 1312, 1335, 1358, 1382, 1406, 1429, 1453, 1476, 1500, 1523,
    1546, 1570, 1593, 1617, 1640, 1664, 1687, 1710, 1734, 1757, 1781, 1804,
    1828, 1851, 1875,
  ],
  CRITICAL_SALE_CHANCE: 1.0 / 32.0,
  CRITICAL_SALE_RANGE: [2250, 3000],
  DEFAULT_START_GOLD: 29500,
  DEFAULT_FINAL_TARGET: 26000,
  SHOP_PURCHASE_COST: 35000,
  DEFAULT_MIN_SHOP_GOLD: 35550,
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
  TIME_INITIAL_SHOP_PURCHASE_AND_TRAVEL: 50.0,
  INVENTORY_CAPACITY: 8,
  SALE_PROBABILITY_PER_NIGHT: 0.75,
  CRITICAL_RETURN_RANGE: [1.5, 2.0],
  DEFAULT_SIMULATION_RUNS: 1000,
  DEFAULT_SLEEP_NIGHTS: 3,
  DEFAULT_ARMOR_THRESHOLDS: [1617, 1640, 1664, 1687, 1710, 1734, 1757],
  CLOSER_SHOP_ITEMS: [
    { name: 'Chain Sickle', cost: 550, equippable: true },
    { name: 'Venomous Dagger', cost: 750, equippable: true },
    { name: 'Iron Spear', cost: 880, equippable: true },
    { name: 'Morning Star', cost: 1250, equippable: true },
    { name: 'Abacus of Virtue', cost: 1600, equippable: true },
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

export const PURCHASE_STRATEGIES = Object.freeze({
  GREEDY: 'greedy',
  MAX_SPEND: 'max-spend',
  ABACUS_GREEDY: 'abacus-greedy',
});

export const DEFAULT_PURCHASE_STRATEGY = PURCHASE_STRATEGIES.GREEDY;

function runPhase1(rng, priceThreshold, minShopGold, startGold) {
  let gold = Number(startGold);
  let timeSpent = 0;
  let restockCycles = 0;
  let offers = 0;
  let platesRemaining = 0;
  let owesReturnWing = false;

  while (true) {
    if (gold >= minShopGold && platesRemaining === 0 && !owesReturnWing) {
      break;
    }

    if (platesRemaining === 0) {
      gold -=
        CONSTANTS.IRON_PLATE_COST * CONSTANTS.IRON_PLATE_RESTOCK_COUNT +
        CONSTANTS.IRON_PLATE_WING_COST;
      timeSpent += CONSTANTS.IRON_PLATE_RESTOCK_TIME;
      platesRemaining = CONSTANTS.IRON_PLATE_RESTOCK_COUNT;
      restockCycles += 1;
      owesReturnWing = true;
    }

    const [price] = rollOffer(rng);
    offers += 1;

    if (price >= priceThreshold) {
      gold += price;
      timeSpent += CONSTANTS.OFFER_TIME_ACCEPT;
      platesRemaining -= 1;
      if (platesRemaining === 0 && owesReturnWing) {
        gold -= CONSTANTS.IRON_PLATE_WING_COST;
        owesReturnWing = false;
      }
    } else {
      timeSpent += CONSTANTS.OFFER_TIME_REJECT;
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

const ABACUS_NAME_PATTERN = /abacus/i;

const NEAR_SHOP_MIN_COST = Math.min(
  ...CONSTANTS.CLOSER_SHOP_ITEMS.map((item) => item.cost)
);

function buildPurchaseCandidates(shopSelection = 'near') {
  if (shopSelection === 'far') {
    return CONSTANTS.FURTHER_SHOP_ITEMS.map((item) => ({
      location: 'far',
      item,
    }));
  }

  return CONSTANTS.CLOSER_SHOP_ITEMS.map((item) => ({
    location: 'near',
    item,
  }));
}

function chooseShop({ availableGold, useFarShop }) {
  if (!useFarShop) {
    return 'near';
  }

  if (availableGold >= NEAR_SHOP_MIN_COST) {
    return 'near';
  }

  const hasAffordableFarItem = CONSTANTS.FURTHER_SHOP_ITEMS.some(
    (item) => item.cost <= availableGold
  );

  return hasAffordableFarItem ? 'far' : 'near';
}

function maxAffordableItemCost(candidates, availableGold) {
  let maxCost = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    if (candidate.item.cost <= availableGold) {
      maxCost = Math.max(maxCost, candidate.item.cost);
    }
  }
  return maxCost;
}

function planInitialWalkPurchase({ gold, useFarShop }) {
  const availableGold = Math.floor(gold);
  const capacity = CONSTANTS.INVENTORY_CAPACITY;

  if (availableGold <= 0 || capacity <= 0) {
    return createEmptyPlan();
  }

  const nearCandidates = buildPurchaseCandidates('near');
  const farCandidates = buildPurchaseCandidates('far');

  const nearMax = maxAffordableItemCost(nearCandidates, availableGold);
  const farMax = useFarShop
    ? maxAffordableItemCost(farCandidates, availableGold)
    : Number.NEGATIVE_INFINITY;

  const targetShop = farMax > nearMax ? 'far' : 'near';
  const candidates = targetShop === 'far' ? farCandidates : nearCandidates;

  return planGreedyPurchase({
    candidates,
    availableGold,
    capacity,
    abacusConfig: null,
  });
}

function createEmptyPlan() {
  return {
    nearItems: [],
    farItems: [],
    totalCost: 0,
    totalItems: 0,
    visitsFarShop: false,
  };
}

function planGreedyPurchase({
  candidates,
  availableGold,
  capacity,
  abacusConfig = null,
}) {
  const plan = createEmptyPlan();
  const sortedCandidates = [...candidates].sort((a, b) => b.item.cost - a.item.cost);
  const normalizedAbacus =
    abacusConfig && typeof abacusConfig === 'object'
      ? {
          threshold:
            typeof abacusConfig.threshold === 'number' &&
            abacusConfig.threshold > 0
              ? Math.floor(abacusConfig.threshold)
              : null,
          cutoff:
            typeof abacusConfig.cutoff === 'number' && abacusConfig.cutoff > 0
              ? abacusConfig.cutoff
              : null,
        }
      : null;
  let abaciInPlan = 0;

  for (const candidate of sortedCandidates) {
    if (plan.totalItems >= capacity) {
      break;
    }

    const hasAbacusThreshold =
      normalizedAbacus && normalizedAbacus.threshold != null;
    const isAbacusItem = hasAbacusThreshold
      ? ABACUS_NAME_PATTERN.test(candidate.item.name)
      : false;

    const priceCutoff =
      hasAbacusThreshold &&
      normalizedAbacus.cutoff != null &&
      abaciInPlan >= normalizedAbacus.threshold
        ? normalizedAbacus.cutoff
        : null;

    if (priceCutoff != null && !isAbacusItem && candidate.item.cost <= priceCutoff) {
      continue;
    }

    const maxCopies = Math.min(
      Math.floor(availableGold / candidate.item.cost),
      capacity - plan.totalItems
    );

    if (maxCopies <= 0) {
      continue;
    }

    const targetList =
      candidate.location === 'near' ? plan.nearItems : plan.farItems;
    for (let index = 0; index < maxCopies; index += 1) {
      targetList.push(candidate.item);
      plan.totalCost += candidate.item.cost;
      plan.totalItems += 1;
      availableGold -= candidate.item.cost;
      if (isAbacusItem) {
        abaciInPlan += 1;
      }
    }
  }

  plan.visitsFarShop = plan.farItems.length > 0;
  return plan;
}

function planMaxSpendPurchase({ candidates, availableGold, capacity }) {
  if (capacity <= 0 || availableGold <= 0 || candidates.length === 0) {
    return createEmptyPlan();
  }

  const sortedCandidates = [...candidates].sort((a, b) => b.item.cost - a.item.cost);
  const selection = new Array(sortedCandidates.length).fill(0);
  const bestSelection = {
    totalCost: 0,
    totalItems: 0,
    counts: new Array(sortedCandidates.length).fill(0),
  };

  const cheapestCost = sortedCandidates.reduce(
    (min, candidate) => Math.min(min, candidate.item.cost),
    Number.POSITIVE_INFINITY
  );

  function updateBest(currentCost) {
    if (currentCost > bestSelection.totalCost) {
      bestSelection.totalCost = currentCost;
      bestSelection.totalItems = selection.reduce((sum, count) => sum + count, 0);
      bestSelection.counts = selection.slice();
      return;
    }

    if (currentCost === bestSelection.totalCost) {
      const totalItems = selection.reduce((sum, count) => sum + count, 0);
      if (totalItems > bestSelection.totalItems) {
        bestSelection.totalItems = totalItems;
        bestSelection.counts = selection.slice();
      }
    }
  }

  function dfs(index, remainingCapacity, remainingGold, currentCost) {
    if (index >= sortedCandidates.length || remainingCapacity === 0) {
      updateBest(currentCost);
      return;
    }

    if (remainingGold < cheapestCost) {
      updateBest(currentCost);
      return;
    }

    const candidate = sortedCandidates[index];
    const maxCopies = Math.min(
      Math.floor(remainingGold / candidate.item.cost),
      remainingCapacity
    );

    for (let copies = maxCopies; copies >= 0; copies -= 1) {
      selection[index] = copies;
      dfs(
        index + 1,
        remainingCapacity - copies,
        remainingGold - copies * candidate.item.cost,
        currentCost + copies * candidate.item.cost
      );
    }

    selection[index] = 0;
  }

  dfs(0, capacity, availableGold, 0);

  const plan = createEmptyPlan();
  plan.totalCost = bestSelection.totalCost;
  plan.totalItems = bestSelection.totalItems;

  bestSelection.counts.forEach((count, index) => {
    if (count <= 0) {
      return;
    }
    const candidate = sortedCandidates[index];
    const targetList = candidate.location === 'near' ? plan.nearItems : plan.farItems;
    for (let copy = 0; copy < count; copy += 1) {
      targetList.push(candidate.item);
    }
  });

  plan.visitsFarShop = plan.farItems.length > 0;
  return plan;
}

function planPurchases(planConfig) {
  const {
    gold,
    useFarShop,
    purchaseStrategy = DEFAULT_PURCHASE_STRATEGY,
    abacusCountThreshold,
    abacusPriceCutoff,
  } = planConfig;

  const availableGold = Math.floor(gold);
  const capacity = CONSTANTS.INVENTORY_CAPACITY;
  const selectedShop = chooseShop({ availableGold, useFarShop });
  const candidates = buildPurchaseCandidates(selectedShop);

  if (availableGold <= 0 || capacity <= 0 || candidates.length === 0) {
    return createEmptyPlan();
  }

  if (purchaseStrategy === PURCHASE_STRATEGIES.MAX_SPEND) {
    return planMaxSpendPurchase({ candidates, availableGold, capacity });
  }

  let abacusConfig = null;

  if (purchaseStrategy === PURCHASE_STRATEGIES.ABACUS_GREEDY) {
    const normalizedCount =
      typeof abacusCountThreshold === 'number' && abacusCountThreshold > 0
        ? abacusCountThreshold
        : null;
    const normalizedCutoff =
      typeof abacusPriceCutoff === 'number' && abacusPriceCutoff > 0
        ? abacusPriceCutoff
        : null;
    if (normalizedCount != null && normalizedCutoff != null) {
      abacusConfig = {
        threshold: normalizedCount,
        cutoff: normalizedCutoff,
      };
    }
  }

  return planGreedyPurchase({
    candidates,
    availableGold,
    capacity,
    abacusConfig,
  });
}

function runPhase2(rng, config) {
  const {
    nightsToSleep,
    finalTarget,
    useFarShop,
    additionalTripCutoff,
    twoSleepItemThreshold,
    oneSleepItemThreshold,
    purchaseStrategy,
    abacusCountThreshold,
    abacusPriceCutoff,
    cycleObserver = null,
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
  let initialWalkHandled = false;

  while (gold < finalTarget || pendingProfits > 0 || netaInventory.length) {
    const cycleStartGold = gold;
    const cycleStartPending = pendingProfits;
    const cycleStartInventory = netaInventory.length;
    const cycleStartTime = timeSpent;

    if (pendingProfits > 0) {
      gold += pendingProfits;
      pendingProfits = 0;
    }

    if (gold >= finalTarget) {
      break;
    }

    let tripsThisCycle = 0;
    let purchasedAny = false;
    let itemsAddedThisCycle = 0;

    const nightSummaries = [];

    while (true) {
      let isInitialWalk = false;
      let plan;
      if (!initialWalkHandled) {
        plan = planInitialWalkPurchase({ gold, useFarShop });
        initialWalkHandled = true;
        isInitialWalk = true;
      } else {
        plan = planPurchases({
          gold,
          useFarShop,
          purchaseStrategy,
          abacusCountThreshold,
          abacusPriceCutoff,
        });
      }
      if (plan.totalItems === 0) {
        if (isInitialWalk) {
          continue;
        }
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

      if (isInitialWalk) {
        timeSpent += CONSTANTS.TIME_INITIAL_SHOP_PURCHASE_AND_TRAVEL;
      } else {
        timeSpent += CONSTANTS.TIME_CLAIM_PROFITS_AND_TO_NEAR_SHOP;
      }

      for (const item of plan.nearItems) {
        timeSpent += item.equippable
          ? CONSTANTS.TIME_PURCHASE_EQUIPPABLE
          : CONSTANTS.TIME_PURCHASE_NOT_EQUIPPABLE;
      }

      if (plan.visitsFarShop) {
        if (!isInitialWalk) {
          timeSpent += CONSTANTS.TIME_TRAVEL_EXTRA_TO_FAR_SHOP;
        }
        for (const item of plan.farItems) {
          timeSpent += item.equippable
            ? CONSTANTS.TIME_PURCHASE_EQUIPPABLE
            : CONSTANTS.TIME_PURCHASE_NOT_EQUIPPABLE;
        }
      }

      if (!isInitialWalk) {
        timeSpent += CONSTANTS.TIME_RETURN_TO_NETA_FROM_NEAR;
        if (plan.visitsFarShop) {
          timeSpent += CONSTANTS.TIME_RETURN_EXTRA_FROM_FAR;
        }
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

    timeSpent += nightsThisCycle * CONSTANTS.TIME_SLEEP_ONE_NIGHT;

    const inventoryBeforeSleep = netaInventory.length;
    let totalSoldThisCycle = 0;
    let profitsThisCycle = 0;

    for (let night = 0; night < nightsThisCycle; night += 1) {
      const remainingInventory = [];
      let soldThisNight = 0;
      let profitThisNight = 0;
      for (const cost of netaInventory) {
        if (rng.random() < CONSTANTS.SALE_PROBABILITY_PER_NIGHT) {
          const multiplier = rng.uniform(
            CONSTANTS.CRITICAL_RETURN_RANGE[0],
            CONSTANTS.CRITICAL_RETURN_RANGE[1]
          );
          const saleValue = Math.round(cost * multiplier);
          pendingProfits += saleValue;
          soldThisNight += 1;
          profitThisNight += saleValue;
        } else {
          remainingInventory.push(cost);
        }
      }
      netaInventory = remainingInventory;
      totalSoldThisCycle += soldThisNight;
      profitsThisCycle += profitThisNight;
      if (cycleObserver) {
        nightSummaries.push({
          night: night + 1,
          soldCount: soldThisNight,
          profitsGenerated: profitThisNight,
          inventoryRemaining: netaInventory.length,
        });
      }
    }

    if (cycleObserver) {
      cycleObserver({
        cycleIndex: netaCycles,
        startGold: cycleStartGold,
        goldAfterPurchases: gold,
        pendingProfitsAtStart: cycleStartPending,
        pendingProfitsAfterSleep: pendingProfits,
        itemsAddedThisCycle,
        nightsScheduled: nightsToSleep,
        nightsSlept: nightsThisCycle,
        inventoryAtStart: cycleStartInventory,
        inventoryBeforeSleep,
        inventoryAfterSleep: netaInventory.length,
        itemsSoldThisCycle: totalSoldThisCycle,
        profitsGeneratedThisCycle: profitsThisCycle,
        tripsThisCycle,
        timeSpentThisCycle: timeSpent - cycleStartTime,
        nightSummaries,
      });
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
        purchaseStrategy: config.purchase_strategy,
        abacusCountThreshold: config.abacus_count_threshold,
        abacusPriceCutoff: config.abacus_price_cutoff,
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

export function runSingleSimulation(config, options = {}) {
  const thresholds = Array.from(config.armor_thresholds || []);
  if (thresholds.length === 0) {
    throw new Error('runSingleSimulation requires at least one armor threshold.');
  }

  const thresholdIndex =
    typeof options.thresholdIndex === 'number' && options.thresholdIndex >= 0
      ? Math.floor(options.thresholdIndex)
      : 0;
  if (thresholdIndex >= thresholds.length) {
    throw new Error('thresholdIndex is out of range for provided thresholds.');
  }

  const threshold = thresholds[thresholdIndex];
  const baseSeed = normalizeSeed(config.seed);
  const runIndex =
    typeof options.runIndex === 'number' && options.runIndex >= 0
      ? Math.floor(options.runIndex)
      : 0;
  const seed = hashSeedComponents(baseSeed, threshold, runIndex);
  const rng = createRng(seed);

  const phase1Result = runPhase1(
    rng,
    threshold,
    config.min_shop_gold,
    config.start_gold
  );

  const cycleLogs = [];
  const phase2Result = runPhase2(rng, {
    startGold: phase1Result.gold,
    nightsToSleep: config.nights_to_sleep,
    finalTarget: config.final_target,
    useFarShop: config.use_far_shop,
    additionalTripCutoff: config.additional_trip_cutoff,
    twoSleepItemThreshold: config.two_sleep_item_threshold,
    oneSleepItemThreshold: config.one_sleep_item_threshold,
    purchaseStrategy: config.purchase_strategy,
    abacusCountThreshold: config.abacus_count_threshold,
    abacusPriceCutoff: config.abacus_price_cutoff,
    cycleObserver: options.captureCycles ? (cycle) => cycleLogs.push(cycle) : null,
  });

  return {
    threshold,
    baseSeed,
    runIndex,
    seed,
    totalTime: phase1Result.timeSeconds + phase2Result.timeSeconds,
    phase1: phase1Result,
    phase2: phase2Result,
    cycleLogs,
  };
}
