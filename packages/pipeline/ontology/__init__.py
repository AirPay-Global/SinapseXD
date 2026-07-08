"""Ontology resolution for the pipeline.

Maps a data product's native identifiers (PortWatch portid/portname, AIS
destination strings, ISO3 country codes) to canonical ontology object ids, so
Silver records are ontology-keyed and cross-referenceable (Master Build Plan
v2, Principle #1). Mirrors the seed in supabase/migrations/0002_ontology_core.sql;
a DB-backed resolver replaces the static registry once Supabase is provisioned.
"""
from .resolver import (
    resolve_commodity,
    resolve_country,
    resolve_port,
)

__all__ = ["resolve_country", "resolve_port", "resolve_commodity"]
