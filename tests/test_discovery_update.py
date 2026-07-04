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
