import pytest
from evidence_agent.core import ArtefactClass, ImmutableOriginalError
from evidence_agent.governance.schema import init_governance_schema
from evidence_agent.governance.classes import LineageError, governed_add


@pytest.fixture
def gconn(conn):
    init_governance_schema(conn)
    return conn


def _write(tmp_path, name, data=b"x"):
    p = tmp_path / name
    p.write_bytes(data)
    return p


def test_original_needs_no_parent(gconn, tmp_path):
    a = governed_add(gconn, "M1", ArtefactClass.ORIGINAL, "brief", _write(tmp_path, "o"))
    assert a.parent_id is None
    assert a.cls is ArtefactClass.ORIGINAL


def test_derivative_requires_parent(gconn, tmp_path):
    with pytest.raises(LineageError):
        governed_add(gconn, "M1", ArtefactClass.DERIVATIVE, "edit", _write(tmp_path, "d"))


def test_valid_transition_records_parent(gconn, tmp_path):
    orig = governed_add(gconn, "M1", ArtefactClass.ORIGINAL, "s", _write(tmp_path, "o"))
    deriv = governed_add(
        gconn, "M1", ArtefactClass.DERIVATIVE, "s", _write(tmp_path, "d"),
        parent_id=orig.id,
    )
    assert deriv.parent_id == orig.id


def test_invalid_transition_rejected(gconn, tmp_path):
    orig = governed_add(gconn, "M1", ArtefactClass.ORIGINAL, "s", _write(tmp_path, "o"))
    with pytest.raises(LineageError):
        governed_add(
            gconn, "M1", ArtefactClass.SUBMISSION_READY, "s", _write(tmp_path, "sr"),
            parent_id=orig.id,
        )


def test_missing_parent_rejected(gconn, tmp_path):
    with pytest.raises(LineageError):
        governed_add(
            gconn, "M1", ArtefactClass.DERIVATIVE, "s", _write(tmp_path, "d"),
            parent_id="ART-9999",
        )


def test_refuses_to_overwrite_original(gconn, tmp_path):
    orig = governed_add(gconn, "M1", ArtefactClass.ORIGINAL, "s", _write(tmp_path, "o"))
    with pytest.raises(ImmutableOriginalError):
        governed_add(
            gconn, "M1", ArtefactClass.DERIVATIVE, "s", _write(tmp_path, "d"),
            parent_id=orig.id, overwrite_target=orig.id,
        )
