from __future__ import annotations

import sqlite3
from pathlib import Path

from evidence_agent.core import ArtefactClass, Artefact, add_artefact, get_artefact


class LineageError(Exception):
    """Raised when an artefact violates the parent-id lineage / transition rules."""


# Governance policy: which child classes may derive from a given parent class.
ALLOWED_TRANSITIONS: dict[ArtefactClass, set[ArtefactClass]] = {
    ArtefactClass.ORIGINAL: {ArtefactClass.DERIVATIVE, ArtefactClass.ANALYSIS},
    ArtefactClass.DERIVATIVE: {
        ArtefactClass.DERIVATIVE,
        ArtefactClass.ANALYSIS,
        ArtefactClass.SUBMISSION_READY,
    },
    ArtefactClass.ANALYSIS: {ArtefactClass.ANALYSIS, ArtefactClass.SUBMISSION_READY},
    ArtefactClass.SUBMISSION_READY: {ArtefactClass.SUBMISSION_READY},
}


def governed_add(
    conn: sqlite3.Connection,
    matter_id: str,
    cls: ArtefactClass,
    source: str,
    path: str | Path,
    *,
    parent_id: str | None = None,
    metadata: dict | None = None,
    custody_notes: str = "",
    overwrite_target: str | None = None,
) -> Artefact:
    """Add an artefact under governance.

    Enforces the spec's lineage rule (any non-Original needs a parent_id) and the
    ALLOWED_TRANSITIONS policy, then delegates to core `add_artefact`, which raises
    `ImmutableOriginalError` if `overwrite_target` is an Original.
    """
    if cls is not ArtefactClass.ORIGINAL and parent_id is None:
        raise LineageError(f"{cls.value} artefact requires a parent_id")
    if parent_id is not None:
        parent = get_artefact(conn, parent_id)
        if parent is None:
            raise LineageError(f"parent {parent_id} not found")
        if cls not in ALLOWED_TRANSITIONS[parent.cls]:
            raise LineageError(
                f"transition {parent.cls.value} -> {cls.value} is not allowed"
            )
    return add_artefact(
        conn, matter_id, cls, source, path,
        parent_id=parent_id, metadata=metadata,
        custody_notes=custody_notes, overwrite_target=overwrite_target,
    )
