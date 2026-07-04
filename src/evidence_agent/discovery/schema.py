from __future__ import annotations

import sqlite3

_SCHEMA = """
CREATE TABLE IF NOT EXISTS discovery_requests (
    request_id       TEXT PRIMARY KEY,
    matter_id        TEXT NOT NULL,
    date_requested   TEXT NOT NULL,
    due_date         TEXT NOT NULL,
    legal_basis      TEXT NOT NULL,
    item_sought      TEXT NOT NULL,
    response_date    TEXT,
    result           TEXT NOT NULL,
    outstanding      INTEGER NOT NULL DEFAULT 1,
    prejudice_impact TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_disc_req_matter ON discovery_requests(matter_id);

CREATE TABLE IF NOT EXISTS receipt_checks (
    receipt_id         TEXT PRIMARY KEY,
    matter_id          TEXT NOT NULL,
    request_id         TEXT NOT NULL REFERENCES discovery_requests(request_id),
    expected_sha256    TEXT NOT NULL,
    computed_sha256    TEXT NOT NULL,
    file_integrity     INTEGER NOT NULL,
    completeness       INTEGER NOT NULL,
    redactions_present INTEGER NOT NULL,
    answers_request    INTEGER NOT NULL,
    answers_note       TEXT NOT NULL DEFAULT '',
    created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_receipt_request ON receipt_checks(request_id);

CREATE TABLE IF NOT EXISTS redaction_schedule (
    redaction_id         TEXT PRIMARY KEY,
    matter_id            TEXT NOT NULL,
    request_id           TEXT NOT NULL REFERENCES discovery_requests(request_id),
    timestamp_range      TEXT NOT NULL,
    content_type_removed TEXT NOT NULL,
    asserted_basis       TEXT NOT NULL,
    authoriser           TEXT NOT NULL,
    challenge_status     TEXT NOT NULL DEFAULT 'Unchallenged',
    created_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_redaction_matter ON redaction_schedule(matter_id);
"""


def init_discovery_schema(conn: sqlite3.Connection) -> None:
    """Create the discovery tables (idempotent). Does not touch core tables."""
    conn.executescript(_SCHEMA)
    conn.commit()
