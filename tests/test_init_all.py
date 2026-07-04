from evidence_agent.schema import init_all
from evidence_agent.core import db

_EXPECTED = {
    "artefacts", "evidence_anchors", "id_counters",
    "discovery_requests", "receipt_checks", "redaction_schedule",
    "custody_events", "linked_issues",
    "hypothesis_nodes", "chain_views", "decision_log",
}


def test_init_all_creates_every_table(tmp_path):
    conn = db.connect(tmp_path / "m.db")
    init_all(conn)
    names = {
        r[0]
        for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    assert _EXPECTED <= names
    conn.close()


def test_init_all_is_idempotent(tmp_path):
    conn = db.connect(tmp_path / "m.db")
    init_all(conn)
    init_all(conn)  # second run must not raise
    conn.close()
