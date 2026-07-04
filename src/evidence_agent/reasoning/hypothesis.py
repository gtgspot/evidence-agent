from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass

from evidence_agent.core import new_id


@dataclass(frozen=True)
class HypothesisNode:
    id: str
    matter_id: str
    claim: str
    required_legal_elements: list
    supporting_artefacts: list
    contrary_artefacts: list
    unknowns: list
    next_test: str


def _row_to_node(row: sqlite3.Row) -> HypothesisNode:
    return HypothesisNode(
        id=row["id"],
        matter_id=row["matter_id"],
        claim=row["claim"],
        required_legal_elements=json.loads(row["required_legal_elements"]),
        supporting_artefacts=json.loads(row["supporting_artefacts"]),
        contrary_artefacts=json.loads(row["contrary_artefacts"]),
        unknowns=json.loads(row["unknowns"]),
        next_test=row["next_test"],
    )


def add_node(
    conn: sqlite3.Connection,
    matter_id: str,
    claim: str,
    required_legal_elements: list,
    supporting_artefacts: list,
    contrary_artefacts: list,
    unknowns: list,
    next_test: str,
) -> HypothesisNode:
    nid = new_id(conn, "HYP")
    conn.execute(
        "INSERT INTO hypothesis_nodes(id, matter_id, claim, required_legal_elements, "
        "supporting_artefacts, contrary_artefacts, unknowns, next_test) "
        "VALUES(?,?,?,?,?,?,?,?)",
        (
            nid, matter_id, claim,
            json.dumps(required_legal_elements),
            json.dumps(supporting_artefacts),
            json.dumps(contrary_artefacts),
            json.dumps(unknowns),
            next_test,
        ),
    )
    conn.commit()
    return get_node(conn, nid)


def get_node(conn: sqlite3.Connection, node_id: str) -> HypothesisNode | None:
    row = conn.execute(
        "SELECT * FROM hypothesis_nodes WHERE id = ?", (node_id,)
    ).fetchone()
    return _row_to_node(row) if row else None


def list_nodes(conn: sqlite3.Connection, matter_id: str) -> list[HypothesisNode]:
    rows = conn.execute(
        "SELECT * FROM hypothesis_nodes WHERE matter_id = ? ORDER BY id",
        (matter_id,),
    ).fetchall()
    return [_row_to_node(r) for r in rows]
