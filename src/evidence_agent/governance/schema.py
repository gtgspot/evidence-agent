from __future__ import annotations

import sqlite3

_SCHEMA = """
CREATE TABLE IF NOT EXISTS custody_events (
    id          TEXT PRIMARY KEY,
    artefact_id TEXT NOT NULL REFERENCES artefacts(id),
    event       TEXT NOT NULL,
    actor       TEXT NOT NULL,
    timestamp   TEXT NOT NULL,
    note        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_custody_artefact ON custody_events(artefact_id);
CREATE TABLE IF NOT EXISTS linked_issues (
    artefact_id TEXT NOT NULL REFERENCES artefacts(id),
    issue_ref   TEXT NOT NULL,
    PRIMARY KEY (artefact_id, issue_ref)
);
"""


def init_governance_schema(conn: sqlite3.Connection) -> None:
    """Create the governance-owned tables (append-only custody + linked issues)."""
    conn.executescript(_SCHEMA)
    conn.commit()
