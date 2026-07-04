from __future__ import annotations

import sqlite3

from evidence_agent.core import new_id


def record_decision(
    conn: sqlite3.Connection,
    node_id: str,
    old_confidence: float,
    new_confidence: float,
    trigger_evidence: str,
    reason: str,
    timestamp: str,
    actor: str,
) -> str:
    """Append one immutable decision-log row. Confidence updates ONLY when new
    evidence lands, so an empty `trigger_evidence` is rejected. `timestamp` and
    `actor` are passed in for deterministic tests."""
    if not trigger_evidence:
        raise ValueError("confidence may change only when new evidence lands")
    did = new_id(conn, "DEC")
    conn.execute(
        "INSERT INTO decision_log(id, node_id, old_confidence, new_confidence, "
        "trigger_evidence, reason, timestamp, actor) VALUES(?,?,?,?,?,?,?,?)",
        (did, node_id, old_confidence, new_confidence, trigger_evidence,
         reason, timestamp, actor),
    )
    conn.commit()
    return did


def list_decisions(conn: sqlite3.Connection, node_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM decision_log WHERE node_id = ? ORDER BY id", (node_id,)
    ).fetchall()
    return [dict(r) for r in rows]
