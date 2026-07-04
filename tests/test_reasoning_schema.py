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
