# Matter Core (Shared Evidence/Artefact Substrate) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared, dependency-free data substrate every matter agent stands on — content-addressed artefacts, an immutable-originals rule, evidence anchors, and a manifest — persisted in SQLite.

**Architecture:** A single SQLite database per matter (`src/evidence_agent/data/<matter_id>/matter.db`) holds all structured records; artefact *content* lives on the filesystem and is referenced by SHA-256. This `core` package defines the canonical types and persistence primitives (`Artefact`, `ArtefactClass`, `EvidenceAnchor`, IDs, hashing, manifest) that the Discovery, Governance, and Reasoning plans import. No agent logic lives here.

**Tech Stack:** Python 3.12, standard library only (`sqlite3`, `hashlib`, `dataclasses`, `enum`, `json`, `uuid`, `pathlib`, `datetime`). Tests: `pytest` via `/Users/spot/evidence-agent/.venv/bin/python -m pytest`.

**Canonical contract (imported by all other matter plans — do not rename):**
- `ArtefactClass` enum values: `ORIGINAL`, `DERIVATIVE`, `ANALYSIS`, `SUBMISSION_READY`.
- `Artefact(id, matter_id, cls, source, path, sha256, created_at, parent_id, metadata, custody_notes)`.
- `EvidenceAnchor(id, matter_id, artefact_id, kind, locator, quote, created_at)`; `kind ∈ {"doc","media"}`.
- `new_id(conn, prefix)` → e.g. `ART-0001`, `ANC-0001`.
- `sha256_file(path) -> str`, `sha256_bytes(b) -> str`.
- `add_artefact(conn, matter_id, cls, source, path, *, parent_id=None, metadata=None, custody_notes="") -> Artefact`.
- `get_artefact(conn, artefact_id) -> Artefact | None`; `list_artefacts(conn, matter_id, cls=None) -> list[Artefact]`.
- `add_anchor(conn, matter_id, artefact_id, kind, locator, quote) -> EvidenceAnchor`.
- `find_duplicate_hashes(conn, matter_id) -> dict[str, list[str]]` (sha256 → artefact ids).
- Custom exception `ImmutableOriginalError`.

---

## File Structure

- `src/evidence_agent/__init__.py` — package marker (empty).
- `src/evidence_agent/core/__init__.py` — re-exports the canonical contract above.
- `src/evidence_agent/core/db.py` — SQLite connect + schema creation/migration.
- `src/evidence_agent/core/ids.py` — sequential prefixed ID generator (per-DB counter table).
- `src/evidence_agent/core/hashing.py` — SHA-256 helpers.
- `src/evidence_agent/core/artefact.py` — `ArtefactClass`, `Artefact`, add/get/list, immutability guard.
- `src/evidence_agent/core/anchor.py` — `EvidenceAnchor`, add/list.
- `src/evidence_agent/core/manifest.py` — dedupe + path-control queries over artefacts.
- `tests/__init__.py` — empty.
- `tests/conftest.py` — shared `db` fixture (in-memory / temp-file connection).

All paths are relative to `/Users/spot/evidence-agent`. Run every command from that directory.

---

### Task 1: Package skeleton + test DB fixture

**Files:**
- Create: `src/evidence_agent/core/__init__.py`
- Create: `tests/__init__.py`
- Create: `tests/conftest.py`
- NOTE: `src/evidence_agent/__init__.py` ALREADY EXISTS (`"""Evidence agent package."""`) — do NOT overwrite it; the `core`, `discovery`, `governance`, `reasoning` subpackages hang off it.

- [ ] **Step 1: Create the empty package markers**

`src/evidence_agent/core/__init__.py` (start empty; re-exports are added as modules land):
```python
"""Shared evidence/artefact substrate."""
```
`tests/__init__.py`:
```python
```

- [ ] **Step 2: Write the pytest fixture**

`tests/conftest.py`:
```python
import sqlite3
import pytest
from evidence_agent.core import db


@pytest.fixture
def conn(tmp_path):
    """A fresh, schema-initialised SQLite connection backed by a temp file."""
    c = db.connect(tmp_path / "matter.db")
    db.init_schema(c)
    yield c
    c.close()
```

- [ ] **Step 3: Commit**

```bash
git add src/evidence_agent/core/__init__.py tests/__init__.py tests/conftest.py
git commit -m "chore(matter): package skeleton + test db fixture"
```

---

### Task 2: DB connect + schema

**Files:**
- Create: `src/evidence_agent/core/db.py`
- Test: `tests/test_db.py`

- [ ] **Step 1: Write the failing test**

`tests/test_db.py`:
```python
from evidence_agent.core import db


def test_schema_creates_expected_tables(conn):
    names = {
        r[0]
        for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    assert {"artefacts", "evidence_anchors", "id_counters"} <= names


def test_foreign_keys_enabled(conn):
    assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_db.py -v`
Expected: FAIL — `ModuleNotFoundError` / `AttributeError: module 'db' has no attribute 'connect'`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/core/db.py`:
```python
from __future__ import annotations

import sqlite3
from pathlib import Path

_SCHEMA = """
CREATE TABLE IF NOT EXISTS id_counters (
    prefix TEXT PRIMARY KEY,
    value  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS artefacts (
    id            TEXT PRIMARY KEY,
    matter_id     TEXT NOT NULL,
    cls           TEXT NOT NULL,
    source        TEXT NOT NULL,
    path          TEXT NOT NULL,
    sha256        TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    parent_id     TEXT REFERENCES artefacts(id),
    metadata      TEXT NOT NULL DEFAULT '{}',
    custody_notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_artefacts_matter ON artefacts(matter_id);
CREATE INDEX IF NOT EXISTS ix_artefacts_sha    ON artefacts(matter_id, sha256);
CREATE TABLE IF NOT EXISTS evidence_anchors (
    id          TEXT PRIMARY KEY,
    matter_id   TEXT NOT NULL,
    artefact_id TEXT NOT NULL REFERENCES artefacts(id),
    kind        TEXT NOT NULL,
    locator     TEXT NOT NULL,
    quote       TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_anchors_artefact ON evidence_anchors(artefact_id);
"""


def connect(path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(_SCHEMA)
    conn.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_db.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/core/db.py tests/test_db.py
git commit -m "feat(matter-core): sqlite connect + schema"
```

---

### Task 3: Prefixed sequential IDs

**Files:**
- Create: `src/evidence_agent/core/ids.py`
- Test: `tests/test_ids.py`

- [ ] **Step 1: Write the failing test**

`tests/test_ids.py`:
```python
from evidence_agent.core.ids import new_id


def test_ids_increment_per_prefix(conn):
    assert new_id(conn, "ART") == "ART-0001"
    assert new_id(conn, "ART") == "ART-0002"
    assert new_id(conn, "ANC") == "ANC-0001"  # independent counter


def test_ids_persist_across_calls(conn):
    for _ in range(11):
        last = new_id(conn, "REQ")
    assert last == "REQ-0011"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_ids.py -v`
Expected: FAIL — `ModuleNotFoundError: evidence_agent.core.ids`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/core/ids.py`:
```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_ids.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/core/ids.py tests/test_ids.py
git commit -m "feat(matter-core): sequential prefixed ids"
```

---

### Task 4: Content hashing

**Files:**
- Create: `src/evidence_agent/core/hashing.py`
- Test: `tests/test_hashing.py`

- [ ] **Step 1: Write the failing test**

`tests/test_hashing.py`:
```python
import hashlib
from evidence_agent.core.hashing import sha256_bytes, sha256_file


def test_sha256_bytes_matches_hashlib():
    assert sha256_bytes(b"abc") == hashlib.sha256(b"abc").hexdigest()


def test_sha256_file_matches_bytes(tmp_path):
    p = tmp_path / "doc.txt"
    p.write_bytes(b"evidence")
    assert sha256_file(p) == sha256_bytes(b"evidence")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_hashing.py -v`
Expected: FAIL — `ModuleNotFoundError: evidence_agent.core.hashing`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/core/hashing.py`:
```python
from __future__ import annotations

import hashlib
from pathlib import Path


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: str | Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_hashing.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/core/hashing.py tests/test_hashing.py
git commit -m "feat(matter-core): sha256 hashing helpers"
```

---

### Task 5: Artefact record + add/get/list + immutable-originals rule

**Files:**
- Create: `src/evidence_agent/core/artefact.py`
- Test: `tests/test_artefact.py`

- [ ] **Step 1: Write the failing test**

`tests/test_artefact.py`:
```python
import pytest
from evidence_agent.core.artefact import (
    Artefact, ArtefactClass, add_artefact, get_artefact, list_artefacts,
    ImmutableOriginalError,
)


def _write(tmp_path, name, data=b"x"):
    p = tmp_path / name
    p.write_bytes(data)
    return p


def test_add_and_get_roundtrip(conn, tmp_path):
    p = _write(tmp_path, "brief.pdf", b"hello")
    a = add_artefact(conn, "M1", ArtefactClass.ORIGINAL, "police brief", p)
    assert a.id.startswith("ART-")
    assert a.cls is ArtefactClass.ORIGINAL
    assert a.sha256 == __import__("hashlib").sha256(b"hello").hexdigest()
    got = get_artefact(conn, a.id)
    assert got == a


def test_list_filters_by_class(conn, tmp_path):
    add_artefact(conn, "M1", ArtefactClass.ORIGINAL, "s", _write(tmp_path, "o"))
    add_artefact(conn, "M1", ArtefactClass.DERIVATIVE, "s", _write(tmp_path, "d"))
    assert len(list_artefacts(conn, "M1")) == 2
    assert len(list_artefacts(conn, "M1", ArtefactClass.ORIGINAL)) == 1


def test_originals_are_immutable(conn, tmp_path):
    a = add_artefact(conn, "M1", ArtefactClass.ORIGINAL, "s", _write(tmp_path, "o"))
    with pytest.raises(ImmutableOriginalError):
        add_artefact(
            conn, "M1", ArtefactClass.DERIVATIVE, "edit", _write(tmp_path, "o2"),
            parent_id=a.id, overwrite_target=a.id,
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_artefact.py -v`
Expected: FAIL — `ModuleNotFoundError: evidence_agent.core.artefact`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/core/artefact.py`:
```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_artefact.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/core/artefact.py tests/test_artefact.py
git commit -m "feat(matter-core): artefact record + immutable-originals rule"
```

---

### Task 6: Evidence anchors

**Files:**
- Create: `src/evidence_agent/core/anchor.py`
- Test: `tests/test_anchor.py`

- [ ] **Step 1: Write the failing test**

`tests/test_anchor.py`:
```python
import pytest
from evidence_agent.core.artefact import ArtefactClass, add_artefact
from evidence_agent.core.anchor import EvidenceAnchor, add_anchor, list_anchors


def _artefact(conn, tmp_path):
    p = tmp_path / "o"; p.write_bytes(b"x")
    return add_artefact(conn, "M1", ArtefactClass.ORIGINAL, "s", p)


def test_add_doc_anchor(conn, tmp_path):
    a = _artefact(conn, tmp_path)
    anc = add_anchor(conn, "M1", a.id, "doc", "p12/l4-9", "the search was warrantless")
    assert anc.id.startswith("ANC-")
    assert anc.kind == "doc" and anc.locator == "p12/l4-9"
    assert list_anchors(conn, a.id) == [anc]


def test_anchor_rejects_bad_kind(conn, tmp_path):
    a = _artefact(conn, tmp_path)
    with pytest.raises(ValueError):
        add_anchor(conn, "M1", a.id, "sound", "00:03", "")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_anchor.py -v`
Expected: FAIL — `ModuleNotFoundError: evidence_agent.core.anchor`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/core/anchor.py`:
```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_anchor.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/core/anchor.py tests/test_anchor.py
git commit -m "feat(matter-core): evidence anchors"
```

---

### Task 7: Manifest — dedupe + path control

**Files:**
- Create: `src/evidence_agent/core/manifest.py`
- Test: `tests/test_manifest.py`

- [ ] **Step 1: Write the failing test**

`tests/test_manifest.py`:
```python
from evidence_agent.core.artefact import ArtefactClass, add_artefact
from evidence_agent.core.manifest import find_duplicate_hashes, manifest_rows


def _add(conn, tmp_path, name, data):
    p = tmp_path / name; p.write_bytes(data)
    return add_artefact(conn, "M1", ArtefactClass.ORIGINAL, "s", p)


def test_find_duplicate_hashes(conn, tmp_path):
    a = _add(conn, tmp_path, "a", b"same")
    b = _add(conn, tmp_path, "b", b"same")   # identical content
    _add(conn, tmp_path, "c", b"different")
    dupes = find_duplicate_hashes(conn, "M1")
    assert list(dupes.values()) == [sorted([a.id, b.id])]


def test_manifest_rows_shape(conn, tmp_path):
    _add(conn, tmp_path, "a", b"x")
    rows = manifest_rows(conn, "M1")
    assert set(rows[0]) >= {"id", "cls", "path", "sha256", "source"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_manifest.py -v`
Expected: FAIL — `ModuleNotFoundError: evidence_agent.core.manifest`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/core/manifest.py`:
```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_manifest.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/core/manifest.py tests/test_manifest.py
git commit -m "feat(matter-core): manifest dedupe + path control"
```

---

### Task 8: Re-export the canonical contract

**Files:**
- Modify: `src/evidence_agent/core/__init__.py`
- Test: `tests/test_contract.py`

- [ ] **Step 1: Write the failing test**

`tests/test_contract.py`:
```python
def test_public_contract_importable():
    from evidence_agent.core import (
        db, ArtefactClass, Artefact, ImmutableOriginalError,
        add_artefact, get_artefact, list_artefacts,
        EvidenceAnchor, add_anchor, list_anchors,
        new_id, sha256_file, sha256_bytes,
        find_duplicate_hashes, manifest_rows,
    )
    assert ArtefactClass.ORIGINAL.value == "Original"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_contract.py -v`
Expected: FAIL — `ImportError: cannot import name 'ArtefactClass' from 'evidence_agent.core'`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/core/__init__.py`:
```python
"""Shared evidence/artefact substrate — canonical contract."""
from evidence_agent.core import db
from evidence_agent.core.ids import new_id
from evidence_agent.core.hashing import sha256_file, sha256_bytes
from evidence_agent.core.artefact import (
    ArtefactClass, Artefact, ImmutableOriginalError,
    add_artefact, get_artefact, list_artefacts,
)
from evidence_agent.core.anchor import EvidenceAnchor, add_anchor, list_anchors
from evidence_agent.core.manifest import find_duplicate_hashes, manifest_rows

__all__ = [
    "db", "new_id", "sha256_file", "sha256_bytes",
    "ArtefactClass", "Artefact", "ImmutableOriginalError",
    "add_artefact", "get_artefact", "list_artefacts",
    "EvidenceAnchor", "add_anchor", "list_anchors",
    "find_duplicate_hashes", "manifest_rows",
]
```

- [ ] **Step 4: Run the whole matter suite**

Run: `.venv/bin/python -m pytest tests/ -v`
Expected: PASS (all tasks green).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/core/__init__.py tests/test_contract.py
git commit -m "feat(matter-core): re-export canonical contract"
```

---

## Self-Review

- **Spec coverage:** This plan is the shared substrate the spec's three subsystems stand on — artefact classes (Governance), immutable+hashed Originals (Governance §2), evidence anchors (Governance §5), manifest/dedupe (Governance §4), and the artefact/hash primitives Discovery's receipt check (Discovery §3) and Reasoning's artefact references (Reasoning §1) consume. Agent-specific tables/logic live in the other three plans.
- **Placeholder scan:** none — every step ships runnable code and an exact command.
- **Type consistency:** `ArtefactClass`, `Artefact`, `EvidenceAnchor`, `add_artefact`, `add_anchor`, `new_id`, `find_duplicate_hashes` are defined here and imported verbatim by the Discovery, Governance, and Reasoning plans.
