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
