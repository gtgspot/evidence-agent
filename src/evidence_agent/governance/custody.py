from __future__ import annotations

import sqlite3
from dataclasses import dataclass

from evidence_agent.core import get_artefact, new_id, sha256_file


@dataclass(frozen=True)
class CustodyEvent:
    id: str
    artefact_id: str
    event: str
    actor: str
    timestamp: str
    note: str


def record_custody_event(
    conn: sqlite3.Connection,
    artefact_id: str,
    event: str,
    actor: str,
    timestamp: str,
    note: str = "",
) -> CustodyEvent:
    """Append a chain-of-custody event (append-only; timestamp is caller-supplied)."""
    cid = new_id(conn, "CUS")
    conn.execute(
        "INSERT INTO custody_events(id, artefact_id, event, actor, timestamp, note) "
        "VALUES(?,?,?,?,?,?)",
        (cid, artefact_id, event, actor, timestamp, note),
    )
    conn.commit()
    return CustodyEvent(cid, artefact_id, event, actor, timestamp, note)


def list_custody(conn: sqlite3.Connection, artefact_id: str) -> list[CustodyEvent]:
    rows = conn.execute(
        "SELECT id, artefact_id, event, actor, timestamp, note "
        "FROM custody_events WHERE artefact_id = ? ORDER BY id",
        (artefact_id,),
    ).fetchall()
    return [
        CustodyEvent(r["id"], r["artefact_id"], r["event"], r["actor"],
                     r["timestamp"], r["note"])
        for r in rows
    ]


def verify_integrity(conn: sqlite3.Connection, artefact_id: str) -> bool:
    """Re-hash the file on disk and compare to the stored Artefact.sha256."""
    art = get_artefact(conn, artefact_id)
    if art is None:
        raise KeyError(artefact_id)
    return sha256_file(art.path) == art.sha256


def link_issue(conn: sqlite3.Connection, artefact_id: str, issue_ref: str) -> None:
    """Link an artefact to an issue reference (idempotent)."""
    conn.execute(
        "INSERT OR IGNORE INTO linked_issues(artefact_id, issue_ref) VALUES(?, ?)",
        (artefact_id, issue_ref),
    )
    conn.commit()


def list_linked_issues(conn: sqlite3.Connection, artefact_id: str) -> list[str]:
    rows = conn.execute(
        "SELECT issue_ref FROM linked_issues WHERE artefact_id = ? ORDER BY issue_ref",
        (artefact_id,),
    ).fetchall()
    return [r["issue_ref"] for r in rows]
