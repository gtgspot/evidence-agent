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
