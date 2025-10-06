"""Minimal web server and UI for exploring Taloon simulation results."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from http import HTTPStatus
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Any, Dict, Optional, Sequence

from . import constants as const
from .simulation import SimulationConfig, TaloonSimulation

WEB_DIR = Path(__file__).resolve().parent.parent


class TaloonRequestHandler(SimpleHTTPRequestHandler):
    """Serve the static UI and expose an API endpoint for simulations."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def do_GET(self) -> None:  # noqa: N802 - required by SimpleHTTPRequestHandler
        if self.path == "/config":
            self._handle_config()
            return

        if self.path in {"", "/"}:
            self.path = "/index.html"

        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802 - required by SimpleHTTPRequestHandler
        if self.path == "/simulate":
            self._handle_simulate()
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Unsupported endpoint")

    # ------------------------------------------------------------------
    # Endpoint handlers
    # ------------------------------------------------------------------
    def _handle_config(self) -> None:
        payload = {
            "defaults": {
                "start_gold": const.DEFAULT_START_GOLD,
                "final_target": const.DEFAULT_FINAL_TARGET,
                "min_shop_gold": const.DEFAULT_MIN_SHOP_GOLD,
                "use_far_shop": False,
                "nights_to_sleep": const.DEFAULT_SLEEP_NIGHTS,
                "runs": const.DEFAULT_SIMULATION_RUNS,
                "armor_thresholds": list(const.DEFAULT_ARMOR_THRESHOLDS),
                "additional_trip_cutoff": None,
                "seed": None,
            },
            "constraints": {
                "min_threshold": min(const.ARMOR_BUY_PRICES),
                "max_threshold": max(const.ARMOR_BUY_PRICES),
                "time_bucket_seconds": const.TIME_BUCKET_SECONDS,
            },
        }
        self._send_json(HTTPStatus.OK, payload)

    def _handle_simulate(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        try:
            raw_body = self.rfile.read(length).decode("utf-8") if length else "{}"
            payload = json.loads(raw_body)
            config = build_config_from_payload(payload)
            simulation = TaloonSimulation(config)
            summaries = simulation.run()
            response = {
                "summaries": [
                    {
                        **asdict(summary),
                        "bucket_counts": [
                            {"label": label, "count": count}
                            for label, count in summary.bucket_counts.items()
                        ],
                    }
                    for summary in summaries
                ]
            }
            self._send_json(HTTPStatus.OK, response)
        except ValueError as exc:  # validation issue
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
        except json.JSONDecodeError:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Invalid JSON payload."})
        except Exception as exc:  # pragma: no cover - defensive
            self.log_error("Unexpected error while running simulation: %s", exc)
            self._send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "Simulation failed due to an unexpected server error."},
            )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _send_json(self, status: HTTPStatus, payload: Dict[str, Any]) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def build_config_from_payload(payload: Dict[str, Any]) -> SimulationConfig:
    """Validate incoming payload data and build a SimulationConfig."""

    def require_positive(value: Any, field: str) -> int:
        try:
            numeric = int(value)
        except (TypeError, ValueError) as exc:  # pragma: no cover - defensive
            raise ValueError(f"{field} must be an integer.") from exc
        if numeric <= 0:
            raise ValueError(f"{field} must be positive.")
        return numeric

    start_gold = require_positive(payload.get("start_gold", const.DEFAULT_START_GOLD), "Start gold")
    final_target = require_positive(payload.get("final_target", const.DEFAULT_FINAL_TARGET), "Final target")
    min_shop_gold = require_positive(payload.get("min_shop_gold", const.DEFAULT_MIN_SHOP_GOLD), "Minimum shop gold")
    nights_to_sleep = require_positive(payload.get("nights_to_sleep", const.DEFAULT_SLEEP_NIGHTS), "Nights to sleep")
    runs = require_positive(payload.get("runs", const.DEFAULT_SIMULATION_RUNS), "Runs")

    thresholds_raw = payload.get("armor_thresholds", list(const.DEFAULT_ARMOR_THRESHOLDS))
    if not isinstance(thresholds_raw, Sequence) or isinstance(thresholds_raw, (str, bytes)):
        raise ValueError("Armor thresholds must be provided as a list of integers.")
    thresholds: list[int] = []
    min_threshold = min(const.ARMOR_BUY_PRICES)
    max_threshold = max(const.ARMOR_BUY_PRICES)
    for value in thresholds_raw:
        try:
            threshold = int(value)
        except (TypeError, ValueError) as exc:
            raise ValueError("Armor thresholds must contain only integers.") from exc
        if threshold < min_threshold or threshold > max_threshold:
            raise ValueError(
                f"Armor thresholds must fall between {min_threshold} and {max_threshold}."
            )
        thresholds.append(threshold)
    if not thresholds:
        raise ValueError("At least one armor threshold must be provided.")

    additional_trip_cutoff = payload.get("additional_trip_cutoff")
    if additional_trip_cutoff is not None:
        try:
            additional_trip_cutoff = int(additional_trip_cutoff)
        except (TypeError, ValueError) as exc:
            raise ValueError("Additional trip cutoff must be an integer or null.") from exc
        if additional_trip_cutoff < 0:
            raise ValueError("Additional trip cutoff must be non-negative.")

    if min_shop_gold <= const.SHOP_PURCHASE_COST:
        raise ValueError("Minimum shop gold must exceed the cost of purchasing the shop.")

    seed_value = payload.get("seed")
    seed: Optional[int]
    if seed_value in (None, ""):
        seed = None
    else:
        try:
            seed = int(seed_value)
        except (TypeError, ValueError) as exc:
            raise ValueError("Seed must be an integer or null.") from exc

    use_far_shop = bool(payload.get("use_far_shop", False))

    return SimulationConfig(
        start_gold=start_gold,
        final_target=final_target,
        min_shop_gold=min_shop_gold,
        use_far_shop=use_far_shop,
        nights_to_sleep=nights_to_sleep,
        runs=runs,
        armor_thresholds=thresholds,
        additional_trip_cutoff=additional_trip_cutoff,
        seed=seed,
    )


def main(argv: Optional[Sequence[str]] = None) -> None:
    parser = argparse.ArgumentParser(description="Run the Taloon simulator web UI server.")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind (default: %(default)s).")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on (default: %(default)s).")
    args = parser.parse_args(argv)

    if not WEB_DIR.exists():
        raise RuntimeError(f"Web assets directory missing: {WEB_DIR}")

    server_address = (args.host, args.port)
    httpd = HTTPServer(server_address, TaloonRequestHandler)
    print(f"Serving Taloon simulator web UI on http://{args.host}:{args.port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:  # pragma: no cover - manual stop
        print("\nShutting down...")
    finally:
        httpd.server_close()


if __name__ == "__main__":  # pragma: no cover - script entry point
    main()
