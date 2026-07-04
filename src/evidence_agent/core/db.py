from __future__ import annotations

import sqlite3
from pathlib import Path

_SCHEMA = """
CREATE TABLE IF NOT EXISTS id_counters (
    prefix TEXT PRIMARY KEY,
    value  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS artefacts (
    id            TEXT PRIMARY KEY,
    matter_id     TEXT NOT NULL,
    cls           TEXT NOT NULL,
    source        TEXT NOT NULL,
    path          TEXT NOT NULL,
    sha256        TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    parent_id     TEXT REFERENCES artefacts(id),
    metadata      TEXT NOT NULL DEFAULT '{}',
    custody_notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_artefacts_matter ON artefacts(matter_id);
CREATE INDEX IF NOT EXISTS ix_artefacts_sha    ON artefacts(matter_id, sha256);
CREATE TABLE IF NOT EXISTS evidence_anchors (
    id          TEXT PRIMARY KEY,
    matter_id   TEXT NOT NULL,
    artefact_id TEXT NOT NULL REFERENCES artefacts(id),
    kind        TEXT NOT NULL,
    locator     TEXT NOT NULL,
    quote       TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_anchors_artefact ON evidence_anchors(artefact_id);
"""


def connect(path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(_SCHEMA)
    conn.commit()
