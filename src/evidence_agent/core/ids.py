from __future__ import annotations

import sqlite3


def new_id(conn: sqlite3.Connection, prefix: str, width: int = 4) -> str:
    """Atomically increment and return the next `PREFIX-NNNN` id for this DB."""
    conn.execute(
        "INSERT INTO id_counters(prefix, value) VALUES(?, 1) "
        "ON CONFLICT(prefix) DO UPDATE SET value = value + 1",
        (prefix,),
    )
    value = conn.execute(
        "SELECT value FROM id_counters WHERE prefix = ?", (prefix,)
    ).fetchone()[0]
    conn.commit()
    return f"{prefix}-{value:0{width}d}"
