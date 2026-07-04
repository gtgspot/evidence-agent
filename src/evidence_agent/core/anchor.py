from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone

from evidence_agent.core.ids import new_id

_KINDS = {"doc", "media"}


@dataclass(frozen=True)
class EvidenceAnchor:
    id: str
    matter_id: str
    artefact_id: str
    kind: str
    locator: str
    quote: str
    created_at: str


def add_anchor(
    conn: sqlite3.Connection, matter_id: str, artefact_id: str,
    kind: str, locator: str, quote: str = "",
) -> EvidenceAnchor:
    if kind not in _KINDS:
        raise ValueError(f"kind must be one of {_KINDS}, got {kind!r}")
    aid = new_id(conn, "ANC")
    created = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO evidence_anchors(id, matter_id, artefact_id, kind, locator, "
        "quote, created_at) VALUES(?,?,?,?,?,?,?)",
        (aid, matter_id, artefact_id, kind, locator, quote, created),
    )
    conn.commit()
    return EvidenceAnchor(aid, matter_id, artefact_id, kind, locator, quote, created)


def list_anchors(conn: sqlite3.Connection, artefact_id: str) -> list[EvidenceAnchor]:
    rows = conn.execute(
        "SELECT * FROM evidence_anchors WHERE artefact_id = ? ORDER BY id",
        (artefact_id,),
    ).fetchall()
    return [
        EvidenceAnchor(r["id"], r["matter_id"], r["artefact_id"], r["kind"],
                       r["locator"], r["quote"], r["created_at"])
        for r in rows
    ]
