#!/usr/bin/env node
import { runSimulation, formatDuration } from './simulation.js';

const baseConfig = {
  runs: 20000,
  start_gold: 35575,
  min_shop_gold: 35575,
  final_target: 26000,
  armor_thresholds: [1570],
  nights_to_sleep: 3,
  two_sleep_item_threshold: null,
  one_sleep_item_threshold: null,
  use_far_shop: true,
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

for (const scenario of scenarios) {
  const config = { ...baseConfig, ...scenario.overrides };
  const { summaries } = runSimulation(config);
  const summary = summaries[0];

  console.log(`Scenario: ${scenario.name}`);
  console.log(`  Avg time: ${summary.average_time.toFixed(2)} seconds (${formatDuration(summary.average_time)})`);
  console.log(
    `  Avg Neta cycles: ${summary.average_shop_cycles.toFixed(2)} (trips ${summary.average_shop_trips.toFixed(2)})`
  );
  console.log(
    `  Avg trips per cycle: ${summary.average_shop_trips_per_cycle.toFixed(3)}`
  );
  console.log('');
}
