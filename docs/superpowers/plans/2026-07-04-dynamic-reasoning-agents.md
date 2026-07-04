# Dynamic Reasoning Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fresh, dedicated reasoning engine (NOT the bridge deliberation loop) that models each contested point as a Hypothesis Node, runs three analysis chains over it in parallel (prosecution-favourable, defence-favourable, neutral), scores confidence and dependency-risk, keeps an append-only decision log, and emits a hearing-ready Element→Evidence→Admissibility→Contradiction→Utility matrix.

**Architecture:** A `reasoning` package under `src/evidence_agent/reasoning/` layered on the shared core substrate. Its own SQLite tables (`hypothesis_nodes`, `chain_views`, `decision_log`) are created by `init_reasoning_schema(conn)`; it never edits core `db.py`. The three chains are produced by an **injected** callable `analyst(chain, node) -> ChainView` run under `concurrent.futures.ThreadPoolExecutor(max_workers=3)`. A default production analyst may wrap a bridge provider (e.g. `providers.anthropic_client`), but every test in this plan passes a deterministic FAKE analyst — no network, no LLM. All scoring, matrix, and decision-log logic is PURE and unit-tested with fabricated inputs; timestamps and actors are passed in for determinism.

**Tech Stack:** Python 3.12, standard library only (`sqlite3`, `json`, `dataclasses`, `enum`, `datetime`, `concurrent.futures`). Tests: `pytest` via `/Users/spot/evidence-agent/.venv/bin/python -m pytest`.

**Imported core contract (verbatim — do not redefine):**
`from evidence_agent.core import db, ArtefactClass, Artefact, get_artefact, list_artefacts, EvidenceAnchor, add_anchor, list_anchors, new_id`

---

## File Structure

- `src/evidence_agent/reasoning/__init__.py` — re-exports the reasoning public surface.
- `src/evidence_agent/reasoning/schema.py` — `init_reasoning_schema(conn)` creating `hypothesis_nodes`, `chain_views`, `decision_log`.
- `src/evidence_agent/reasoning/hypothesis.py` — `HypothesisNode` dataclass + `add_node`/`get_node`/`list_nodes` (JSON-encodes the list fields).
- `src/evidence_agent/reasoning/chains.py` — `Chain` enum, `ChainView` dataclass, `run_chains(node, analyst)` (parallel), `persist_chain_views`.
- `src/evidence_agent/reasoning/scoring.py` — pure `score_confidence(node, chain_views)` and `dependency_risk(node, support_map)`.
- `src/evidence_agent/reasoning/decisionlog.py` — append-only `record_decision(...)` and `list_decisions`.
- `src/evidence_agent/reasoning/matrix.py` — pure `build_matrix(conn, node) -> list[dict]`.
- `src/evidence_agent/reasoning/engine.py` — `run_reasoning(conn, node, analyst)` orchestrating chains → scoring → persistence → matrix.
- `tests/test_reasoning_*.py` — one test module per task, each with its own `rconn` fixture.

All paths are relative to `/Users/spot/evidence-agent`. Run every command from that directory.

---

### Task 1: Reasoning package skeleton + schema

**Files:**
- Create: `src/evidence_agent/reasoning/__init__.py`
- Create: `src/evidence_agent/reasoning/schema.py`
- Test: `tests/test_reasoning_schema.py`

- [ ] **Step 1: Write the failing test**

`tests/test_reasoning_schema.py`:
```python
import pytest
from evidence_agent.reasoning.schema import init_reasoning_schema


@pytest.fixture
def rconn(conn):
    init_reasoning_schema(conn)
    return conn


def test_reasoning_tables_created(rconn):
    names = {
        r[0]
        for r in rconn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    assert {"hypothesis_nodes", "chain_views", "decision_log"} <= names


def test_init_is_idempotent(rconn):
    init_reasoning_schema(rconn)  # second call must not raise
    assert rconn.execute("SELECT COUNT(*) FROM hypothesis_nodes").fetchone()[0] == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_reasoning_schema.py -v`
Expected: FAIL — `ModuleNotFoundError: evidence_agent.reasoning.schema`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/reasoning/__init__.py`:
```python
"""Dynamic reasoning agents — hypothesis nodes, parallel chains, scoring, matrices."""
```

`src/evidence_agent/reasoning/schema.py`:
```python
from __future__ import annotations

import sqlite3

_SCHEMA = """
CREATE TABLE IF NOT EXISTS hypothesis_nodes (
    id                      TEXT PRIMARY KEY,
    matter_id               TEXT NOT NULL,
    claim                   TEXT NOT NULL,
    required_legal_elements TEXT NOT NULL DEFAULT '[]',
    supporting_artefacts    TEXT NOT NULL DEFAULT '[]',
    contrary_artefacts      TEXT NOT NULL DEFAULT '[]',
    unknowns                TEXT NOT NULL DEFAULT '[]',
    next_test               TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS chain_views (
    id         TEXT PRIMARY KEY,
    node_id    TEXT NOT NULL REFERENCES hypothesis_nodes(id),
    chain      TEXT NOT NULL,
    position   TEXT NOT NULL,
    relied_on  TEXT NOT NULL DEFAULT '[]',
    weaknesses TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS ix_chain_views_node ON chain_views(node_id);
CREATE TABLE IF NOT EXISTS decision_log (
    id               TEXT PRIMARY KEY,
    node_id          TEXT NOT NULL REFERENCES hypothesis_nodes(id),
    old_confidence   REAL NOT NULL,
    new_confidence   REAL NOT NULL,
    trigger_evidence TEXT NOT NULL,
    reason           TEXT NOT NULL,
    timestamp        TEXT NOT NULL,
    actor            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_decision_log_node ON decision_log(node_id);
"""


def init_reasoning_schema(conn: sqlite3.Connection) -> None:
    """Create the reasoning tables. Idempotent; never touches core tables."""
    conn.executescript(_SCHEMA)
    conn.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_reasoning_schema.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/reasoning/__init__.py src/evidence_agent/reasoning/schema.py tests/test_reasoning_schema.py
git commit -m "feat(reasoning): package skeleton + schema"
```

---

### Task 2: Hypothesis nodes (dataclass + add/get/list)

**Files:**
- Create: `src/evidence_agent/reasoning/hypothesis.py`
- Test: `tests/test_reasoning_hypothesis.py`

- [ ] **Step 1: Write the failing test**

`tests/test_reasoning_hypothesis.py`:
```python
import pytest
from evidence_agent.reasoning.schema import init_reasoning_schema
from evidence_agent.reasoning.hypothesis import (
    HypothesisNode, add_node, get_node, list_nodes,
)


@pytest.fixture
def rconn(conn):
    init_reasoning_schema(conn)
    return conn


def test_add_and_get_roundtrip(rconn):
    node = add_node(
        rconn, "M1",
        claim="the search was warrantless and unlawful",
        required_legal_elements=["lawful search", "possession"],
        supporting_artefacts=["ART-0001", "ART-0002"],
        contrary_artefacts=["ART-0003"],
        unknowns=["was consent given?"],
        next_test="obtain the running sheet",
    )
    assert node.id.startswith("HYP-")
    assert node.required_legal_elements == ["lawful search", "possession"]
    assert node.supporting_artefacts == ["ART-0001", "ART-0002"]
    got = get_node(rconn, node.id)
    assert got == node
    assert isinstance(got, HypothesisNode)


def test_list_nodes_by_matter(rconn):
    add_node(rconn, "M1", "a", ["e"], [], [], [], "")
    add_node(rconn, "M1", "b", ["e"], [], [], [], "")
    add_node(rconn, "M2", "c", ["e"], [], [], [], "")
    assert len(list_nodes(rconn, "M1")) == 2
    assert len(list_nodes(rconn, "M2")) == 1


def test_missing_node_returns_none(rconn):
    assert get_node(rconn, "HYP-9999") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_reasoning_hypothesis.py -v`
Expected: FAIL — `ModuleNotFoundError: evidence_agent.reasoning.hypothesis`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/reasoning/hypothesis.py`:
```python
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass

from evidence_agent.core import new_id


@dataclass(frozen=True)
class HypothesisNode:
    id: str
    matter_id: str
    claim: str
    required_legal_elements: list
    supporting_artefacts: list
    contrary_artefacts: list
    unknowns: list
    next_test: str


def _row_to_node(row: sqlite3.Row) -> HypothesisNode:
    return HypothesisNode(
        id=row["id"],
        matter_id=row["matter_id"],
        claim=row["claim"],
        required_legal_elements=json.loads(row["required_legal_elements"]),
        supporting_artefacts=json.loads(row["supporting_artefacts"]),
        contrary_artefacts=json.loads(row["contrary_artefacts"]),
        unknowns=json.loads(row["unknowns"]),
        next_test=row["next_test"],
    )


def add_node(
    conn: sqlite3.Connection,
    matter_id: str,
    claim: str,
    required_legal_elements: list,
    supporting_artefacts: list,
    contrary_artefacts: list,
    unknowns: list,
    next_test: str,
) -> HypothesisNode:
    nid = new_id(conn, "HYP")
    conn.execute(
        "INSERT INTO hypothesis_nodes(id, matter_id, claim, required_legal_elements, "
        "supporting_artefacts, contrary_artefacts, unknowns, next_test) "
        "VALUES(?,?,?,?,?,?,?,?)",
        (
            nid, matter_id, claim,
            json.dumps(required_legal_elements),
            json.dumps(supporting_artefacts),
            json.dumps(contrary_artefacts),
            json.dumps(unknowns),
            next_test,
        ),
    )
    conn.commit()
    return get_node(conn, nid)


def get_node(conn: sqlite3.Connection, node_id: str) -> HypothesisNode | None:
    row = conn.execute(
        "SELECT * FROM hypothesis_nodes WHERE id = ?", (node_id,)
    ).fetchone()
    return _row_to_node(row) if row else None


def list_nodes(conn: sqlite3.Connection, matter_id: str) -> list[HypothesisNode]:
    rows = conn.execute(
        "SELECT * FROM hypothesis_nodes WHERE matter_id = ? ORDER BY id",
        (matter_id,),
    ).fetchall()
    return [_row_to_node(r) for r in rows]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_reasoning_hypothesis.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/reasoning/hypothesis.py tests/test_reasoning_hypothesis.py
git commit -m "feat(reasoning): hypothesis node dataclass + add/get/list"
```

---

### Task 3: Parallel chains (Chain enum, ChainView, run_chains, persist)

**Files:**
- Create: `src/evidence_agent/reasoning/chains.py`
- Test: `tests/test_reasoning_chains.py`

- [ ] **Step 1: Write the failing test**

`tests/test_reasoning_chains.py`:
```python
import pytest
from evidence_agent.reasoning.schema import init_reasoning_schema
from evidence_agent.reasoning.hypothesis import add_node
from evidence_agent.reasoning.chains import (
    Chain, ChainView, run_chains, persist_chain_views,
)


@pytest.fixture
def rconn(conn):
    init_reasoning_schema(conn)
    return conn


def fake_analyst(chain: Chain, node) -> ChainView:
    """Deterministic stand-in for the production LLM-backed analyst."""
    positions = {
        Chain.PROSECUTION: "every element is made out",
        Chain.DEFENCE: "the search was unlawful; exclude the tender",
        Chain.NEUTRAL: "outcome turns on the lawfulness of the search",
    }
    return ChainView(
        chain=chain,
        position=positions[chain],
        relied_on=list(node.supporting_artefacts),
        weaknesses=["chain of custody gap"] if chain is Chain.DEFENCE else [],
    )


def _node(rconn):
    return add_node(
        rconn, "M1", "warrantless search", ["lawful search"],
        ["ART-0001", "ART-0002"], ["ART-0003"], [], "get running sheet",
    )


def test_run_chains_returns_all_three(rconn):
    node = _node(rconn)
    views = run_chains(node, fake_analyst)
    assert set(views) == {Chain.PROSECUTION, Chain.DEFENCE, Chain.NEUTRAL}
    assert views[Chain.DEFENCE].weaknesses == ["chain of custody gap"]
    assert views[Chain.PROSECUTION].relied_on == ["ART-0001", "ART-0002"]


def test_persist_chain_views_roundtrip(rconn):
    node = _node(rconn)
    views = run_chains(node, fake_analyst)
    persist_chain_views(rconn, node.id, views)
    rows = rconn.execute(
        "SELECT chain, position FROM chain_views WHERE node_id = ? ORDER BY chain",
        (node.id,),
    ).fetchall()
    assert [r["chain"] for r in rows] == ["defence", "neutral", "prosecution"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_reasoning_chains.py -v`
Expected: FAIL — `ModuleNotFoundError: evidence_agent.reasoning.chains`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/reasoning/chains.py`:
```python
from __future__ import annotations

import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from enum import Enum
from typing import Callable

from evidence_agent.core import new_id
from evidence_agent.reasoning.hypothesis import HypothesisNode


class Chain(Enum):
    PROSECUTION = "prosecution"
    DEFENCE = "defence"
    NEUTRAL = "neutral"


@dataclass(frozen=True)
class ChainView:
    chain: Chain
    position: str
    relied_on: list
    weaknesses: list


# Injected callable signature. Tests pass a deterministic fake; the default
# production analyst may wrap a bridge provider (e.g. providers.anthropic_client).
Analyst = Callable[[Chain, HypothesisNode], ChainView]


def run_chains(node: HypothesisNode, analyst: Analyst) -> dict[Chain, ChainView]:
    """Run the three chains IN PARALLEL over one node via the injected analyst."""
    chains = [Chain.PROSECUTION, Chain.DEFENCE, Chain.NEUTRAL]
    with ThreadPoolExecutor(max_workers=3) as ex:
        results = ex.map(lambda ch: analyst(ch, node), chains)
    return {ch: view for ch, view in zip(chains, results)}


def persist_chain_views(
    conn: sqlite3.Connection, node_id: str, views: dict[Chain, ChainView]
) -> None:
    for chain, view in views.items():
        conn.execute(
            "INSERT INTO chain_views(id, node_id, chain, position, relied_on, weaknesses) "
            "VALUES(?,?,?,?,?,?)",
            (
                new_id(conn, "CV"), node_id, chain.value, view.position,
                json.dumps(view.relied_on), json.dumps(view.weaknesses),
            ),
        )
    conn.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_reasoning_chains.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/reasoning/chains.py tests/test_reasoning_chains.py
git commit -m "feat(reasoning): parallel chains via injected analyst + persistence"
```

---

### Task 4: Pure scoring (confidence + dependency risk)

**Files:**
- Create: `src/evidence_agent/reasoning/scoring.py`
- Test: `tests/test_reasoning_scoring.py`

- [ ] **Step 1: Write the failing test**

`tests/test_reasoning_scoring.py`:
```python
from evidence_agent.reasoning.hypothesis import HypothesisNode
from evidence_agent.reasoning.chains import Chain, ChainView
from evidence_agent.reasoning.scoring import score_confidence, dependency_risk


def _node(supporting, contrary, unknowns):
    return HypothesisNode(
        id="HYP-0001", matter_id="M1", claim="c",
        required_legal_elements=["e"],
        supporting_artefacts=supporting,
        contrary_artefacts=contrary,
        unknowns=unknowns,
        next_test="",
    )


def _view(chain, weaknesses):
    return ChainView(chain=chain, position="p", relied_on=[], weaknesses=weaknesses)


def test_score_confidence_pure_formula():
    node = _node(["A", "B", "C"], ["D"], [])          # base = 3/4 = 0.75
    views = {
        Chain.PROSECUTION: _view(Chain.PROSECUTION, []),
        Chain.DEFENCE: _view(Chain.DEFENCE, ["w1"]),   # 1 weakness -> -0.05
        Chain.NEUTRAL: _view(Chain.NEUTRAL, []),
    }
    assert score_confidence(node, views) == 0.70


def test_score_confidence_clamped_and_zero_support():
    node = _node([], ["D"], ["u1", "u2"])              # base 0, penalties clamp at 0
    views = {}
    assert score_confidence(node, views) == 0.0


def test_dependency_risk_picks_biggest_contributor():
    node = _node(["A", "B", "C"], [], [])
    support_map = {"A": 1.0, "B": 3.0, "C": 1.0}       # total 5, B is critical
    assert dependency_risk(node, support_map) == {"critical_artefact": "B", "drop": 0.6}


def test_dependency_risk_ties_break_on_smallest_id():
    node = _node(["A", "B"], [], [])
    support_map = {"B": 2.0, "A": 2.0}                 # tie -> smallest id "A"
    assert dependency_risk(node, support_map)["critical_artefact"] == "A"


def test_dependency_risk_empty_map():
    node = _node([], [], [])
    assert dependency_risk(node, {}) == {"critical_artefact": None, "drop": 0.0}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_reasoning_scoring.py -v`
Expected: FAIL — `ModuleNotFoundError: evidence_agent.reasoning.scoring`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/reasoning/scoring.py`:
```python
from __future__ import annotations

from evidence_agent.reasoning.chains import Chain, ChainView
from evidence_agent.reasoning.hypothesis import HypothesisNode


def score_confidence(
    node: HypothesisNode, chain_views: dict[Chain, ChainView]
) -> float:
    """Pure confidence in [0, 1]: artefact balance minus unknown/weakness penalty."""
    support = len(node.supporting_artefacts)
    contrary = len(node.contrary_artefacts)
    total = support + contrary
    base = support / total if total else 0.0
    weakness_count = sum(len(v.weaknesses) for v in chain_views.values())
    penalty = 0.05 * len(node.unknowns) + 0.05 * weakness_count
    return round(max(0.0, min(1.0, base - penalty)), 4)


def dependency_risk(node: HypothesisNode, support_map: dict[str, float]) -> dict:
    """Identify the artefact whose removal most reduces support.

    `support_map` maps artefact id -> support weight. Returns the critical
    artefact and the fraction of total support lost if it is excluded. Ties
    break on the smallest artefact id for determinism.
    """
    if not support_map:
        return {"critical_artefact": None, "drop": 0.0}
    total = sum(support_map.values())
    critical = max(sorted(support_map), key=lambda k: support_map[k])
    drop = support_map[critical] / total if total else 0.0
    return {"critical_artefact": critical, "drop": round(drop, 4)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_reasoning_scoring.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/reasoning/scoring.py tests/test_reasoning_scoring.py
git commit -m "feat(reasoning): pure confidence + dependency-risk scoring"
```

---

### Task 5: Append-only decision log

**Files:**
- Create: `src/evidence_agent/reasoning/decisionlog.py`
- Test: `tests/test_reasoning_decisionlog.py`

- [ ] **Step 1: Write the failing test**

`tests/test_reasoning_decisionlog.py`:
```python
import pytest
from evidence_agent.reasoning.schema import init_reasoning_schema
from evidence_agent.reasoning.hypothesis import add_node
from evidence_agent.reasoning.decisionlog import record_decision, list_decisions


@pytest.fixture
def rconn(conn):
    init_reasoning_schema(conn)
    return conn


def _node(rconn):
    return add_node(rconn, "M1", "c", ["e"], [], [], [], "")


def test_record_and_list_in_order(rconn):
    node = _node(rconn)
    record_decision(
        rconn, node.id, 0.5, 0.7,
        trigger_evidence="ART-0007 running sheet",
        reason="running sheet corroborates timeline",
        timestamp="2026-07-04T09:00:00+00:00", actor="analyst-1",
    )
    record_decision(
        rconn, node.id, 0.7, 0.4,
        trigger_evidence="ART-0009 body-worn footage",
        reason="footage contradicts consent claim",
        timestamp="2026-07-04T10:00:00+00:00", actor="analyst-1",
    )
    log = list_decisions(rconn, node.id)
    assert [d["old_confidence"] for d in log] == [0.5, 0.7]
    assert [d["new_confidence"] for d in log] == [0.7, 0.4]
    assert log[0]["timestamp"] == "2026-07-04T09:00:00+00:00"
    assert log[1]["actor"] == "analyst-1"


def test_update_requires_new_evidence(rconn):
    node = _node(rconn)
    with pytest.raises(ValueError):
        record_decision(
            rconn, node.id, 0.5, 0.9,
            trigger_evidence="",           # no evidence landed -> rejected
            reason="hunch", timestamp="2026-07-04T09:00:00+00:00", actor="a",
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_reasoning_decisionlog.py -v`
Expected: FAIL — `ModuleNotFoundError: evidence_agent.reasoning.decisionlog`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/reasoning/decisionlog.py`:
```python
from __future__ import annotations

import sqlite3

from evidence_agent.core import new_id


def record_decision(
    conn: sqlite3.Connection,
    node_id: str,
    old_confidence: float,
    new_confidence: float,
    trigger_evidence: str,
    reason: str,
    timestamp: str,
    actor: str,
) -> str:
    """Append one immutable decision-log row. Confidence updates ONLY when new
    evidence lands, so an empty `trigger_evidence` is rejected. `timestamp` and
    `actor` are passed in for deterministic tests."""
    if not trigger_evidence:
        raise ValueError("confidence may change only when new evidence lands")
    did = new_id(conn, "DEC")
    conn.execute(
        "INSERT INTO decision_log(id, node_id, old_confidence, new_confidence, "
        "trigger_evidence, reason, timestamp, actor) VALUES(?,?,?,?,?,?,?,?)",
        (did, node_id, old_confidence, new_confidence, trigger_evidence,
         reason, timestamp, actor),
    )
    conn.commit()
    return did


def list_decisions(conn: sqlite3.Connection, node_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM decision_log WHERE node_id = ? ORDER BY id", (node_id,)
    ).fetchall()
    return [dict(r) for r in rows]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_reasoning_decisionlog.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/reasoning/decisionlog.py tests/test_reasoning_decisionlog.py
git commit -m "feat(reasoning): append-only decision log"
```

---

### Task 6: Hearing matrix builder

**Files:**
- Create: `src/evidence_agent/reasoning/matrix.py`
- Test: `tests/test_reasoning_matrix.py`

- [ ] **Step 1: Write the failing test**

`tests/test_reasoning_matrix.py`:
```python
import pytest
from evidence_agent.core import ArtefactClass, add_artefact, add_anchor
from evidence_agent.reasoning.schema import init_reasoning_schema
from evidence_agent.reasoning.hypothesis import add_node
from evidence_agent.reasoning.matrix import build_matrix


@pytest.fixture
def rconn(conn):
    init_reasoning_schema(conn)
    return conn


def test_matrix_row_per_element_with_anchor_lowers_risk(rconn, tmp_path):
    p = tmp_path / "brief.pdf"
    p.write_bytes(b"hello")
    art = add_artefact(rconn, "M1", ArtefactClass.ORIGINAL, "police brief", p)
    add_anchor(rconn, "M1", art.id, "doc", "p12/l4-9", "the search was warrantless")
    node = add_node(
        rconn, "M1", "warrantless search",
        required_legal_elements=["lawful search", "possession"],
        supporting_artefacts=[art.id],
        contrary_artefacts=["ART-9999"],
        unknowns=[], next_test="",
    )
    rows = build_matrix(rconn, node)
    assert [r["element"] for r in rows] == ["lawful search", "possession"]
    assert set(rows[0]) == {
        "element", "evidence", "admissibility_risk", "contradiction", "hearing_utility",
    }
    assert rows[0]["evidence"] == [art.id]
    assert rows[0]["admissibility_risk"] == "low"        # anchored
    assert rows[0]["contradiction"] == ["ART-9999"]
    assert rows[0]["hearing_utility"] == "contested"     # contrary present


def test_matrix_unanchored_high_risk(rconn):
    node = add_node(
        rconn, "M1", "possession",
        required_legal_elements=["possession"],
        supporting_artefacts=["ART-1234"],   # no anchor -> list_anchors == []
        contrary_artefacts=[],
        unknowns=[], next_test="",
    )
    row = build_matrix(rconn, node)[0]
    assert row["admissibility_risk"] == "high"
    assert row["hearing_utility"] == "high"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_reasoning_matrix.py -v`
Expected: FAIL — `ModuleNotFoundError: evidence_agent.reasoning.matrix`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/reasoning/matrix.py`:
```python
from __future__ import annotations

import sqlite3

from evidence_agent.core import list_anchors
from evidence_agent.reasoning.hypothesis import HypothesisNode


def build_matrix(conn: sqlite3.Connection, node: HypothesisNode) -> list[dict]:
    """One row per required legal element:
    element -> evidence -> admissibility_risk -> contradiction -> hearing_utility."""
    evidence = list(node.supporting_artefacts)
    contradiction = list(node.contrary_artefacts)
    anchored = any(list_anchors(conn, aid) for aid in evidence)
    admissibility_risk = "low" if anchored else "high"
    if not evidence:
        hearing_utility = "low"
    elif contradiction:
        hearing_utility = "contested"
    else:
        hearing_utility = "high"
    return [
        {
            "element": element,
            "evidence": evidence,
            "admissibility_risk": admissibility_risk,
            "contradiction": contradiction,
            "hearing_utility": hearing_utility,
        }
        for element in node.required_legal_elements
    ]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_reasoning_matrix.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/evidence_agent/reasoning/matrix.py tests/test_reasoning_matrix.py
git commit -m "feat(reasoning): hearing matrix builder"
```

---

### Task 7: Engine orchestration + package re-exports

**Files:**
- Create: `src/evidence_agent/reasoning/engine.py`
- Modify: `src/evidence_agent/reasoning/__init__.py`
- Test: `tests/test_reasoning_engine.py`

- [ ] **Step 1: Write the failing test**

`tests/test_reasoning_engine.py`:
```python
import pytest
from evidence_agent.reasoning.schema import init_reasoning_schema
from evidence_agent.reasoning.hypothesis import add_node
from evidence_agent.reasoning.chains import Chain, ChainView
from evidence_agent.reasoning.engine import run_reasoning


@pytest.fixture
def rconn(conn):
    init_reasoning_schema(conn)
    return conn


def fake_analyst(chain: Chain, node) -> ChainView:
    """Deterministic fake — NO network, NO LLM. Prosecution & neutral rely on
    ART-0001; only prosecution also relies on ART-0002 (making ART-0001 critical)."""
    relied = {
        Chain.PROSECUTION: ["ART-0001", "ART-0002"],
        Chain.DEFENCE: [],
        Chain.NEUTRAL: ["ART-0001"],
    }
    return ChainView(
        chain=chain, position=f"{chain.value} view",
        relied_on=relied[chain],
        weaknesses=["gap"] if chain is Chain.DEFENCE else [],
    )


def test_run_reasoning_end_to_end(rconn):
    node = add_node(
        rconn, "M1", "warrantless search", ["lawful search"],
        supporting_artefacts=["ART-0001", "ART-0002"],
        contrary_artefacts=[], unknowns=[], next_test="",
    )
    result = run_reasoning(rconn, node, fake_analyst)

    # 3 chains ran and persisted
    assert set(result["chain_views"]) == {Chain.PROSECUTION, Chain.DEFENCE, Chain.NEUTRAL}
    assert rconn.execute(
        "SELECT COUNT(*) FROM chain_views WHERE node_id = ?", (node.id,)
    ).fetchone()[0] == 3

    # confidence: base 2/2=1.0 minus one defence weakness (0.05)
    assert result["confidence"] == 0.95

    # dependency risk built from relied_on tallies: ART-0001 relied on by 2 chains,
    # ART-0002 by 1 -> ART-0001 critical, drop 2/3
    assert result["dependency_risk"]["critical_artefact"] == "ART-0001"
    assert result["dependency_risk"]["drop"] == 0.6667

    # matrix present, keyed by element
    assert result["matrix"][0]["element"] == "lawful search"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_reasoning_engine.py -v`
Expected: FAIL — `ModuleNotFoundError: evidence_agent.reasoning.engine`.

- [ ] **Step 3: Write minimal implementation**

`src/evidence_agent/reasoning/engine.py`:
```python
from __future__ import annotations

import sqlite3
from collections import defaultdict

from evidence_agent.reasoning.chains import Analyst, run_chains, persist_chain_views
from evidence_agent.reasoning.hypothesis import HypothesisNode
from evidence_agent.reasoning.matrix import build_matrix
from evidence_agent.reasoning.scoring import dependency_risk, score_confidence


def _support_map_from_views(chain_views) -> dict[str, float]:
    """Tally how many chains relied on each artefact -> its support weight."""
    tally: dict[str, float] = defaultdict(float)
    for view in chain_views.values():
        for aid in view.relied_on:
            tally[aid] += 1.0
    return dict(tally)


def run_reasoning(
    conn: sqlite3.Connection, node: HypothesisNode, analyst: Analyst
) -> dict:
    """Orchestrate: parallel chains -> scoring -> persistence -> matrix."""
    chain_views = run_chains(node, analyst)
    persist_chain_views(conn, node.id, chain_views)
    confidence = score_confidence(node, chain_views)
    support_map = _support_map_from_views(chain_views)
    risk = dependency_risk(node, support_map)
    matrix = build_matrix(conn, node)
    return {
        "node_id": node.id,
        "chain_views": chain_views,
        "confidence": confidence,
        "dependency_risk": risk,
        "matrix": matrix,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_reasoning_engine.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Re-export the reasoning surface**

`src/evidence_agent/reasoning/__init__.py`:
```python
"""Dynamic reasoning agents — hypothesis nodes, parallel chains, scoring, matrices."""
from evidence_agent.reasoning.schema import init_reasoning_schema
from evidence_agent.reasoning.hypothesis import (
    HypothesisNode, add_node, get_node, list_nodes,
)
from evidence_agent.reasoning.chains import (
    Chain, ChainView, Analyst, run_chains, persist_chain_views,
)
from evidence_agent.reasoning.scoring import score_confidence, dependency_risk
from evidence_agent.reasoning.decisionlog import record_decision, list_decisions
from evidence_agent.reasoning.matrix import build_matrix
from evidence_agent.reasoning.engine import run_reasoning

__all__ = [
    "init_reasoning_schema",
    "HypothesisNode", "add_node", "get_node", "list_nodes",
    "Chain", "ChainView", "Analyst", "run_chains", "persist_chain_views",
    "score_confidence", "dependency_risk",
    "record_decision", "list_decisions",
    "build_matrix", "run_reasoning",
]
```

- [ ] **Step 6: Run the whole reasoning suite**

Run: `.venv/bin/python -m pytest tests/test_reasoning_*.py -v`
Expected: PASS (all reasoning tasks green).

- [ ] **Step 7: Commit**

```bash
git add src/evidence_agent/reasoning/engine.py src/evidence_agent/reasoning/__init__.py tests/test_reasoning_engine.py
git commit -m "feat(reasoning): engine orchestration + package re-exports"
```

---

## Self-Review

- **Spec point 1 (Hypothesis Node: claim, required_legal_elements, supporting/contrary artefacts, unknowns, next_test):** Task 2 — `HypothesisNode` dataclass + `add_node`/`get_node`/`list_nodes` with JSON-encoded list fields; table in Task 1.
- **Spec point 2 (≥3 chains in parallel via injected analyst, ThreadPoolExecutor(max_workers=3), fakes in tests):** Task 3 — `Chain` enum (PROSECUTION/DEFENCE/NEUTRAL), `run_chains` uses `ThreadPoolExecutor(max_workers=3)` over the injected `analyst`; every test uses `fake_analyst`. Production-analyst-wrapping-a-provider is documented in `chains.py` and the Architecture line.
- **Spec point 3 (confidence + dependency_risk, pure, hand-built inputs):** Task 4 pure functions with fabricated inputs; wired end-to-end in Task 7 where `run_reasoning` builds the `support_map` from chain `relied_on` tallies and returns BOTH `confidence` and `dependency_risk`.
- **Spec point 4 (update confidence only on new evidence; append-only log with old/new/trigger/reason/timestamp; timestamp+actor passed in):** Task 5 — `record_decision` rejects empty `trigger_evidence`, `list_decisions` returns append-ordered rows; `timestamp`/`actor` are parameters.
- **Spec point 5 (output matrix: element → evidence → admissibility_risk → contradiction → hearing_utility as list[dict]):** Task 6 — `build_matrix` returns exactly those five keys per element.
- **Placeholder scan:** none — every step ships complete runnable code and an exact pytest command.
- **Type consistency:** `db`, `ArtefactClass`, `Artefact`, `get_artefact`, `list_artefacts`, `EvidenceAnchor`, `add_anchor`, `list_anchors`, `new_id` are imported verbatim from `evidence_agent.core` and never redefined. Reasoning tables are added only via `init_reasoning_schema(conn)`; core `db.py` is untouched. All DB-writing tests create a real `HypothesisNode` first so the `chain_views`/`decision_log` foreign keys to `hypothesis_nodes(id)` are satisfied under `PRAGMA foreign_keys = ON`.
