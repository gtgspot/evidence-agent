"""One-shot schema initialiser for the whole matter subsystem.

Core is initialised FIRST: governance foreign-keys and reasoning's matrix builder
query the core `artefacts`/`evidence_anchors` tables, so they must exist before the
subsystem schemas are created. Callers outside the test suite should use this instead
of calling the individual `init_*_schema` functions in an ad-hoc order.
"""
from __future__ import annotations

import sqlite3

from evidence_agent.core import db
from evidence_agent.discovery.schema import init_discovery_schema
from evidence_agent.governance.schema import init_governance_schema
from evidence_agent.reasoning.schema import init_reasoning_schema


def init_all(conn: sqlite3.Connection) -> None:
    """Initialise the core schema then every subsystem schema (idempotent)."""
    db.init_schema(conn)
    init_discovery_schema(conn)
    init_governance_schema(conn)
    init_reasoning_schema(conn)
