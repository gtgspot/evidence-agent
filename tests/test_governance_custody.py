import pytest
from evidence_agent.core import ArtefactClass, add_artefact
from evidence_agent.governance.schema import init_governance_schema
from evidence_agent.governance.custody import (
    CustodyEvent, record_custody_event, list_custody, verify_integrity,
)


@pytest.fixture
def gconn(conn):
    init_governance_schema(conn)
    return conn


def _original(gconn, tmp_path, name="o", data=b"evidence"):
    p = tmp_path / name
    p.write_bytes(data)
    return add_artefact(gconn, "M1", ArtefactClass.ORIGINAL, "seized", p)


def test_record_and_list_custody_ordered(gconn, tmp_path):
    a = _original(gconn, tmp_path)
    e1 = record_custody_event(
        gconn, a.id, "seized", "Sgt Blake", "2025-12-05T09:00:00+00:00", "at scene"
    )
    e2 = record_custody_event(
        gconn, a.id, "logged", "Clerk", "2025-12-05T14:00:00+00:00"
    )
    assert e1.id.startswith("CUS-")
    assert isinstance(e1, CustodyEvent)
    events = list_custody(gconn, a.id)
    assert [e.id for e in events] == [e1.id, e2.id]
    assert events[0].actor == "Sgt Blake"
    assert events[0].timestamp == "2025-12-05T09:00:00+00:00"
    assert events[1].note == ""


def test_verify_integrity_true_then_false(gconn, tmp_path):
    p = tmp_path / "o"
    p.write_bytes(b"evidence")
    a = add_artefact(gconn, "M1", ArtefactClass.ORIGINAL, "seized", p)
    assert verify_integrity(gconn, a.id) is True
    p.write_bytes(b"tampered")  # mutate the file on disk
    assert verify_integrity(gconn, a.id) is False
