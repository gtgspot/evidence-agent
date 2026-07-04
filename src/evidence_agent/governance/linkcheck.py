from __future__ import annotations

import sqlite3
from dataclasses import dataclass

from evidence_agent.core import get_artefact


@dataclass(frozen=True)
class Claim:
    text: str
    anchor_ids: list[str]


def _anchor_matter(conn: sqlite3.Connection, anchor_id: str) -> str | None:
    row = conn.execute(
        "SELECT matter_id FROM evidence_anchors WHERE id = ?", (anchor_id,)
    ).fetchone()
    return row["matter_id"] if row else None


def check_claim_anchoring(
    conn: sqlite3.Connection,
    analysis_artefact_id: str,
    claims: list[Claim],
) -> list[Claim]:
    """Return the claims that are NOT properly anchored (empty list == compliant).

    A claim is compliant iff it declares at least one anchor_id and every declared
    anchor exists and belongs to the same matter as the analysis artefact.
    """
    analysis = get_artefact(conn, analysis_artefact_id)
    if analysis is None:
        raise KeyError(analysis_artefact_id)
    matter_id = analysis.matter_id
    unanchored: list[Claim] = []
    for claim in claims:
        ok = bool(claim.anchor_ids) and all(
            _anchor_matter(conn, aid) == matter_id for aid in claim.anchor_ids
        )
        if not ok:
            unanchored.append(claim)
    return unanchored
