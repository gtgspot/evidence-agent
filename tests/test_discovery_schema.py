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
