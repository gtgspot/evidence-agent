from __future__ import annotations

import sqlite3
from collections import defaultdict


def find_duplicate_hashes(conn: sqlite3.Connection, matter_id: str) -> dict[str, list[str]]:
    """sha256 → sorted artefact ids, for hashes appearing more than once."""
    rows = conn.execute(
        "SELECT sha256, id FROM artefacts WHERE matter_id = ? ORDER BY id",
        (matter_id,),
    ).fetchall()
    by_hash: dict[str, list[str]] = defaultdict(list)
    for r in rows:
        by_hash[r["sha256"]].append(r["id"])
    return {h: sorted(ids) for h, ids in by_hash.items() if len(ids) > 1}


def manifest_rows(conn: sqlite3.Connection, matter_id: str) -> list[dict]:
    """One dict per artefact for the Artifact Manifest (path control surface)."""
    rows = conn.execute(
        "SELECT id, cls, path, sha256, source, parent_id, created_at "
        "FROM artefacts WHERE matter_id = ? ORDER BY id",
        (matter_id,),
    ).fetchall()
    return [dict(r) for r in rows]
