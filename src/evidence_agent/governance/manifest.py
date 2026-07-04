from __future__ import annotations

import sqlite3
from collections import defaultdict

from evidence_agent.core import find_duplicate_hashes, manifest_rows


def export_manifest(conn: sqlite3.Connection, matter_id: str) -> list[dict]:
    """The single governance-facing Artifact Manifest (delegates to core manifest_rows)."""
    return manifest_rows(conn, matter_id)


def detect_path_collisions(
    conn: sqlite3.Connection, matter_id: str
) -> dict[str, list[str]]:
    """path -> sorted artefact ids, for any path used by more than one artefact."""
    rows = conn.execute(
        "SELECT path, id FROM artefacts WHERE matter_id = ? ORDER BY id",
        (matter_id,),
    ).fetchall()
    by_path: dict[str, list[str]] = defaultdict(list)
    for r in rows:
        by_path[r["path"]].append(r["id"])
    return {p: sorted(ids) for p, ids in by_path.items() if len(ids) > 1}


def duplicate_report(
    conn: sqlite3.Connection, matter_id: str
) -> dict[str, list[str]]:
    """Dedupe view over core find_duplicate_hashes (sha256 -> artefact ids)."""
    return find_duplicate_hashes(conn, matter_id)
