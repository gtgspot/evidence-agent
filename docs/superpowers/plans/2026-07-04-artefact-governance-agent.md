# Workspace Artefact Governance Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce artefact governance for a matter workspace — the four artefact classes, immutable+hashed Originals with integrity verification, a parent-id lineage rule, an append-only chain-of-custody log with linked issues, a single de-duplicated Artifact Manifest with path control, and a claim-to-evidence anchoring check.

**Architecture:** This `governance` package sits on top of the already-built shared `evidence_agent.core` substrate. It defines **no** artefact/anchor types of its own — it imports them verbatim from `evidence_agent.core` and adds only governance-specific tables (`custody_events`, `linked_issues`) via `init_governance_schema`. Pure logic takes timestamps/actor as parameters for deterministic tests; IDs come from core `new_id`. **Prerequisite: implement the Matter Core plan first** (`src/evidence_agent/core/` and `tests/conftest.py`'s `conn` fixture must exist); otherwise Task 1's `from evidence_agent.core import ...` fails with `ModuleNotFoundError` — that is a missing prerequisite, not a bug.

**Tech Stack:** Python 3.12, standard library only (`sqlite3`, `hashlib`, `dataclasses`, `enum`, `json`, `datetime`, `pathlib`). Tests: `pytest` via `/Users/spot/evidence-agent/.venv/bin/python -m pytest`. Run every command from `/Users/spot/evidence-agent`.

---

## File Structure

- `src/evidence_agent/governance/__init__.py` — re-exports the governance public API.
- `src/evidence_agent/governance/schema.py` — `init_governance_schema(conn)`: creates `custody_events` + `linked_issues` tables.
- `src/evidence_agent/governance/classes.py` — `ALLOWED_TRANSITIONS`, `LineageError`, `governed_add` (parent-id lineage rule + refuses to mutate Originals via core's `overwrite_target`).
- `src/evidence_agent/governance/custody.py` — `CustodyEvent`, `record_custody_event`, `list_custody`, `verify_integrity`, `link_issue`, `list_linked_issues`.
- `src/evidence_agent/governance/manifest.py` — `export_manifest`, `detect_path_collisions`, `duplicate_report`.
- `src/evidence_agent/governance/linkcheck.py` — `Claim`, `check_claim_anchoring`.
- `tests/test_governance_schema.py` — schema table tests.
- `tests/test_governance_classes.py` — lineage + transition + immutability tests.
- `tests/test_governance_custody.py` — custody log, linked issues, integrity tests.
- `tests/test_governance_manifest.py` — manifest export, path collisions, dedupe tests.
- `tests/test_governance_linkcheck.py` — claim-anchoring tests.
- `tests/test_governance_contract.py` — public API import surface.

All paths are relative to `/Users/spot/evidence-agent`. Each governance test module defines its own `gconn` fixture that takes the shared `conn` (core schema) and additionally calls `init_governance_schema`.

---

### Task 1: Governance package + schema (custody_events, linked_issues)

**Files:**
- Create: `src/evidence_agent/governance/__init__.py`
- Create: `src/evidence_agent/governance/schema.py`
- Test: `tests/test_governance_schema.py`

- [ ] **Step 1: Write the failing test**

`tests/test_governance_schema.py`:
```python
import pytest
from evidence_agent.governance.schema import init_governance_schema


@pytest.fixture
def gconn(conn):
    """Core `conn` fixture + governance tables."""
    init_governance_schema(conn)
    return conn


def test_schema_creates_governance_tables(gconn):
    names = {
        r[0]
        for r in gconn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    assert {"custody_events", "linked_issues"} <= names


def test_schema_is_idempotent(gconn):
    # Second call must not raise.
    init_governance_schema(gconn)
    names = {
        r[0]
        for r in gconn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    assert {"custody_events", "linked_issues"} <= names
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_governance_schema.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'evidence_agent.governance'`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/governance/__init__.py` (start empty; re-exports are added in the final task):
```python
"""Workspace artefact governance agent."""
```

`src/evidence_agent/governance/schema.py`:
```python
from __future__ import annotations

import sqlite3

_SCHEMA = """
CREATE TABLE IF NOT EXISTS custody_events (
    id          TEXT PRIMARY KEY,
    artefact_id TEXT NOT NULL REFERENCES artefacts(id),
    event       TEXT NOT NULL,
    actor       TEXT NOT NULL,
    timestamp   TEXT NOT NULL,
    note        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_custody_artefact ON custody_events(artefact_id);
CREATE TABLE IF NOT EXISTS linked_issues (
    artefact_id TEXT NOT NULL REFERENCES artefacts(id),
    issue_ref   TEXT NOT NULL,
    PRIMARY KEY (artefact_id, issue_ref)
);
"""


def init_governance_schema(conn: sqlite3.Connection) -> None:
    """Create the governance-owned tables (append-only custody + linked issues)."""
    conn.executescript(_SCHEMA)
    conn.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_governance_schema.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/governance/__init__.py src/evidence_agent/governance/schema.py tests/test_governance_schema.py
git commit -m "feat(governance): package + custody/linked-issues schema"
```

---

### Task 2: Class transitions + governed_add (lineage rule + immutable Originals)

**Files:**
- Create: `src/evidence_agent/governance/classes.py`
- Test: `tests/test_governance_classes.py`

Governance policy — the transition graph below is a deliberate governance rule (the spec fixes only the parent-id requirement; the allowed-transition map is this agent's policy on top of it):
`ORIGINAL → {DERIVATIVE, ANALYSIS}`, `DERIVATIVE → {DERIVATIVE, ANALYSIS, SUBMISSION_READY}`, `ANALYSIS → {ANALYSIS, SUBMISSION_READY}`, `SUBMISSION_READY → {SUBMISSION_READY}`. The **primary, spec-mandated gate** is: any non-Original artefact must declare a `parent_id`.

- [ ] **Step 1: Write the failing test**

`tests/test_governance_classes.py`:
```python
import pytest
from evidence_agent.core import ArtefactClass, ImmutableOriginalError
from evidence_agent.governance.schema import init_governance_schema
from evidence_agent.governance.classes import LineageError, governed_add


@pytest.fixture
def gconn(conn):
    init_governance_schema(conn)
    return conn


def _write(tmp_path, name, data=b"x"):
    p = tmp_path / name
    p.write_bytes(data)
    return p


def test_original_needs_no_parent(gconn, tmp_path):
    a = governed_add(gconn, "M1", ArtefactClass.ORIGINAL, "brief", _write(tmp_path, "o"))
    assert a.parent_id is None
    assert a.cls is ArtefactClass.ORIGINAL


def test_derivative_requires_parent(gconn, tmp_path):
    with pytest.raises(LineageError):
        governed_add(gconn, "M1", ArtefactClass.DERIVATIVE, "edit", _write(tmp_path, "d"))


def test_valid_transition_records_parent(gconn, tmp_path):
    orig = governed_add(gconn, "M1", ArtefactClass.ORIGINAL, "s", _write(tmp_path, "o"))
    deriv = governed_add(
        gconn, "M1", ArtefactClass.DERIVATIVE, "s", _write(tmp_path, "d"),
        parent_id=orig.id,
    )
    assert deriv.parent_id == orig.id


def test_invalid_transition_rejected(gconn, tmp_path):
    orig = governed_add(gconn, "M1", ArtefactClass.ORIGINAL, "s", _write(tmp_path, "o"))
    with pytest.raises(LineageError):
        governed_add(
            gconn, "M1", ArtefactClass.SUBMISSION_READY, "s", _write(tmp_path, "sr"),
            parent_id=orig.id,
        )


def test_missing_parent_rejected(gconn, tmp_path):
    with pytest.raises(LineageError):
        governed_add(
            gconn, "M1", ArtefactClass.DERIVATIVE, "s", _write(tmp_path, "d"),
            parent_id="ART-9999",
        )


def test_refuses_to_overwrite_original(gconn, tmp_path):
    orig = governed_add(gconn, "M1", ArtefactClass.ORIGINAL, "s", _write(tmp_path, "o"))
    with pytest.raises(ImmutableOriginalError):
        governed_add(
            gconn, "M1", ArtefactClass.DERIVATIVE, "s", _write(tmp_path, "d"),
            parent_id=orig.id, overwrite_target=orig.id,
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_governance_classes.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'evidence_agent.governance.classes'`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/governance/classes.py`:
```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_governance_classes.py -v`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/governance/classes.py tests/test_governance_classes.py
git commit -m "feat(governance): governed_add lineage rule + transitions"
```

---

### Task 3: Custody log + integrity verification

**Files:**
- Create: `src/evidence_agent/governance/custody.py`
- Test: `tests/test_governance_custody.py`

- [ ] **Step 1: Write the failing test**

`tests/test_governance_custody.py`:
```python
import pytest
from evidence_agent.core import ArtefactClass, add_artefact
from evidence_agent.governance.schema import init_governance_schema
from evidence_agent.governance.custody import (
    CustodyEvent, record_custody_event, list_custody, verify_integrity,
)


@pytest.fixture
def gconn(conn):
    init_governance_schema(conn)
    return conn


def _original(gconn, tmp_path, name="o", data=b"evidence"):
    p = tmp_path / name
    p.write_bytes(data)
    return add_artefact(gconn, "M1", ArtefactClass.ORIGINAL, "seized", p)


def test_record_and_list_custody_ordered(gconn, tmp_path):
    a = _original(gconn, tmp_path)
    e1 = record_custody_event(
        gconn, a.id, "seized", "Sgt Blake", "2025-12-05T09:00:00+00:00", "at scene"
    )
    e2 = record_custody_event(
        gconn, a.id, "logged", "Clerk", "2025-12-05T14:00:00+00:00"
    )
    assert e1.id.startswith("CUS-")
    assert isinstance(e1, CustodyEvent)
    events = list_custody(gconn, a.id)
    assert [e.id for e in events] == [e1.id, e2.id]
    assert events[0].actor == "Sgt Blake"
    assert events[0].timestamp == "2025-12-05T09:00:00+00:00"
    assert events[1].note == ""


def test_verify_integrity_true_then_false(gconn, tmp_path):
    p = tmp_path / "o"
    p.write_bytes(b"evidence")
    a = add_artefact(gconn, "M1", ArtefactClass.ORIGINAL, "seized", p)
    assert verify_integrity(gconn, a.id) is True
    p.write_bytes(b"tampered")  # mutate the file on disk
    assert verify_integrity(gconn, a.id) is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_governance_custody.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'evidence_agent.governance.custody'`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/governance/custody.py`:
```python
from __future__ import annotations

import sqlite3
from dataclasses import dataclass

from evidence_agent.core import get_artefact, new_id, sha256_file


@dataclass(frozen=True)
class CustodyEvent:
    id: str
    artefact_id: str
    event: str
    actor: str
    timestamp: str
    note: str


def record_custody_event(
    conn: sqlite3.Connection,
    artefact_id: str,
    event: str,
    actor: str,
    timestamp: str,
    note: str = "",
) -> CustodyEvent:
    """Append a chain-of-custody event (append-only; timestamp is caller-supplied)."""
    cid = new_id(conn, "CUS")
    conn.execute(
        "INSERT INTO custody_events(id, artefact_id, event, actor, timestamp, note) "
        "VALUES(?,?,?,?,?,?)",
        (cid, artefact_id, event, actor, timestamp, note),
    )
    conn.commit()
    return CustodyEvent(cid, artefact_id, event, actor, timestamp, note)


def list_custody(conn: sqlite3.Connection, artefact_id: str) -> list[CustodyEvent]:
    rows = conn.execute(
        "SELECT id, artefact_id, event, actor, timestamp, note "
        "FROM custody_events WHERE artefact_id = ? ORDER BY id",
        (artefact_id,),
    ).fetchall()
    return [
        CustodyEvent(r["id"], r["artefact_id"], r["event"], r["actor"],
                     r["timestamp"], r["note"])
        for r in rows
    ]


def verify_integrity(conn: sqlite3.Connection, artefact_id: str) -> bool:
    """Re-hash the file on disk and compare to the stored Artefact.sha256."""
    art = get_artefact(conn, artefact_id)
    if art is None:
        raise KeyError(artefact_id)
    return sha256_file(art.path) == art.sha256
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_governance_custody.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/governance/custody.py tests/test_governance_custody.py
git commit -m "feat(governance): custody log + integrity verification"
```

---

### Task 4: Linked issues

**Files:**
- Modify: `src/evidence_agent/governance/custody.py`
- Test: `tests/test_governance_custody.py`

- [ ] **Step 1: Add the failing test**

Append to `tests/test_governance_custody.py` (extend the import line first):
```python
from evidence_agent.governance.custody import (
    CustodyEvent, record_custody_event, list_custody, verify_integrity,
    link_issue, list_linked_issues,
)
```
Then add:
```python
def test_link_issue_dedupes_and_lists(gconn, tmp_path):
    a = _original(gconn, tmp_path)
    link_issue(gconn, a.id, "ISSUE-warrantless-search")
    link_issue(gconn, a.id, "ISSUE-chain-of-custody")
    link_issue(gconn, a.id, "ISSUE-warrantless-search")  # duplicate is a no-op
    assert list_linked_issues(gconn, a.id) == [
        "ISSUE-chain-of-custody",
        "ISSUE-warrantless-search",
    ]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_governance_custody.py -v`
Expected: FAIL — `ImportError: cannot import name 'link_issue'`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/evidence_agent/governance/custody.py`:
```python
def link_issue(conn: sqlite3.Connection, artefact_id: str, issue_ref: str) -> None:
    """Link an artefact to an issue reference (idempotent)."""
    conn.execute(
        "INSERT OR IGNORE INTO linked_issues(artefact_id, issue_ref) VALUES(?, ?)",
        (artefact_id, issue_ref),
    )
    conn.commit()


def list_linked_issues(conn: sqlite3.Connection, artefact_id: str) -> list[str]:
    rows = conn.execute(
        "SELECT issue_ref FROM linked_issues WHERE artefact_id = ? ORDER BY issue_ref",
        (artefact_id,),
    ).fetchall()
    return [r["issue_ref"] for r in rows]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_governance_custody.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/governance/custody.py tests/test_governance_custody.py
git commit -m "feat(governance): linked issues"
```

---

### Task 5: Artifact Manifest — export + path collisions + dedupe

**Files:**
- Create: `src/evidence_agent/governance/manifest.py`
- Test: `tests/test_governance_manifest.py`

- [ ] **Step 1: Write the failing test**

`tests/test_governance_manifest.py`:
```python
import pytest
from evidence_agent.core import ArtefactClass, add_artefact, manifest_rows, find_duplicate_hashes
from evidence_agent.governance.schema import init_governance_schema
from evidence_agent.governance.manifest import (
    export_manifest, detect_path_collisions, duplicate_report,
)


@pytest.fixture
def gconn(conn):
    init_governance_schema(conn)
    return conn


def _add(gconn, path, source, data):
    path.write_bytes(data)
    return add_artefact(gconn, "M1", ArtefactClass.ORIGINAL, source, path)


def test_export_manifest_matches_core(gconn, tmp_path):
    _add(gconn, tmp_path / "a", "s", b"x")
    rows = export_manifest(gconn, "M1")
    assert rows == manifest_rows(gconn, "M1")
    assert {"id", "cls", "path", "sha256", "source"} <= set(rows[0])


def test_detect_path_collisions(gconn, tmp_path):
    shared = tmp_path / "shared"
    a = _add(gconn, shared, "first", b"x")
    b = _add(gconn, shared, "second", b"x")  # same path reused
    _add(gconn, tmp_path / "solo", "s", b"y")
    cols = detect_path_collisions(gconn, "M1")
    assert list(cols.values()) == [sorted([a.id, b.id])]


def test_duplicate_report_delegates_to_core(gconn, tmp_path):
    _add(gconn, tmp_path / "a", "s", b"same")
    _add(gconn, tmp_path / "b", "s", b"same")
    assert duplicate_report(gconn, "M1") == find_duplicate_hashes(gconn, "M1")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_governance_manifest.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'evidence_agent.governance.manifest'`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/governance/manifest.py`:
```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_governance_manifest.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/governance/manifest.py tests/test_governance_manifest.py
git commit -m "feat(governance): manifest export + path collisions + dedupe"
```

---

### Task 6: Claim-to-evidence anchoring check

**Files:**
- Create: `src/evidence_agent/governance/linkcheck.py`
- Test: `tests/test_governance_linkcheck.py`

- [ ] **Step 1: Write the failing test**

`tests/test_governance_linkcheck.py`:
```python
import pytest
from evidence_agent.core import ArtefactClass, add_artefact, add_anchor
from evidence_agent.governance.schema import init_governance_schema
from evidence_agent.governance.linkcheck import Claim, check_claim_anchoring


@pytest.fixture
def gconn(conn):
    init_governance_schema(conn)
    return conn


def _original(gconn, tmp_path, matter, name, data=b"x"):
    p = tmp_path / name
    p.write_bytes(data)
    return add_artefact(gconn, matter, ArtefactClass.ORIGINAL, "s", p)


def _analysis(gconn, tmp_path, parent, name):
    p = tmp_path / name
    p.write_bytes(b"analysis")
    return add_artefact(
        gconn, "M1", ArtefactClass.ANALYSIS, "s", p, parent_id=parent.id
    )


def test_fully_anchored_returns_empty(gconn, tmp_path):
    orig = _original(gconn, tmp_path, "M1", "o")
    analysis = _analysis(gconn, tmp_path, orig, "an")
    anc = add_anchor(gconn, "M1", orig.id, "doc", "p12/l4-9", "warrantless search")
    claims = [Claim("The search was warrantless", [anc.id])]
    assert check_claim_anchoring(gconn, analysis.id, claims) == []


def test_unanchored_claims_are_returned(gconn, tmp_path):
    orig = _original(gconn, tmp_path, "M1", "o")
    analysis = _analysis(gconn, tmp_path, orig, "an")
    good = add_anchor(gconn, "M1", orig.id, "doc", "p1", "ok")
    foreign_orig = _original(gconn, tmp_path, "M2", "o2")
    foreign = add_anchor(gconn, "M2", foreign_orig.id, "doc", "p1", "other matter")

    no_anchor = Claim("bare assertion", [])
    missing = Claim("cites a ghost anchor", ["ANC-9999"])
    cross_matter = Claim("cites another matter", [foreign.id])
    ok = Claim("properly anchored", [good.id])

    result = check_claim_anchoring(
        gconn, analysis.id, [no_anchor, missing, cross_matter, ok]
    )
    assert result == [no_anchor, missing, cross_matter]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_governance_linkcheck.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'evidence_agent.governance.linkcheck'`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/governance/linkcheck.py`:
```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_governance_linkcheck.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/governance/linkcheck.py tests/test_governance_linkcheck.py
git commit -m "feat(governance): claim-to-evidence anchoring check"
```

---

### Task 7: Re-export the governance public API

**Files:**
- Modify: `src/evidence_agent/governance/__init__.py`
- Test: `tests/test_governance_contract.py`

- [ ] **Step 1: Write the failing test**

`tests/test_governance_contract.py`:
```python
def test_governance_public_api_importable():
    from evidence_agent.governance import (
        init_governance_schema,
        ALLOWED_TRANSITIONS, LineageError, governed_add,
        CustodyEvent, record_custody_event, list_custody, verify_integrity,
        link_issue, list_linked_issues,
        export_manifest, detect_path_collisions, duplicate_report,
        Claim, check_claim_anchoring,
    )
    from evidence_agent.core import ArtefactClass
    assert ArtefactClass.ORIGINAL in ALLOWED_TRANSITIONS
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_governance_contract.py -v`
Expected: FAIL — `ImportError: cannot import name 'init_governance_schema' from 'evidence_agent.governance'`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/governance/__init__.py`:
```python
"""Workspace artefact governance agent — public API."""
from evidence_agent.governance.schema import init_governance_schema
from evidence_agent.governance.classes import (
    ALLOWED_TRANSITIONS, LineageError, governed_add,
)
from evidence_agent.governance.custody import (
    CustodyEvent, record_custody_event, list_custody, verify_integrity,
    link_issue, list_linked_issues,
)
from evidence_agent.governance.manifest import (
    export_manifest, detect_path_collisions, duplicate_report,
)
from evidence_agent.governance.linkcheck import Claim, check_claim_anchoring

__all__ = [
    "init_governance_schema",
    "ALLOWED_TRANSITIONS", "LineageError", "governed_add",
    "CustodyEvent", "record_custody_event", "list_custody", "verify_integrity",
    "link_issue", "list_linked_issues",
    "export_manifest", "detect_path_collisions", "duplicate_report",
    "Claim", "check_claim_anchoring",
]
```

- [ ] **Step 4: Run the whole matter suite**

Run: `.venv/bin/python -m pytest tests/ -v`
Expected: PASS (core suite + all governance tasks green).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/governance/__init__.py tests/test_governance_contract.py
git commit -m "feat(governance): re-export public API"
```

---

## Self-Review

- **Spec point 1 (enforce the 4 artefact classes, reuse core `ArtefactClass`):** Task 2 — `ALLOWED_TRANSITIONS` and `governed_add` are keyed on the core `ArtefactClass` values (`Original`/`Derivative`/`Analysis`/`Submission-Ready`); no class type is redefined.
- **Spec point 2 (immutable+hashed Originals; `verify_integrity`; non-Original needs `parent_id`):** split across Task 2 (lineage `parent_id` gate + `governed_add` refuses to mutate Originals via core's `overwrite_target`, letting `ImmutableOriginalError` propagate) and Task 3 (`verify_integrity` re-hashes disk via core `sha256_file` and compares to stored `Artefact.sha256`).
- **Spec point 3 (unique id + metadata row; append-only `custody_events`; `linked_issues`):** IDs via core `new_id`; source/date/notes already on the core `Artefact`. `custody_events` table + `record_custody_event`/`list_custody` span Task 1 (schema) and Task 3; `linked_issues` table + `link_issue`/`list_linked_issues` span Task 1 and Task 4.
- **Spec point 4 (one Artifact Manifest for path control + dedupe):** Task 5 — `export_manifest` (delegates to core `manifest_rows`), `detect_path_collisions`, `duplicate_report` (view over core `find_duplicate_hashes`).
- **Spec point 5 (every Analysis claim points to exact evidence anchors):** Task 6 — `Claim{text, anchor_ids}` and `check_claim_anchoring` verify each anchor exists (core `EvidenceAnchor` table) and belongs to the analysis artefact's matter; returns the unanchored claims (empty == compliant).
- **Placeholder scan:** none — every step ships complete, runnable code and an exact `pytest` command with an expected result. No `TODO`/`...`/stub bodies.
- **Type-consistency note:** all artefact/anchor/id/hash/manifest symbols (`ArtefactClass`, `Artefact`, `add_artefact`, `get_artefact`, `add_anchor`, `new_id`, `sha256_file`, `manifest_rows`, `find_duplicate_hashes`, `ImmutableOriginalError`) are imported verbatim from the `evidence_agent.core` package re-export surface — none are re-declared here. Governance owns only `custody_events` + `linked_issues` (Task 1 schema), the `CustodyEvent`/`Claim` dataclasses, and `LineageError`. Determinism: custody timestamps and actor are caller-supplied parameters; tests assert structure/keys and never assert the core-generated `created_at` value.
```
