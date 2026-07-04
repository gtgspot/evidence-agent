from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone

from evidence_agent.core import new_id


@dataclass(frozen=True)
class RedactionEntry:
    redaction_id: str
    matter_id: str
    request_id: str
    timestamp_range: str
    content_type_removed: str
    asserted_basis: str
    authoriser: str
    challenge_status: str
    created_at: str


def _row_to_redaction(row: sqlite3.Row) -> RedactionEntry:
    return RedactionEntry(
        redaction_id=row["redaction_id"],
        matter_id=row["matter_id"],
        request_id=row["request_id"],
        timestamp_range=row["timestamp_range"],
        content_type_removed=row["content_type_removed"],
        asserted_basis=row["asserted_basis"],
        authoriser=row["authoriser"],
        challenge_status=row["challenge_status"],
        created_at=row["created_at"],
    )


def add_redaction(
    conn: sqlite3.Connection, matter_id: str, request_id: str,
    timestamp_range: str, content_type_removed: str, asserted_basis: str,
    authoriser: str, *, challenge_status: str = "Unchallenged",
) -> RedactionEntry:
    """Record one redaction against a produced item."""
    redaction_id = new_id(conn, "RED")
    created_at = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO redaction_schedule(redaction_id, matter_id, request_id, "
        "timestamp_range, content_type_removed, asserted_basis, authoriser, "
        "challenge_status, created_at) VALUES(?,?,?,?,?,?,?,?,?)",
        (redaction_id, matter_id, request_id, timestamp_range, content_type_removed,
         asserted_basis, authoriser, challenge_status, created_at),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM redaction_schedule WHERE redaction_id = ?", (redaction_id,)
    ).fetchone()
    return _row_to_redaction(row)


def list_redactions(conn: sqlite3.Connection, matter_id: str) -> list[RedactionEntry]:
    rows = conn.execute(
        "SELECT * FROM redaction_schedule WHERE matter_id = ? ORDER BY redaction_id",
        (matter_id,),
    ).fetchall()
    return [_row_to_redaction(r) for r in rows]
