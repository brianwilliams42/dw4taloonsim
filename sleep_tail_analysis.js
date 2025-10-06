#!/usr/bin/env node
import { runSingleSimulation, formatDuration } from './simulation.js';

const runs = 100000;

const baseConfig = {
  runs,
  start_gold: 35575,
  min_shop_gold: 35575,
  final_target: 26000,
  armor_thresholds: [1570],
  nights_to_sleep: 3,
  two_sleep_item_threshold: null,
  one_sleep_item_threshold: null,
  use_far_shop: false,
  additional_trip_cutoff: null,
  seed: null,
  time_bucket_seconds: 30,
  purchase_strategy: 'greedy',
  abacus_count_threshold: null,
  abacus_price_cutoff: null,
};

const scenarios = [
  {
    name: 'Always sleep 3 nights',
    overrides: {},
  },
  {
    name: 'Sleep 2 nights for <=7 items',
    overrides: {
      two_sleep_item_threshold: 7,
    },
  },
  {
    name: 'Always sleep 2 nights',
    overrides: {
      nights_to_sleep: 2,
    },
  },
];

function percentile(values, target) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((target / 100) * sorted.length) - 1)
  );
  return sorted[index];
}

for (const scenario of scenarios) {
  const config = { ...baseConfig, ...scenario.overrides };
  const times = [];
  let maxRun = null;

  for (let runIndex = 0; runIndex < runs; runIndex += 1) {
    const result = runSingleSimulation(config, { runIndex });
    times.push(result.totalTime);
    if (!maxRun || result.totalTime > maxRun.totalTime) {
      maxRun = { runIndex, totalTime: result.totalTime };
    }
  }

  const avg = times.reduce((sum, value) => sum + value, 0) / times.length;
  const p90 = percentile(times, 90);
  const p99 = percentile(times, 99);
  const maxResult = runSingleSimulation(config, {
    runIndex: maxRun.runIndex,
    captureCycles: true,
  });

  console.log(`Scenario: ${scenario.name}`);
  console.log(
    `  Avg: ${avg.toFixed(2)}s (${formatDuration(avg)}) | P90: ${formatDuration(p90)} | P99: ${formatDuration(p99)} | Max: ${formatDuration(maxRun.totalTime)}`
  );
  console.log(`  Longest run index: ${maxRun.runIndex}`);
  console.log('  Cycle breakdown for longest run:');
  for (const cycle of maxResult.cycleLogs) {
    const {
      cycleIndex,
      itemsAddedThisCycle,
      nightsSlept,
      inventoryBeforeSleep,
      inventoryAfterSleep,
      itemsSoldThisCycle,
      timeSpentThisCycle,
      nightSummaries,
    } = cycle;
    const unsold = inventoryAfterSleep;
    console.log(
      `    Cycle ${cycleIndex}: +${itemsAddedThisCycle} items, slept ${nightsSlept}, sold ${itemsSoldThisCycle}, unsold ${unsold}, time ${timeSpentThisCycle.toFixed(
        2
      )}s`
    );
    for (const night of nightSummaries) {
      console.log(
        `      Night ${night.night}: sold ${night.soldCount}, remaining ${night.inventoryRemaining}`
      );
    }
  }
  console.log('');
}
