from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import date

from evidence_agent.discovery.register import OutcomeState, list_requests
from evidence_agent.discovery.receipt import list_receipts, receipt_ok

# result -> (reason label, priority); lower priority number = more urgent.
_DEFICIENT_RESULTS = {
    OutcomeState.REFUSED: ("REFUSED", 2),
    OutcomeState.PARTIALLY_PRODUCED: ("PARTIALLY_PRODUCED", 3),
}


@dataclass(frozen=True)
class EscalationItem:
    request_id: str
    reason: str
    priority: int
    detail: str


def build_escalation_queue(
    conn: sqlite3.Connection, matter_id: str, today: str
) -> list[EscalationItem]:
    """Ranked queue of OVERDUE and DEFICIENT requests. Pure and deterministic
    given `today` (ISO date, e.g. '2026-03-01'); never calls datetime.now()."""
    items: list[EscalationItem] = []
    for req in list_requests(conn, matter_id):
        candidates: list[tuple[str, int, str]] = []

        # OVERDUE: still awaiting a response, past the due date.
        if (
            req.result is OutcomeState.NO_RESPONSE
            and req.due_date
            and today > req.due_date
        ):
            days = (date.fromisoformat(today) - date.fromisoformat(req.due_date)).days
            candidates.append(
                ("OVERDUE", 1, f"No response {days} day(s) past due date {req.due_date}")
            )

        # DEFICIENT: refused or only partially produced.
        if req.result in _DEFICIENT_RESULTS:
            reason, priority = _DEFICIENT_RESULTS[req.result]
            candidates.append(
                (reason, priority, f"Result recorded as {req.result.value}")
            )

        # DEFICIENT: a receipt check failed (e.g. integrity/completeness/off-point).
        failed = [r for r in list_receipts(conn, req.request_id) if not receipt_ok(r)]
        if failed:
            candidates.append(
                ("FAILED_RECEIPT", 2, f"{len(failed)} failed receipt check(s)")
            )

        if not candidates:
            continue
        # Pick the most urgent reason (lowest priority, then label for stability).
        reason, priority, detail = min(candidates, key=lambda c: (c[1], c[0]))
        items.append(EscalationItem(req.request_id, reason, priority, detail))

    items.sort(key=lambda i: (i.priority, i.request_id))
    return items
