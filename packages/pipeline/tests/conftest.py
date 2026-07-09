"""Shared test setup.

Resets the public schema once per session so the integration tests (which
apply migrations with plain CREATE) are re-runnable against the same
TEST_DATABASE_URL. No-op when the database isn't configured.
"""
import os
import subprocess

import pytest

DSN = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture(scope="session", autouse=True)
def _reset_schema():
    if DSN:
        subprocess.run(
            ["psql", DSN, "-v", "ON_ERROR_STOP=1", "-q", "-c",
             "drop schema if exists public cascade; create schema public;"],
            check=True,
        )
    yield
