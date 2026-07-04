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
