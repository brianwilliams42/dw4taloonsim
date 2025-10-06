import {
  runSimulation,
  DEFAULT_TIME_BUCKET_SECONDS,
  formatDuration,
} from './simulation.js';
import { getDefaultConfig } from './defaults.js';

const form = document.getElementById('sim-form');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const runButton = document.getElementById('run-btn');
const resetButton = document.getElementById('reset-btn');
const thresholdHint = document.getElementById('threshold-hint');
const minShopGoldInput = document.getElementById('min-shop-gold');
const useFarShopInput = document.getElementById('use-far-shop');

const REQUIRED_SHOP_PURCHASE_GOLD = 35000;
const REQUIRED_WING_COST = 25;
const REQUIRED_NEAR_ITEM_COST = 550;
const REQUIRED_FAR_ITEM_COST = 180;

let defaults = null;
let constraints = null;
let bucketSeconds = DEFAULT_TIME_BUCKET_SECONDS;

function generateRandomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0] >>> 0;
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

function resolveBucketSeconds() {
  const configured = constraints?.time_bucket_seconds;
  if (typeof configured === 'number' && Number.isFinite(configured)) {
    return Math.max(DEFAULT_TIME_BUCKET_SECONDS, configured);
  }
  return DEFAULT_TIME_BUCKET_SECONDS;
}

function applyConfig(config) {
  defaults = config.defaults ?? null;
  constraints = config.constraints ?? null;
  bucketSeconds = resolveBucketSeconds();
  applyDefaults();
}

async function fetchDefaults() {
  const endpoints = ['config', 'config.json'];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        continue;
      }
      const data = await response.json();
      applyConfig(data);
      return;
    } catch (error) {
      console.warn(`Failed to load defaults from ${endpoint}`, error);
    }
  }

  console.warn('Falling back to built-in defaults.');
  applyConfig(getDefaultConfig());
}

function applyDefaults() {
  if (!defaults) {
    return;
  }
  form.reset();
  document.getElementById('start-gold').value = defaults.start_gold;
  minShopGoldInput.value = defaults.min_shop_gold;
  document.getElementById('final-target').value = defaults.final_target;
  document.getElementById('thresholds').value = defaults.armor_thresholds.join(', ');
  document.getElementById('nights').value = defaults.nights_to_sleep;
  document.getElementById('two-sleep-threshold').value =
    defaults.two_sleep_item_threshold ?? '';
  document.getElementById('one-sleep-threshold').value =
    defaults.one_sleep_item_threshold ?? '';
  document.getElementById('runs').value = defaults.runs;
  document.getElementById('trip-cutoff').value = defaults.additional_trip_cutoff ?? '';
  document.getElementById('seed').value = defaults.seed ?? '';
  useFarShopInput.checked = Boolean(defaults.use_far_shop);
  if (constraints) {
    thresholdHint.textContent =
      `Valid armor thresholds: ${constraints.min_threshold} – ${constraints.max_threshold} (inclusive). ` +
      `Time buckets are ${formatDuration(bucketSeconds)} each.`;
  } else {
    thresholdHint.textContent = '';
  }
  clearStatus();
  resultsEl.innerHTML = '';
  enforceMinShopGoldRequirement({ adjustValue: true });
}

function computeRequiredMinShopGold() {
  const cheapestItemCost = useFarShopInput.checked
    ? REQUIRED_FAR_ITEM_COST
    : REQUIRED_NEAR_ITEM_COST;
  return REQUIRED_SHOP_PURCHASE_GOLD + REQUIRED_WING_COST + cheapestItemCost;
}

function enforceMinShopGoldRequirement({ adjustValue = false } = {}) {
  const requiredValue = computeRequiredMinShopGold();
  const currentValue = Number.parseInt(minShopGoldInput.value, 10);

  minShopGoldInput.title = `Taloon needs ${requiredValue.toLocaleString()} gold before buying the shop with the current shop selection.`;

  if (adjustValue && (Number.isNaN(currentValue) || currentValue !== requiredValue)) {
    minShopGoldInput.value = requiredValue;
  }

  if (Number.isNaN(currentValue)) {
    minShopGoldInput.setCustomValidity('Enter the required minimum gold before buying the shop.');
  } else if (currentValue !== requiredValue) {
    minShopGoldInput.setCustomValidity(
      `Minimum gold must be exactly ${requiredValue.toLocaleString()} based on your shop selection.`
    );
  } else {
    minShopGoldInput.setCustomValidity('');
  }

}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function clearStatus() {
  statusEl.textContent = '';
  statusEl.classList.remove('error');
}

function parseThresholds(raw) {
  if (!raw.trim()) {
    throw new Error('Provide at least one armor offer threshold.');
  }
  const min = constraints?.min_threshold ?? 0;
  const max = constraints?.max_threshold ?? Number.MAX_SAFE_INTEGER;
  const thresholds = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const value = Number.parseInt(part, 10);
      if (Number.isNaN(value)) {
        throw new Error('Armor thresholds must be integers.');
      }
      if (value < min || value > max) {
        throw new Error(`Armor thresholds must be between ${min} and ${max}.`);
      }
      return value;
    });
  if (thresholds.length === 0) {
    throw new Error('Provide at least one armor offer threshold.');
  }
  return thresholds;
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const numeric = Number.parseInt(value, 10);
  if (Number.isNaN(numeric)) {
    throw new Error('Optional numeric fields must be integers if provided.');
  }
  return numeric;
}

function disableForm(disabled) {
  runButton.disabled = disabled;
  form.querySelectorAll('input').forEach((input) => {
    input.disabled = disabled;
  });
  resetButton.disabled = disabled;
}

function buildHistogram(bucketCounts) {
  const entries = bucketCounts;
  if (!entries.length) {
    return document.createTextNode('No simulations recorded.');
  }
  const maxCount = entries.reduce((max, entry) => Math.max(max, entry.count), 0);
  const container = document.createElement('div');
  container.className = 'histogram';
  entries.forEach(({ label, count }) => {
    const row = document.createElement('div');
    row.className = 'histogram-row';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'label';
    labelSpan.textContent = label;
    row.appendChild(labelSpan);

    const barTrack = document.createElement('div');
    barTrack.className = 'bar-track';
    const barFill = document.createElement('div');
    barFill.className = 'bar-fill';
    const rawWidth = maxCount === 0 ? 0 : (count / maxCount) * 100;
    const width = count === 0 ? 0 : Math.max(rawWidth, 6);
    barFill.style.width = `${width}%`;
    if (count === 0) {
      barTrack.classList.add('empty');
      barFill.classList.add('empty');
    }
    barTrack.title = `${labelSpan.textContent}: ${count} run(s)`;
    barTrack.appendChild(barFill);
    row.appendChild(barTrack);

    const countSpan = document.createElement('span');
    countSpan.className = 'value';
    countSpan.textContent = count;
    row.appendChild(countSpan);

    container.appendChild(row);
  });
  return container;
}

minShopGoldInput.addEventListener('input', () => {
  enforceMinShopGoldRequirement();
});

minShopGoldInput.addEventListener('change', () => {
  enforceMinShopGoldRequirement();
});

useFarShopInput.addEventListener('change', () => {
  enforceMinShopGoldRequirement({ adjustValue: true });
  minShopGoldInput.reportValidity();
});

function createMetricRow(label, valueText, titleText) {
  const row = document.createElement('span');
  if (titleText) {
    row.title = titleText;
  }

  const labelStrong = document.createElement('strong');
  labelStrong.textContent = `${label}:`;
  row.appendChild(labelStrong);

  const valueSpan = document.createElement('span');
  valueSpan.textContent = valueText;
  row.appendChild(valueSpan);

  return row;
}

function renderSummaries(summaries) {
  resultsEl.innerHTML = '';
  if (!summaries.length) {
    const emptyState = document.createElement('p');
    emptyState.textContent = 'No results to display yet. Run the simulation above.';
    resultsEl.appendChild(emptyState);
    return;
  }

  const topAverageSummaries = [...summaries]
    .sort((a, b) => a.average_time - b.average_time)
    .slice(0, 3);

  if (topAverageSummaries.length) {
    const highlight = document.createElement('div');
    highlight.className = 'results-overview';

    const heading = document.createElement('h3');
    heading.textContent = 'Top thresholds by average completion time';
    highlight.appendChild(heading);

    const list = document.createElement('ol');
    list.className = 'results-ranking';

    topAverageSummaries.forEach((summary) => {
      const listItem = document.createElement('li');

      const thresholdLabel = document.createElement('strong');
      thresholdLabel.textContent = `Threshold ${summary.threshold}`;
      listItem.appendChild(thresholdLabel);

      const stats = document.createElement('span');
      stats.textContent = `Average ${formatDuration(summary.average_time)} (σ ${formatDuration(
        summary.std_dev_time
      )})`;
      listItem.appendChild(stats);

      listItem.title =
        'Thresholds ranked by quickest average completion time, including their standard deviation across all runs.';
      list.appendChild(listItem);
    });

    highlight.appendChild(list);

    resultsEl.appendChild(highlight);
  }

  summaries.forEach((summary) => {
    const card = document.createElement('article');
    card.className = 'summary-card';

    const title = document.createElement('h3');
    title.textContent = `Threshold ${summary.threshold}`;
    card.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'summary-grid';

    const timeRow = createMetricRow(
      'Average time',
      `${formatDuration(summary.average_time)} (σ ${formatDuration(summary.std_dev_time)})`,
      `Average in-game seconds required to finish each simulation. The σ value is the standard deviation across runs. (~${summary.average_time.toFixed(2)}s; σ ${summary.std_dev_time.toFixed(2)}s)`
    );
    grid.appendChild(timeRow);

    const restockRow = createMetricRow(
      'Iron-plate restock cycles',
      summary.average_armor_restock_cycles.toFixed(2),
      'Average number of times Taloon refills iron plates before buying the shop.'
    );
    grid.appendChild(restockRow);

    const shopLoopsRow = createMetricRow(
      'Shop profit loops',
      `${summary.average_shop_cycles.toFixed(2)} cycles (≈ ${summary.average_shop_trips.toFixed(2)} trips; ${summary.average_shop_trips_per_cycle.toFixed(2)} trips/loop)`,
      'Each loop collects sales, purchases new stock, and lets Neta sell items. Trips show how often Taloon returns to the shop within those loops.'
    );
    grid.appendChild(shopLoopsRow);

    card.appendChild(grid);

    const details = document.createElement('details');
    const summaryEl = document.createElement('summary');
    summaryEl.textContent = `Time distribution (${formatDuration(
      bucketSeconds
    )} buckets)`;
    summaryEl.title = 'Histogram grouping completion times into 30-second intervals.';
    details.appendChild(summaryEl);
    details.appendChild(buildHistogram(summary.bucket_counts));
    card.appendChild(details);

    resultsEl.appendChild(card);
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearStatus();
  if (!form.reportValidity()) {
    setStatus('Please correct the highlighted fields before running the simulation.', true);
    return;
  }
  disableForm(true);
  setStatus('Running simulations…');

  try {
    const manualSeed = parseOptionalNumber(document.getElementById('seed').value);
    const resolvedSeed = manualSeed ?? generateRandomSeed();

    const payload = {
      start_gold: Number.parseInt(document.getElementById('start-gold').value, 10),
      min_shop_gold: Number.parseInt(minShopGoldInput.value, 10),
      final_target: Number.parseInt(document.getElementById('final-target').value, 10),
      armor_thresholds: parseThresholds(document.getElementById('thresholds').value),
      nights_to_sleep: Number.parseInt(document.getElementById('nights').value, 10),
      two_sleep_item_threshold: parseOptionalNumber(
        document.getElementById('two-sleep-threshold').value
      ),
      one_sleep_item_threshold: parseOptionalNumber(
        document.getElementById('one-sleep-threshold').value
      ),
      runs: Number.parseInt(document.getElementById('runs').value, 10),
      additional_trip_cutoff: parseOptionalNumber(document.getElementById('trip-cutoff').value),
      seed: resolvedSeed,
      use_far_shop: useFarShopInput.checked,
      time_bucket_seconds: bucketSeconds,
    };

    const result = runSimulation(payload);

    renderSummaries(result?.summaries ?? []);
    setStatus(
      `Completed ${payload.runs} run(s) for ${payload.armor_thresholds.length} threshold option(s) using seed ${result?.seed ?? resolvedSeed}.`
    );
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Simulation failed.', true);
  } finally {
    disableForm(false);
  }
});

resetButton.addEventListener('click', (event) => {
  event.preventDefault();
  applyDefaults();
});

fetchDefaults().catch((error) => {
  console.error(error);
  setStatus(error.message || 'Unable to load defaults.', true);
});
