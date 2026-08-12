"""Shared test setup.

Resets the public schema before each test module so the integration tests
(which apply migrations with plain CREATE) are re-runnable against the same
TEST_DATABASE_URL, and different modules that apply different migration
subsets never collide over tables/functions the previous module already
created. No-op when the database isn't configured.
"""
import os
import subprocess

import pytest

DSN = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture(scope="module", autouse=True)
def _reset_schema():
    if DSN:
        subprocess.run(
            ["psql", DSN, "-v", "ON_ERROR_STOP=1", "-q", "-c",
             "drop schema if exists public cascade; create schema public;"],
            check=True,
        )
    yield
