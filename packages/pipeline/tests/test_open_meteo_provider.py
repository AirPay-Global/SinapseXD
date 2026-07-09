"""Unit tests for the Open-Meteo provider normaliser — no DB/network required."""
from __future__ import annotations

import sys
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_ROOT))

from ingestors.providers.open_meteo import OpenMeteoProvider  # noqa: E402


def test_normalise_converts_windspeed_and_flags_risk():
    raw = {
        "port": {"id": "durban", "name": "Durban", "lat": -29.87, "lng": 31.03},
        "marine": {"current": {"wave_height": 1.1, "wind_wave_height": 0.5}},
        "forecast": {"current_weather": {"windspeed": 20.0, "time": "2026-07-09T10:00"}},
    }
    rec = OpenMeteoProvider.normalise(raw)
    assert rec["portId"] == "durban"
    assert rec["waveHeightM"] == 1.1
    assert rec["windSpeedKn"] == round(20.0 * 0.539957, 1)
    assert rec["disruptionRisk"] == "normal"
    assert rec["tsIso"] == "2026-07-09T10:00"


def test_normalise_flags_elevated_on_high_wind():
    raw = {
        "port": {"id": "lome", "name": "Lome", "lat": 6.13, "lng": 1.29},
        "marine": {"current": {"wave_height": 0.5}},
        "forecast": {"current_weather": {"windspeed": 60.0, "time": "2026-07-09T11:00"}},
    }
    rec = OpenMeteoProvider.normalise(raw)
    assert rec["disruptionRisk"] == "elevated"  # ~32kn > 25kn threshold


def test_normalise_defaults_on_missing_sections():
    rec = OpenMeteoProvider.normalise({"port": {"id": "tema", "lat": 5.63, "lng": 0.01}, "marine": {}, "forecast": {}})
    assert rec["waveHeightM"] == 0.0
    assert rec["windSpeedKn"] == 0.0
    assert rec["disruptionRisk"] == "normal"
