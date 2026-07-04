from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path

from evidence_agent.core.hashing import sha256_file
from evidence_agent.core.ids import new_id


class ArtefactClass(Enum):
    ORIGINAL = "Original"
    DERIVATIVE = "Derivative"
    ANALYSIS = "Analysis"
    SUBMISSION_READY = "Submission-Ready"


class ImmutableOriginalError(Exception):
    """Raised on any attempt to mutate/overwrite an Original artefact."""


@dataclass(frozen=True)
class Artefact:
    id: str
    matter_id: str
    cls: ArtefactClass
    source: str
    path: str
    sha256: str
    created_at: str
    parent_id: str | None
    metadata: dict
    custody_notes: str


def _row_to_artefact(row: sqlite3.Row) -> Artefact:
    return Artefact(
        id=row["id"], matter_id=row["matter_id"], cls=ArtefactClass(row["cls"]),
        source=row["source"], path=row["path"], sha256=row["sha256"],
        created_at=row["created_at"], parent_id=row["parent_id"],
        metadata=json.loads(row["metadata"]), custody_notes=row["custody_notes"],
    )


def add_artefact(
    conn: sqlite3.Connection, matter_id: str, cls: ArtefactClass, source: str,
    path: str | Path, *, parent_id: str | None = None, metadata: dict | None = None,
    custody_notes: str = "", overwrite_target: str | None = None,
) -> Artefact:
    if overwrite_target is not None:
        target = get_artefact(conn, overwrite_target)
        if target is not None and target.cls is ArtefactClass.ORIGINAL:
            raise ImmutableOriginalError(
                f"{overwrite_target} is an Original; work on a derivative instead"
            )
    aid = new_id(conn, "ART")
    created = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO artefacts(id, matter_id, cls, source, path, sha256, "
        "created_at, parent_id, metadata, custody_notes) VALUES(?,?,?,?,?,?,?,?,?,?)",
        (aid, matter_id, cls.value, source, str(path), sha256_file(path),
         created, parent_id, json.dumps(metadata or {}), custody_notes),
    )
    conn.commit()
    return get_artefact(conn, aid)


def get_artefact(conn: sqlite3.Connection, artefact_id: str) -> Artefact | None:
    row = conn.execute("SELECT * FROM artefacts WHERE id = ?", (artefact_id,)).fetchone()
    return _row_to_artefact(row) if row else None


def list_artefacts(
    conn: sqlite3.Connection, matter_id: str, cls: ArtefactClass | None = None
) -> list[Artefact]:
    if cls is None:
        rows = conn.execute(
            "SELECT * FROM artefacts WHERE matter_id = ? ORDER BY id", (matter_id,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM artefacts WHERE matter_id = ? AND cls = ? ORDER BY id",
            (matter_id, cls.value),
        ).fetchall()
    return [_row_to_artefact(r) for r in rows]
