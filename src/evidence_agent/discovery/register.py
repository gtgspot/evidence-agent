from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from enum import Enum

from evidence_agent.core import new_id


class OutcomeState(Enum):
    PRODUCED = "Produced"
    PARTIALLY_PRODUCED = "Partially Produced"
    REFUSED = "Refused"
    NO_RESPONSE = "No Response"
    CLAIMED_NON_EXISTENCE = "Claimed Non-Existence"


@dataclass(frozen=True)
class DiscoveryRequest:
    request_id: str
    matter_id: str
    date_requested: str
    due_date: str
    legal_basis: str
    item_sought: str
    response_date: str | None
    result: OutcomeState
    outstanding: bool
    prejudice_impact: str


def _row_to_request(row: sqlite3.Row) -> DiscoveryRequest:
    return DiscoveryRequest(
        request_id=row["request_id"],
        matter_id=row["matter_id"],
        date_requested=row["date_requested"],
        due_date=row["due_date"],
        legal_basis=row["legal_basis"],
        item_sought=row["item_sought"],
        response_date=row["response_date"],
        result=OutcomeState(row["result"]),
        outstanding=bool(row["outstanding"]),
        prejudice_impact=row["prejudice_impact"],
    )


def add_request(
    conn: sqlite3.Connection, matter_id: str, date_requested: str, due_date: str,
    legal_basis: str, item_sought: str, *, prejudice_impact: str = "",
) -> DiscoveryRequest:
    """Register a new discovery request. Starts as No Response / outstanding."""
    request_id = new_id(conn, "REQ")
    conn.execute(
        "INSERT INTO discovery_requests(request_id, matter_id, date_requested, "
        "due_date, legal_basis, item_sought, response_date, result, outstanding, "
        "prejudice_impact) VALUES(?,?,?,?,?,?,?,?,?,?)",
        (request_id, matter_id, date_requested, due_date, legal_basis, item_sought,
         None, OutcomeState.NO_RESPONSE.value, 1, prejudice_impact),
    )
    conn.commit()
    return get_request(conn, request_id)


def get_request(conn: sqlite3.Connection, request_id: str) -> DiscoveryRequest | None:
    row = conn.execute(
        "SELECT * FROM discovery_requests WHERE request_id = ?", (request_id,)
    ).fetchone()
    return _row_to_request(row) if row else None


def list_requests(conn: sqlite3.Connection, matter_id: str) -> list[DiscoveryRequest]:
    rows = conn.execute(
        "SELECT * FROM discovery_requests WHERE matter_id = ? ORDER BY request_id",
        (matter_id,),
    ).fetchall()
    return [_row_to_request(r) for r in rows]
