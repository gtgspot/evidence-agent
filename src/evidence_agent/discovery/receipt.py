from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from evidence_agent.core import new_id, sha256_file


@dataclass(frozen=True)
class ReceiptCheck:
    receipt_id: str
    matter_id: str
    request_id: str
    expected_sha256: str
    computed_sha256: str
    file_integrity: bool
    completeness: bool
    redactions_present: bool
    answers_request: bool
    answers_note: str
    created_at: str


def _row_to_receipt(row: sqlite3.Row) -> ReceiptCheck:
    return ReceiptCheck(
        receipt_id=row["receipt_id"],
        matter_id=row["matter_id"],
        request_id=row["request_id"],
        expected_sha256=row["expected_sha256"],
        computed_sha256=row["computed_sha256"],
        file_integrity=bool(row["file_integrity"]),
        completeness=bool(row["completeness"]),
        redactions_present=bool(row["redactions_present"]),
        answers_request=bool(row["answers_request"]),
        answers_note=row["answers_note"],
        created_at=row["created_at"],
    )


def record_receipt(
    conn: sqlite3.Connection, matter_id: str, request_id: str,
    produced_path: str | Path, expected_sha256: str, *,
    completeness: bool, redactions_present: bool, answers_request: bool,
    answers_note: str = "",
) -> ReceiptCheck:
    """Check a single production: hash the produced file (core sha256_file) and
    compare to the expected hash for file_integrity; record all four checks."""
    computed = sha256_file(produced_path)
    file_integrity = computed == expected_sha256
    receipt_id = new_id(conn, "RCP")
    created_at = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO receipt_checks(receipt_id, matter_id, request_id, "
        "expected_sha256, computed_sha256, file_integrity, completeness, "
        "redactions_present, answers_request, answers_note, created_at) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        (receipt_id, matter_id, request_id, expected_sha256, computed,
         int(file_integrity), int(completeness), int(redactions_present),
         int(answers_request), answers_note, created_at),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM receipt_checks WHERE receipt_id = ?", (receipt_id,)
    ).fetchone()
    return _row_to_receipt(row)


def receipt_ok(rc: ReceiptCheck) -> bool:
    """A production passes receipt iff it is complete, intact, and on-point.
    (redactions_present is informational and does not, alone, fail the check.)"""
    return rc.completeness and rc.file_integrity and rc.answers_request


def list_receipts(conn: sqlite3.Connection, request_id: str) -> list[ReceiptCheck]:
    rows = conn.execute(
        "SELECT * FROM receipt_checks WHERE request_id = ? ORDER BY receipt_id",
        (request_id,),
    ).fetchall()
    return [_row_to_receipt(r) for r in rows]
