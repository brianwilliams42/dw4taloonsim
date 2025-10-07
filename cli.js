#!/usr/bin/env node
import {
  runSimulation,
  DEFAULT_TIME_BUCKET_SECONDS,
  CONSTANTS,
  formatDuration,
  PURCHASE_STRATEGIES,
  DEFAULT_PURCHASE_STRATEGY,
} from './simulation.js';
import { getDefaultConfig } from './defaults.js';

function printHelp() {
  const constraints = getDefaultConfig().constraints;
  console.log(`Usage: node cli.js [options]\n\nOptions:\n` +
    `  --start-gold <int>           Gold Taloon has when the simulation begins (default ${CONSTANTS.DEFAULT_START_GOLD}).\n` +
    `  --min-shop-gold <int>        Gold required before purchasing the shop (default ${CONSTANTS.DEFAULT_MIN_SHOP_GOLD}).\n` +
    `  --final-target <int>         Gold required after collecting profits (default ${CONSTANTS.DEFAULT_FINAL_TARGET}).\n` +
    `  --thresholds <list>          Comma-separated armor thresholds between ${constraints.min_threshold} and ${constraints.max_threshold}.\n` +
    `  --runs <int>                 Number of Monte Carlo simulations per threshold (default ${CONSTANTS.DEFAULT_SIMULATION_RUNS}).\n` +
    `  --nights <int>               Nights Taloon sleeps before collecting shop profits (default ${CONSTANTS.DEFAULT_SLEEP_NIGHTS}).\n` +
    `  --two-sleep-threshold <int>  Sleep twice instead of the default nights when giving Neta this many items or fewer.\n` +
    `  --one-sleep-threshold <int>  Sleep once instead of the default nights when giving Neta this many items or fewer.\n` +
    `  --additional-trip-cutoff <int>  Minimum gold remaining to take an extra purchase trip before sleeping.\n` +
    `  --seed <int>                 Seed for deterministic simulations.\n` +
    `  --purchase-strategy <name>  Purchase planning algorithm (greedy, max-spend, abacus-greedy).\n` +
    `  --abacus-count-threshold <int>  Minimum Abacus of Virtue purchases before skipping cheaper items (abacus strategy).\n` +
    `  --abacus-price-cutoff <int>  Gold cutoff for cheaper items once the abacus condition is met (abacus strategy).\n` +
    `  --time-bucket-seconds <int>  Override histogram bucket size in seconds (default ${DEFAULT_TIME_BUCKET_SECONDS}).\n` +
    `  -h, --help                   Show this help message.\n`);
}

const VALID_PURCHASE_STRATEGIES = new Set(Object.values(PURCHASE_STRATEGIES));

function parseInteger(name, value, { allowNull = false, min = -Infinity } = {}) {
  if (value == null) {
    if (allowNull) {
      return null;
    }
    throw new Error(`Missing value for ${name}.`);
  }
  if (allowNull && value.toLowerCase() === 'null') {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${name} must be an integer.`);
  }
  if (parsed < min) {
    throw new Error(`${name} must be at least ${min}.`);
  }
  return parsed;
}

function parseThresholds(raw, constraints) {
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    throw new Error('At least one armor threshold must be provided.');
  }
  return parts.map((part) => {
    const value = parseInteger('threshold', part, { min: constraints.min_threshold });
    if (value > constraints.max_threshold) {
      throw new Error(
        `Armor threshold ${value} outside valid range ${constraints.min_threshold}-${constraints.max_threshold}.`
      );
    }
    return value;
  });
}

function parseArgs(argv) {
  const config = getDefaultConfig();
  const defaultStrategy = config.defaults.purchase_strategy ?? DEFAULT_PURCHASE_STRATEGY;
  const options = {
    start_gold: config.defaults.start_gold,
    min_shop_gold: config.defaults.min_shop_gold,
    final_target: config.defaults.final_target,
    armor_thresholds: [...config.defaults.armor_thresholds],
    runs: config.defaults.runs,
    nights_to_sleep: config.defaults.nights_to_sleep,
    two_sleep_item_threshold: config.defaults.two_sleep_item_threshold,
    one_sleep_item_threshold: config.defaults.one_sleep_item_threshold,
    use_far_shop: config.defaults.use_far_shop,
    additional_trip_cutoff: config.defaults.additional_trip_cutoff,
    seed: config.defaults.seed,
    time_bucket_seconds: config.constraints.time_bucket_seconds,
    purchase_strategy: defaultStrategy,
    abacus_count_threshold: config.defaults.abacus_count_threshold,
    abacus_price_cutoff: config.defaults.abacus_price_cutoff,
  };

  const args = [...argv];
  while (args.length > 0) {
    const arg = args.shift();
    switch (arg) {
      case '--start-gold':
        options.start_gold = parseInteger('start gold', args.shift(), { min: 1 });
        break;
      case '--min-shop-gold':
        options.min_shop_gold = parseInteger('min shop gold', args.shift(), { min: 1 });
        break;
      case '--final-target':
        options.final_target = parseInteger('final target', args.shift(), { min: 1 });
        break;
      case '--thresholds':
        options.armor_thresholds = parseThresholds(args.shift() ?? '', config.constraints);
        break;
      case '--runs':
        options.runs = parseInteger('runs', args.shift(), { min: 1 });
        break;
      case '--nights':
        options.nights_to_sleep = parseInteger('nights', args.shift(), { min: 1 });
        break;
      case '--two-sleep-threshold':
        options.two_sleep_item_threshold = parseInteger(
          'two-sleep threshold',
          args.shift(),
          { allowNull: true, min: 0 }
        );
        break;
      case '--one-sleep-threshold':
        options.one_sleep_item_threshold = parseInteger(
          'one-sleep threshold',
          args.shift(),
          { allowNull: true, min: 0 }
        );
        break;
      case '--additional-trip-cutoff':
        options.additional_trip_cutoff = parseInteger('additional trip cutoff', args.shift(), {
          allowNull: true,
          min: 0,
        });
        break;
      case '--seed':
        options.seed = parseInteger('seed', args.shift(), { allowNull: true });
        break;
      case '--purchase-strategy': {
        const value = args.shift();
        if (!value || !VALID_PURCHASE_STRATEGIES.has(value)) {
          throw new Error(
            `Purchase strategy must be one of: ${Array.from(VALID_PURCHASE_STRATEGIES).join(', ')}.`
          );
        }
        options.purchase_strategy = value;
        break;
      }
      case '--abacus-count-threshold':
        options.abacus_count_threshold = parseInteger('abacus count threshold', args.shift(), {
          allowNull: true,
          min: 0,
        });
        break;
      case '--abacus-price-cutoff':
        options.abacus_price_cutoff = parseInteger('abacus price cutoff', args.shift(), {
          allowNull: true,
          min: 0,
        });
        break;
      case '--time-bucket-seconds':
        options.time_bucket_seconds = parseInteger('time bucket seconds', args.shift(), { min: 1 });
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.min_shop_gold <= CONSTANTS.SHOP_PURCHASE_COST) {
    throw new Error('Minimum shop gold must exceed the cost of the shop purchase.');
  }

  if (options.additional_trip_cutoff != null && options.additional_trip_cutoff < 0) {
    throw new Error('Additional trip cutoff must be non-negative.');
  }

  if (
    options.purchase_strategy === PURCHASE_STRATEGIES.ABACUS_GREEDY &&
    (options.abacus_count_threshold == null || options.abacus_price_cutoff == null)
  ) {
    throw new Error(
      'Abacus-aware strategy requires both --abacus-count-threshold and --abacus-price-cutoff values.'
    );
  }

  return options;
}

function formatNumber(value) {
  return Number.parseFloat(value).toFixed(2);
}

function main(argv) {
  try {
    const options = parseArgs(argv);
    const result = runSimulation(options);
    const summaries = result.summaries;

    console.log(`Using base seed: ${result.seed}`);

    for (const summary of summaries) {
      console.log(`Threshold ${summary.threshold}:`);
      console.log(
        `  Avg time: ${formatDuration(summary.average_time)} (σ ${formatDuration(summary.std_dev_time)})`
      );
      console.log(
        `  Avg iron-plate restock cycles: ${formatNumber(summary.average_armor_restock_cycles)}`
      );
      console.log(
        `  Avg Neta sleep loops: ${formatNumber(summary.average_shop_cycles)} loops (≈ ${formatNumber(summary.average_shop_trips)} trips; ${formatNumber(summary.average_shop_trips_per_cycle)} trips/loop)`
      );
      console.log(
        `  Time distribution (${formatDuration(options.time_bucket_seconds)} buckets):`
      );
      for (const bucket of summary.bucket_counts) {
        console.log(`    ${bucket.label}: ${bucket.count}`);
      }
      console.log('');
    }
  } catch (error) {
    console.error(error.message);
    console.error('Use --help to see available options.');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}

export { main };
