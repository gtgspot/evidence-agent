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
