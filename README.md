# Taloon Chapter 3 Money Simulator

This project provides a Monte Carlo simulator for Taloon's money-making phases in
*Dragon Warrior IV* Chapter 3. The simulator models both the iron plate sales to
the Endor armor merchant and the subsequent shop phase with Neta.

## Features

- Configurable starting and target gold amounts.
- Support for multiple armor offer acceptance thresholds in a single run.
- Phase two modelling of purchase trips, sleeping nights, and probabilistic sales.
- Optional use of the further shop and an additional trip cutoff before sleeping.
- Aggregated statistics and 15-second time bucket distributions for each
  threshold.

## Usage

Run the CLI with Python 3.11 or newer:

```bash
python -m taloon_sim.cli [options]
```

Key options:

- `--start-gold`: Gold Taloon has when the simulation begins (default 30000).
- `--min-shop-gold`: Gold required before purchasing the shop (default 35575).
- `--final-target`: Gold required after collecting profits from Neta (default 26000).
- `--thresholds`: Comma-separated list of armor merchant thresholds to
  simulate. Each run reports results for all thresholds.
- `--runs`: Number of Monte Carlo trials per threshold (default 1000).
- `--nights`: Nights Taloon sleeps before collecting shop profits (default 3).
- `--use-far-shop`: Allow trips to the further shop in phase two.
- `--additional-trip-cutoff`: If provided, allows Taloon to make one extra
  purchase trip before sleeping whenever he has at least this amount of gold
  remaining.
- `--seed`: Seed for deterministic simulations.

Example:

```bash
python -m taloon_sim.cli --runs 500 --thresholds 1600,1700,1800 --use-far-shop
```

### Web user interface

The web interface now runs entirely in the browser—no Python backend or custom
server is required. Open `index.html` from the repository (or deploy the
contents to a static host such as GitHub Pages) and configure simulations with
the form inputs. Results update inline, complete with aggregated metrics and the
15-second histogram buckets for each armor threshold.

## Project Structure

- `taloon_sim/constants.py`: All measured timing and cost constants.
- `taloon_sim/phase1.py`: Logic for Taloon's iron plate sales.
- `taloon_sim/phase2.py`: Logic for the shop phase with Neta.
- `taloon_sim/simulation.py`: Orchestrates Monte Carlo runs and aggregates results.
- `taloon_sim/cli.py`: Command line entry point.

## License

This project inherits the license distributed with the repository.
