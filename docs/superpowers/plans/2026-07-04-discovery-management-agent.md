# Discovery Management Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Discovery Management Agent — a single-source-of-truth Discovery Register, per-production receipt checks (including file-integrity via SHA-256), a redaction schedule, and a pure, deterministic escalation queue that surfaces overdue and deficient responses.

**Architecture:** This `discovery` package sits on top of the already-built shared `core` substrate (`src/evidence_agent/core/`). It owns three SQLite tables (`discovery_requests`, `receipt_checks`, `redaction_schedule`) created by `init_discovery_schema(conn)` — it does **not** edit `core/db.py`. IDs and hashing come from `core` (`new_id`, `sha256_file`). The register is the canonical record; receipts and redactions link back to a request; the escalation queue is a *pure function* over the register + receipts, taking `today` as an argument so tests are deterministic. No `datetime.now()` is ever called inside the escalation logic.

**Tech Stack:** Python 3.12, standard library only (`sqlite3`, `dataclasses`, `enum`, `datetime`, `pathlib`). No third-party dependencies. Tests: `pytest` via `/Users/spot/evidence-agent/.venv/bin/python -m pytest`. Run every command from `/Users/spot/evidence-agent`.

**Imports reused verbatim from the core contract (do not redefine):**
`from evidence_agent.core import new_id, sha256_file`

---

## File Structure

- `src/evidence_agent/discovery/__init__.py` — package marker; re-exports the discovery contract (filled in Task 7).
- `src/evidence_agent/discovery/schema.py` — `init_discovery_schema(conn)`: creates `discovery_requests`, `receipt_checks`, `redaction_schedule`.
- `src/evidence_agent/discovery/register.py` — `OutcomeState` enum, `DiscoveryRequest` dataclass, `add_request`/`update_result`/`get_request`/`list_requests`.
- `src/evidence_agent/discovery/receipt.py` — `ReceiptCheck` dataclass, `record_receipt`, `receipt_ok`, `list_receipts`.
- `src/evidence_agent/discovery/redaction.py` — `RedactionEntry` dataclass, `add_redaction`, `list_redactions`.
- `src/evidence_agent/discovery/escalation.py` — `EscalationItem` dataclass, `build_escalation_queue(conn, matter_id, today)` (pure, deterministic).
- `tests/test_discovery_schema.py` — schema creation + idempotency.
- `tests/test_discovery_register.py` — add/get/list requests.
- `tests/test_discovery_update.py` — result transitions + outstanding flag.
- `tests/test_discovery_receipt.py` — receipt recording, integrity, `receipt_ok`.
- `tests/test_discovery_redaction.py` — redaction schedule rows.
- `tests/test_discovery_escalation.py` — overdue/deficient ranking, determinism.
- `tests/test_discovery_contract.py` — public re-exports importable.

All paths are relative to `/Users/spot/evidence-agent`. Each test module defines a small `dconn` fixture that depends on the shared core `conn` fixture (from `tests/conftest.py`) and calls `init_discovery_schema`.

---

### Task 1: Package skeleton + discovery schema

**Files:**
- Create: `src/evidence_agent/discovery/__init__.py`
- Create: `src/evidence_agent/discovery/schema.py`
- Test: `tests/test_discovery_schema.py`

- [ ] **Step 1: Create the package marker**

`src/evidence_agent/discovery/__init__.py`:
```python
"""Discovery Management Agent — register, receipts, redactions, escalation."""
```

- [ ] **Step 2: Write the failing test**

`tests/test_discovery_schema.py`:
```python
import pytest
from evidence_agent.discovery.schema import init_discovery_schema


@pytest.fixture
def dconn(conn):
    init_discovery_schema(conn)
    return conn


def _table_names(c):
    return {
        r[0]
        for r in c.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }


def test_schema_creates_discovery_tables(dconn):
    assert {
        "discovery_requests",
        "receipt_checks",
        "redaction_schedule",
    } <= _table_names(dconn)


def test_init_is_idempotent(dconn):
    init_discovery_schema(dconn)  # second call must not raise
    assert "discovery_requests" in _table_names(dconn)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_discovery_schema.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'evidence_agent.discovery.schema'`.

- [ ] **Step 4: Write minimal implementation**

`src/evidence_agent/discovery/schema.py`:
```python
from __future__ import annotations

import sqlite3

_SCHEMA = """
CREATE TABLE IF NOT EXISTS discovery_requests (
    request_id       TEXT PRIMARY KEY,
    matter_id        TEXT NOT NULL,
    date_requested   TEXT NOT NULL,
    due_date         TEXT NOT NULL,
    legal_basis      TEXT NOT NULL,
    item_sought      TEXT NOT NULL,
    response_date    TEXT,
    result           TEXT NOT NULL,
    outstanding      INTEGER NOT NULL DEFAULT 1,
    prejudice_impact TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_disc_req_matter ON discovery_requests(matter_id);

CREATE TABLE IF NOT EXISTS receipt_checks (
    receipt_id         TEXT PRIMARY KEY,
    matter_id          TEXT NOT NULL,
    request_id         TEXT NOT NULL REFERENCES discovery_requests(request_id),
    expected_sha256    TEXT NOT NULL,
    computed_sha256    TEXT NOT NULL,
    file_integrity     INTEGER NOT NULL,
    completeness       INTEGER NOT NULL,
    redactions_present INTEGER NOT NULL,
    answers_request    INTEGER NOT NULL,
    answers_note       TEXT NOT NULL DEFAULT '',
    created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_receipt_request ON receipt_checks(request_id);

CREATE TABLE IF NOT EXISTS redaction_schedule (
    redaction_id         TEXT PRIMARY KEY,
    matter_id            TEXT NOT NULL,
    request_id           TEXT NOT NULL REFERENCES discovery_requests(request_id),
    timestamp_range      TEXT NOT NULL,
    content_type_removed TEXT NOT NULL,
    asserted_basis       TEXT NOT NULL,
    authoriser           TEXT NOT NULL,
    challenge_status     TEXT NOT NULL DEFAULT 'Unchallenged',
    created_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_redaction_matter ON redaction_schedule(matter_id);
"""


def init_discovery_schema(conn: sqlite3.Connection) -> None:
    """Create the discovery tables (idempotent). Does not touch core tables."""
    conn.executescript(_SCHEMA)
    conn.commit()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_discovery_schema.py -v`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
git add src/evidence_agent/discovery/__init__.py src/evidence_agent/discovery/schema.py tests/test_discovery_schema.py
git commit -m "feat(discovery): package skeleton + discovery schema"
```

---

### Task 2: Discovery Register — enum, dataclass, add/get/list

**Files:**
- Create: `src/evidence_agent/discovery/register.py`
- Test: `tests/test_discovery_register.py`

- [ ] **Step 1: Write the failing test**

`tests/test_discovery_register.py`:
```python
import pytest
from evidence_agent.discovery.schema import init_discovery_schema
from evidence_agent.discovery.register import (
    OutcomeState, DiscoveryRequest, add_request, get_request, list_requests,
)


@pytest.fixture
def dconn(conn):
    init_discovery_schema(conn)
    return conn


def test_add_request_defaults_to_no_response(dconn):
    r = add_request(
        dconn, "M1", "2026-01-10", "2026-02-10",
        "Criminal Procedure Act s.110", "Full brief of evidence",
        prejudice_impact="Unable to advise on plea",
    )
    assert isinstance(r, DiscoveryRequest)
    assert r.request_id == "REQ-0001"
    assert r.result is OutcomeState.NO_RESPONSE
    assert r.outstanding is True
    assert r.response_date is None
    assert r.due_date == "2026-02-10"
    assert r.prejudice_impact == "Unable to advise on plea"
    assert get_request(dconn, "REQ-0001") == r


def test_get_missing_returns_none(dconn):
    assert get_request(dconn, "REQ-9999") is None


def test_outcome_state_has_exactly_five_fixed_values(dconn):
    assert {s.value for s in OutcomeState} == {
        "Produced", "Partially Produced", "Refused",
        "No Response", "Claimed Non-Existence",
    }


def test_list_requests_ordered_and_scoped(dconn):
    add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "Brief")
    add_request(dconn, "M1", "2026-01-11", "2026-02-11", "s.111", "Statements")
    add_request(dconn, "M2", "2026-01-12", "2026-02-12", "s.112", "Exhibits")
    ids = [r.request_id for r in list_requests(dconn, "M1")]
    assert ids == ["REQ-0001", "REQ-0002"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_discovery_register.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'evidence_agent.discovery.register'`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/discovery/register.py`:
```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_discovery_register.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/discovery/register.py tests/test_discovery_register.py
git commit -m "feat(discovery): register enum + add/get/list requests"
```

---

### Task 3: Register — record the outcome (`update_result`)

**Files:**
- Modify: `src/evidence_agent/discovery/register.py`
- Test: `tests/test_discovery_update.py`

- [ ] **Step 1: Write the failing test**

`tests/test_discovery_update.py`:
```python
import pytest
from evidence_agent.discovery.schema import init_discovery_schema
from evidence_agent.discovery.register import (
    OutcomeState, add_request, update_result, get_request,
)


@pytest.fixture
def dconn(conn):
    init_discovery_schema(conn)
    return conn


def test_produced_clears_outstanding_and_sets_response_date(dconn):
    add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "Brief")
    r = update_result(dconn, "REQ-0001", OutcomeState.PRODUCED, "2026-02-05")
    assert r.result is OutcomeState.PRODUCED
    assert r.response_date == "2026-02-05"
    assert r.outstanding is False
    assert get_request(dconn, "REQ-0001") == r


def test_refused_stays_outstanding_and_preserves_prejudice(dconn):
    add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "Brief",
                prejudice_impact="orig")
    r = update_result(dconn, "REQ-0001", OutcomeState.REFUSED, "2026-02-06")
    assert r.outstanding is True
    assert r.prejudice_impact == "orig"  # preserved when not supplied


def test_prejudice_can_be_updated(dconn):
    add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "Brief")
    r = update_result(dconn, "REQ-0001", OutcomeState.PARTIALLY_PRODUCED,
                      "2026-02-07", prejudice_impact="Missing CCTV frames")
    assert r.prejudice_impact == "Missing CCTV frames"


def test_unknown_request_raises_keyerror(dconn):
    with pytest.raises(KeyError):
        update_result(dconn, "REQ-9999", OutcomeState.PRODUCED, "2026-02-05")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_discovery_update.py -v`
Expected: FAIL — `ImportError: cannot import name 'update_result' from 'evidence_agent.discovery.register'`.

- [ ] **Step 3: Write minimal implementation**

Append this function to `src/evidence_agent/discovery/register.py` (no other lines change):
```python
def update_result(
    conn: sqlite3.Connection, request_id: str, result: OutcomeState,
    response_date: str, *, outstanding: bool | None = None,
    prejudice_impact: str | None = None,
) -> DiscoveryRequest:
    """Record a response outcome. `outstanding` defaults to (result is not Produced);
    `prejudice_impact` is preserved when not supplied."""
    current = get_request(conn, request_id)
    if current is None:
        raise KeyError(request_id)
    if outstanding is None:
        outstanding = result is not OutcomeState.PRODUCED
    if prejudice_impact is None:
        prejudice_impact = current.prejudice_impact
    conn.execute(
        "UPDATE discovery_requests SET result = ?, response_date = ?, "
        "outstanding = ?, prejudice_impact = ? WHERE request_id = ?",
        (result.value, response_date, int(outstanding), prejudice_impact, request_id),
    )
    conn.commit()
    return get_request(conn, request_id)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_discovery_update.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/discovery/register.py tests/test_discovery_update.py
git commit -m "feat(discovery): record outcome via update_result"
```

---

### Task 4: Receipt check (with file-integrity via core `sha256_file`)

**Files:**
- Create: `src/evidence_agent/discovery/receipt.py`
- Test: `tests/test_discovery_receipt.py`

- [ ] **Step 1: Write the failing test**

`tests/test_discovery_receipt.py`:
```python
import pytest
from evidence_agent.core import sha256_file
from evidence_agent.discovery.schema import init_discovery_schema
from evidence_agent.discovery.register import add_request
from evidence_agent.discovery.receipt import (
    ReceiptCheck, record_receipt, receipt_ok, list_receipts,
)


@pytest.fixture
def dconn(conn):
    init_discovery_schema(conn)
    return conn


def _request(dconn):
    return add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "Brief")


def test_record_receipt_integrity_pass(dconn, tmp_path):
    _request(dconn)
    p = tmp_path / "production.pdf"
    p.write_bytes(b"disclosed material")
    expected = sha256_file(p)
    rc = record_receipt(
        dconn, "M1", "REQ-0001", p, expected,
        completeness=True, redactions_present=False, answers_request=True,
    )
    assert isinstance(rc, ReceiptCheck)
    assert rc.receipt_id == "RCP-0001"
    assert rc.file_integrity is True
    assert rc.computed_sha256 == expected
    assert receipt_ok(rc) is True


def test_record_receipt_integrity_fail_on_hash_mismatch(dconn, tmp_path):
    _request(dconn)
    p = tmp_path / "production.pdf"
    p.write_bytes(b"tampered material")
    rc = record_receipt(
        dconn, "M1", "REQ-0001", p, "deadbeef",
        completeness=True, redactions_present=True, answers_request=True,
    )
    assert rc.file_integrity is False
    assert receipt_ok(rc) is False


def test_receipt_ok_requires_answers_request(dconn, tmp_path):
    _request(dconn)
    p = tmp_path / "production.pdf"
    p.write_bytes(b"x")
    rc = record_receipt(
        dconn, "M1", "REQ-0001", p, sha256_file(p),
        completeness=True, redactions_present=False, answers_request=False,
        answers_note="Does not cover the CCTV sought",
    )
    assert receipt_ok(rc) is False
    assert rc.answers_note == "Does not cover the CCTV sought"
    assert list_receipts(dconn, "REQ-0001") == [rc]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_discovery_receipt.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'evidence_agent.discovery.receipt'`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/discovery/receipt.py`:
```python
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from evidence_agent.core import new_id, sha256_file


@dataclass(frozen=True)
class ReceiptCheck:
    receipt_id: str
    matter_id: str
    request_id: str
    expected_sha256: str
    computed_sha256: str
    file_integrity: bool
    completeness: bool
    redactions_present: bool
    answers_request: bool
    answers_note: str
    created_at: str


def _row_to_receipt(row: sqlite3.Row) -> ReceiptCheck:
    return ReceiptCheck(
        receipt_id=row["receipt_id"],
        matter_id=row["matter_id"],
        request_id=row["request_id"],
        expected_sha256=row["expected_sha256"],
        computed_sha256=row["computed_sha256"],
        file_integrity=bool(row["file_integrity"]),
        completeness=bool(row["completeness"]),
        redactions_present=bool(row["redactions_present"]),
        answers_request=bool(row["answers_request"]),
        answers_note=row["answers_note"],
        created_at=row["created_at"],
    )


def record_receipt(
    conn: sqlite3.Connection, matter_id: str, request_id: str,
    produced_path: str | Path, expected_sha256: str, *,
    completeness: bool, redactions_present: bool, answers_request: bool,
    answers_note: str = "",
) -> ReceiptCheck:
    """Check a single production: hash the produced file (core sha256_file) and
    compare to the expected hash for file_integrity; record all four checks."""
    computed = sha256_file(produced_path)
    file_integrity = computed == expected_sha256
    receipt_id = new_id(conn, "RCP")
    created_at = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO receipt_checks(receipt_id, matter_id, request_id, "
        "expected_sha256, computed_sha256, file_integrity, completeness, "
        "redactions_present, answers_request, answers_note, created_at) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        (receipt_id, matter_id, request_id, expected_sha256, computed,
         int(file_integrity), int(completeness), int(redactions_present),
         int(answers_request), answers_note, created_at),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM receipt_checks WHERE receipt_id = ?", (receipt_id,)
    ).fetchone()
    return _row_to_receipt(row)


def receipt_ok(rc: ReceiptCheck) -> bool:
    """A production passes receipt iff it is complete, intact, and on-point.
    (redactions_present is informational and does not, alone, fail the check.)"""
    return rc.completeness and rc.file_integrity and rc.answers_request


def list_receipts(conn: sqlite3.Connection, request_id: str) -> list[ReceiptCheck]:
    rows = conn.execute(
        "SELECT * FROM receipt_checks WHERE request_id = ? ORDER BY receipt_id",
        (request_id,),
    ).fetchall()
    return [_row_to_receipt(r) for r in rows]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_discovery_receipt.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/discovery/receipt.py tests/test_discovery_receipt.py
git commit -m "feat(discovery): production receipt check with file integrity"
```

---

### Task 5: Redaction schedule

**Files:**
- Create: `src/evidence_agent/discovery/redaction.py`
- Test: `tests/test_discovery_redaction.py`

- [ ] **Step 1: Write the failing test**

`tests/test_discovery_redaction.py`:
```python
import pytest
from evidence_agent.discovery.schema import init_discovery_schema
from evidence_agent.discovery.register import add_request
from evidence_agent.discovery.redaction import (
    RedactionEntry, add_redaction, list_redactions,
)


@pytest.fixture
def dconn(conn):
    init_discovery_schema(conn)
    return conn


def test_add_redaction_defaults_unchallenged(dconn):
    add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "Body-worn footage")
    red = add_redaction(
        dconn, "M1", "REQ-0001", "00:04:10-00:05:00",
        "Third-party face", "Privacy — s.32 PDP Act", "Sgt Adams",
    )
    assert isinstance(red, RedactionEntry)
    assert red.redaction_id == "RED-0001"
    assert red.challenge_status == "Unchallenged"
    assert red.authoriser == "Sgt Adams"
    assert red.content_type_removed == "Third-party face"


def test_list_redactions_ordered_and_scoped(dconn):
    add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "Footage")
    add_redaction(dconn, "M1", "REQ-0001", "00:00-00:10", "Audio", "PII", "A",
                  challenge_status="Challenged")
    add_redaction(dconn, "M1", "REQ-0001", "00:10-00:20", "Face", "Privacy", "B")
    reds = list_redactions(dconn, "M1")
    assert [r.redaction_id for r in reds] == ["RED-0001", "RED-0002"]
    assert reds[0].challenge_status == "Challenged"
    assert list_redactions(dconn, "M2") == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_discovery_redaction.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'evidence_agent.discovery.redaction'`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/discovery/redaction.py`:
```python
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone

from evidence_agent.core import new_id


@dataclass(frozen=True)
class RedactionEntry:
    redaction_id: str
    matter_id: str
    request_id: str
    timestamp_range: str
    content_type_removed: str
    asserted_basis: str
    authoriser: str
    challenge_status: str
    created_at: str


def _row_to_redaction(row: sqlite3.Row) -> RedactionEntry:
    return RedactionEntry(
        redaction_id=row["redaction_id"],
        matter_id=row["matter_id"],
        request_id=row["request_id"],
        timestamp_range=row["timestamp_range"],
        content_type_removed=row["content_type_removed"],
        asserted_basis=row["asserted_basis"],
        authoriser=row["authoriser"],
        challenge_status=row["challenge_status"],
        created_at=row["created_at"],
    )


def add_redaction(
    conn: sqlite3.Connection, matter_id: str, request_id: str,
    timestamp_range: str, content_type_removed: str, asserted_basis: str,
    authoriser: str, *, challenge_status: str = "Unchallenged",
) -> RedactionEntry:
    """Record one redaction against a produced item."""
    redaction_id = new_id(conn, "RED")
    created_at = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO redaction_schedule(redaction_id, matter_id, request_id, "
        "timestamp_range, content_type_removed, asserted_basis, authoriser, "
        "challenge_status, created_at) VALUES(?,?,?,?,?,?,?,?,?)",
        (redaction_id, matter_id, request_id, timestamp_range, content_type_removed,
         asserted_basis, authoriser, challenge_status, created_at),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM redaction_schedule WHERE redaction_id = ?", (redaction_id,)
    ).fetchone()
    return _row_to_redaction(row)


def list_redactions(conn: sqlite3.Connection, matter_id: str) -> list[RedactionEntry]:
    rows = conn.execute(
        "SELECT * FROM redaction_schedule WHERE matter_id = ? ORDER BY redaction_id",
        (matter_id,),
    ).fetchall()
    return [_row_to_redaction(r) for r in rows]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_discovery_redaction.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/discovery/redaction.py tests/test_discovery_redaction.py
git commit -m "feat(discovery): redaction schedule"
```

---

### Task 6: Escalation queue (pure, deterministic)

**Files:**
- Create: `src/evidence_agent/discovery/escalation.py`
- Test: `tests/test_discovery_escalation.py`

- [ ] **Step 1: Write the failing test**

`tests/test_discovery_escalation.py`:
```python
import pytest
from evidence_agent.core import sha256_file
from evidence_agent.discovery.schema import init_discovery_schema
from evidence_agent.discovery.register import (
    OutcomeState, add_request, update_result,
)
from evidence_agent.discovery.receipt import record_receipt
from evidence_agent.discovery.escalation import (
    EscalationItem, build_escalation_queue,
)


@pytest.fixture
def dconn(conn):
    init_discovery_schema(conn)
    return conn


def test_overdue_no_response_is_escalated(dconn):
    add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "Brief")
    queue = build_escalation_queue(dconn, "M1", today="2026-03-01")
    assert len(queue) == 1
    assert queue[0].request_id == "REQ-0001"
    assert queue[0].reason == "OVERDUE"
    assert queue[0].priority == 1
    assert "past due date 2026-02-10" in queue[0].detail


def test_no_response_before_due_date_is_not_escalated(dconn):
    add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "Brief")
    assert build_escalation_queue(dconn, "M1", today="2026-01-20") == []


def test_produced_with_clean_receipt_is_not_escalated(dconn, tmp_path):
    add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "Brief")
    update_result(dconn, "REQ-0001", OutcomeState.PRODUCED, "2026-02-05")
    p = tmp_path / "prod.pdf"
    p.write_bytes(b"ok")
    record_receipt(dconn, "M1", "REQ-0001", p, sha256_file(p),
                   completeness=True, redactions_present=False, answers_request=True)
    assert build_escalation_queue(dconn, "M1", today="2026-03-01") == []


def test_failed_receipt_on_produced_is_deficient(dconn, tmp_path):
    add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "Brief")
    update_result(dconn, "REQ-0001", OutcomeState.PRODUCED, "2026-02-05")
    p = tmp_path / "prod.pdf"
    p.write_bytes(b"tampered")
    record_receipt(dconn, "M1", "REQ-0001", p, "deadbeef",
                   completeness=True, redactions_present=False, answers_request=True)
    queue = build_escalation_queue(dconn, "M1", today="2026-03-01")
    assert [i.reason for i in queue] == ["FAILED_RECEIPT"]
    assert queue[0].priority == 2


def test_queue_ranked_by_priority_then_id(dconn):
    add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "A")  # overdue -> 1
    add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "B")
    update_result(dconn, "REQ-0002", OutcomeState.REFUSED, "2026-02-05")  # -> 2
    add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "C")
    update_result(dconn, "REQ-0003", OutcomeState.PARTIALLY_PRODUCED, "2026-02-05")  # 3
    queue = build_escalation_queue(dconn, "M1", today="2026-03-01")
    assert [(i.request_id, i.priority) for i in queue] == [
        ("REQ-0001", 1), ("REQ-0002", 2), ("REQ-0003", 3),
    ]


def test_deterministic_given_today(dconn):
    add_request(dconn, "M1", "2026-01-10", "2026-02-10", "s.110", "A")
    q1 = build_escalation_queue(dconn, "M1", today="2026-03-01")
    q2 = build_escalation_queue(dconn, "M1", today="2026-03-01")
    assert q1 == q2
    assert isinstance(q1[0], EscalationItem)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_discovery_escalation.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'evidence_agent.discovery.escalation'`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/discovery/escalation.py`:
```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_discovery_escalation.py -v`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/discovery/escalation.py tests/test_discovery_escalation.py
git commit -m "feat(discovery): deterministic escalation queue"
```

---

### Task 7: Re-export the discovery contract

**Files:**
- Modify: `src/evidence_agent/discovery/__init__.py`
- Test: `tests/test_discovery_contract.py`

- [ ] **Step 1: Write the failing test**

`tests/test_discovery_contract.py`:
```python
def test_discovery_contract_importable():
    from evidence_agent.discovery import (
        init_discovery_schema,
        OutcomeState, DiscoveryRequest,
        add_request, update_result, get_request, list_requests,
        ReceiptCheck, record_receipt, receipt_ok, list_receipts,
        RedactionEntry, add_redaction, list_redactions,
        EscalationItem, build_escalation_queue,
    )
    assert OutcomeState.CLAIMED_NON_EXISTENCE.value == "Claimed Non-Existence"
    assert {s.value for s in OutcomeState} == {
        "Produced", "Partially Produced", "Refused",
        "No Response", "Claimed Non-Existence",
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_discovery_contract.py -v`
Expected: FAIL — `ImportError: cannot import name 'init_discovery_schema' from 'evidence_agent.discovery'`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/discovery/__init__.py`:
```python
"""Discovery Management Agent — register, receipts, redactions, escalation."""
from evidence_agent.discovery.schema import init_discovery_schema
from evidence_agent.discovery.register import (
    OutcomeState, DiscoveryRequest,
    add_request, update_result, get_request, list_requests,
)
from evidence_agent.discovery.receipt import (
    ReceiptCheck, record_receipt, receipt_ok, list_receipts,
)
from evidence_agent.discovery.redaction import (
    RedactionEntry, add_redaction, list_redactions,
)
from evidence_agent.discovery.escalation import (
    EscalationItem, build_escalation_queue,
)

__all__ = [
    "init_discovery_schema",
    "OutcomeState", "DiscoveryRequest",
    "add_request", "update_result", "get_request", "list_requests",
    "ReceiptCheck", "record_receipt", "receipt_ok", "list_receipts",
    "RedactionEntry", "add_redaction", "list_redactions",
    "EscalationItem", "build_escalation_queue",
]
```

- [ ] **Step 4: Run the whole discovery suite**

Run: `.venv/bin/python -m pytest tests/test_discovery_contract.py tests/test_discovery_schema.py tests/test_discovery_register.py tests/test_discovery_update.py tests/test_discovery_receipt.py tests/test_discovery_redaction.py tests/test_discovery_escalation.py -v`
Expected: PASS (all discovery tests green).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/discovery/__init__.py tests/test_discovery_contract.py
git commit -m "feat(discovery): re-export discovery contract"
```

---

## Self-Review

**Spec coverage (each of the 5 points maps to a task):**
1. *Discovery Register as single source of truth* — Tasks 2 & 3: `discovery_requests` table + `DiscoveryRequest(request_id, date_requested, legal_basis, item_sought, response_date, result, outstanding, prejudice_impact)`. A `due_date` column is added (not in the raw field list) because point 5 requires an OVERDUE cutoff; all listed fields are present.
2. *Fixed outcome enum* — Task 2: `OutcomeState` with exactly the five values `Produced, Partially Produced, Refused, No Response, Claimed Non-Existence` (asserted in `test_outcome_state_has_exactly_five_fixed_values` and `test_discovery_contract`).
3. *Receipt check per production* — Task 4: `record_receipt` stores completeness, redactions_present, answers_request (+ note), and `file_integrity` computed by hashing the produced file with core `sha256_file` and comparing to `expected_sha256`; `receipt_ok` summarises pass/fail.
4. *Redaction schedule* — Task 5: `redaction_schedule` table + `RedactionEntry(timestamp_range, content_type_removed, asserted_basis, authoriser, challenge_status)`, one row per redaction.
5. *Auto-generated escalation queue* — Task 6: `build_escalation_queue(conn, matter_id, today)` — a pure function over the register + receipts flagging OVERDUE (No Response past `due_date`) and DEFICIENT (Refused / Partially Produced / failed receipt check), returning a list ranked by `(priority, request_id)`. `today` is a parameter; no `datetime.now()` is called inside it.

**Placeholder scan:** none — every step ships complete, runnable code and an exact command. No TODO/TBD/"similar to Task N" text anywhere.

**Type consistency:** Core names are imported verbatim and never redefined — `new_id` and `sha256_file` from `evidence_agent.core`. Own tables are created only via `init_discovery_schema` (core `db.py` untouched). Symbols defined earlier are reused consistently downstream: `OutcomeState`/`list_requests` (Task 2) feed `build_escalation_queue` (Task 6); `list_receipts`/`receipt_ok` (Task 4) feed the FAILED_RECEIPT branch (Task 6); every public name re-exported in Task 7 matches its defining module. Boolean fields are stored as `INTEGER` and rehydrated with `bool(...)`; `response_date` is nullable and returned as `None` when unset. Each test module defines its own `dconn` fixture depending on the shared core `conn` fixture, per the conventions.
