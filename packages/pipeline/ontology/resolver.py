"""Source-native → canonical ontology resolution.

Static registry mirroring supabase/migrations/0002_ontology_core.sql. Keep the
two in sync until the resolver reads the crosswalk from Supabase directly.
Resolution is best-effort: an unknown id returns None (never guesses), and the
caller records the miss so the crosswalk can be extended.
"""
from __future__ import annotations

# ISO3 → country name (subset: pilot ports + corridor destinations).
_COUNTRIES: dict[str, str] = {
    "ZAF": "South Africa", "KEN": "Kenya", "NGA": "Nigeria", "TGO": "Togo",
    "DJI": "Djibouti", "TZA": "Tanzania", "GHA": "Ghana", "ZMB": "Zambia",
    "UGA": "Uganda", "RWA": "Rwanda", "ETH": "Ethiopia", "BFA": "Burkina Faso",
    "MLI": "Mali", "NER": "Niger",
}
_NAME_TO_ISO3: dict[str, str] = {name.lower(): iso for iso, name in _COUNTRIES.items()}

# Canonical ports: id → (name, iso3, alias strings seen in feeds).
_PORTS: dict[str, tuple[str, str, tuple[str, ...]]] = {
    "durban":   ("Durban", "ZAF", ("durban",)),
    "mombasa":  ("Mombasa", "KEN", ("mombasa",)),
    "lagos":    ("Lagos (Apapa)", "NGA", ("lagos", "apapa")),
    "lome":     ("Lomé", "TGO", ("lome", "lomé")),
    "djibouti": ("Djibouti", "DJI", ("djibouti",)),
    "dar":      ("Dar es Salaam", "TZA", ("dar es salaam", "dar")),
    "tema":     ("Tema", "GHA", ("tema",)),
}
# Reverse: normalized alias → canonical port id.
_PORT_ALIAS: dict[str, str] = {
    alias: pid for pid, (_n, _iso, aliases) in _PORTS.items() for alias in aliases
}

# PortWatch vessel-class field suffix → canonical commodity id.
_COMMODITY: dict[str, str] = {
    "container": "container",
    "dry_bulk": "dry_bulk",
    "tanker": "tanker",
    "roro": "roro",
    "general_cargo": "general_cargo",
}


def _norm(value: object) -> str:
    return str(value or "").strip().lower()


def resolve_country(value: object) -> str | None:
    """Accepts an ISO3 code or a country name; returns canonical ISO3 or None."""
    raw = str(value or "").strip()
    if raw.upper() in _COUNTRIES:
        return raw.upper()
    return _NAME_TO_ISO3.get(raw.lower())


def resolve_port(
    source: str,
    *,
    native_id: str | None = None,
    name: str | None = None,
    iso3: str | None = None,
) -> str | None:
    """Resolve a port to its canonical id.

    Tries, in order: a known native alias (e.g. an AIS destination string),
    then a (name, iso3) match against the canonical registry. Returns None on
    a miss so the caller can log it for crosswalk extension.
    """
    for candidate in (native_id, name):
        alias = _norm(candidate)
        if alias in _PORT_ALIAS:
            return _PORT_ALIAS[alias]
    if name:
        target_iso = resolve_country(iso3) if iso3 else None
        nm = _norm(name)
        for pid, (pname, piso, _aliases) in _PORTS.items():
            if _norm(pname) == nm and (target_iso is None or piso == target_iso):
                return pid
    return None


def resolve_commodity(field: object) -> str | None:
    """Map a PortWatch vessel-class field suffix to a canonical commodity id."""
    return _COMMODITY.get(_norm(field))
