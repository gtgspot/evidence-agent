from __future__ import annotations

import sqlite3

_SCHEMA = """
CREATE TABLE IF NOT EXISTS hypothesis_nodes (
    id                      TEXT PRIMARY KEY,
    matter_id               TEXT NOT NULL,
    claim                   TEXT NOT NULL,
    required_legal_elements TEXT NOT NULL DEFAULT '[]',
    supporting_artefacts    TEXT NOT NULL DEFAULT '[]',
    contrary_artefacts      TEXT NOT NULL DEFAULT '[]',
    unknowns                TEXT NOT NULL DEFAULT '[]',
    next_test               TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS chain_views (
    id         TEXT PRIMARY KEY,
    node_id    TEXT NOT NULL REFERENCES hypothesis_nodes(id),
    chain      TEXT NOT NULL,
    position   TEXT NOT NULL,
    relied_on  TEXT NOT NULL DEFAULT '[]',
    weaknesses TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS ix_chain_views_node ON chain_views(node_id);
CREATE TABLE IF NOT EXISTS decision_log (
    id               TEXT PRIMARY KEY,
    node_id          TEXT NOT NULL REFERENCES hypothesis_nodes(id),
    old_confidence   REAL NOT NULL,
    new_confidence   REAL NOT NULL,
    trigger_evidence TEXT NOT NULL,
    reason           TEXT NOT NULL,
    timestamp        TEXT NOT NULL,
    actor            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_decision_log_node ON decision_log(node_id);
"""


def init_reasoning_schema(conn: sqlite3.Connection) -> None:
    """Create the reasoning tables. Idempotent; never touches core tables."""
    conn.executescript(_SCHEMA)
    conn.commit()
