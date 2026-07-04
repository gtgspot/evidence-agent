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
