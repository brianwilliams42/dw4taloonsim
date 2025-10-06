import { CONSTANTS, DEFAULT_TIME_BUCKET_SECONDS } from './simulation.js';

export const DEFAULT_FORM_CONFIG = {
  defaults: {
    start_gold: CONSTANTS.DEFAULT_START_GOLD,
    min_shop_gold: CONSTANTS.DEFAULT_MIN_SHOP_GOLD,
    final_target: CONSTANTS.DEFAULT_FINAL_TARGET,
    armor_thresholds: [...CONSTANTS.DEFAULT_ARMOR_THRESHOLDS],
    nights_to_sleep: CONSTANTS.DEFAULT_SLEEP_NIGHTS,
    runs: CONSTANTS.DEFAULT_SIMULATION_RUNS,
    additional_trip_cutoff: null,
    seed: null,
    use_far_shop: false,
  },
  constraints: {
    min_threshold: Math.min(...CONSTANTS.ARMOR_BUY_PRICES),
    max_threshold: Math.max(...CONSTANTS.ARMOR_BUY_PRICES),
    time_bucket_seconds: DEFAULT_TIME_BUCKET_SECONDS,
  },
};

export function getDefaultConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_FORM_CONFIG));
}
