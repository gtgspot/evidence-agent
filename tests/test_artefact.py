import pytest
from evidence_agent.core.artefact import (
    Artefact, ArtefactClass, add_artefact, get_artefact, list_artefacts,
    ImmutableOriginalError,
)


def _write(tmp_path, name, data=b"x"):
    p = tmp_path / name
    p.write_bytes(data)
    return p


def test_add_and_get_roundtrip(conn, tmp_path):
    p = _write(tmp_path, "brief.pdf", b"hello")
    a = add_artefact(conn, "M1", ArtefactClass.ORIGINAL, "police brief", p)
    assert a.id.startswith("ART-")
    assert a.cls is ArtefactClass.ORIGINAL
    assert a.sha256 == __import__("hashlib").sha256(b"hello").hexdigest()
    got = get_artefact(conn, a.id)
    assert got == a


def test_list_filters_by_class(conn, tmp_path):
    add_artefact(conn, "M1", ArtefactClass.ORIGINAL, "s", _write(tmp_path, "o"))
    add_artefact(conn, "M1", ArtefactClass.DERIVATIVE, "s", _write(tmp_path, "d"))
    assert len(list_artefacts(conn, "M1")) == 2
    assert len(list_artefacts(conn, "M1", ArtefactClass.ORIGINAL)) == 1


def test_originals_are_immutable(conn, tmp_path):
    a = add_artefact(conn, "M1", ArtefactClass.ORIGINAL, "s", _write(tmp_path, "o"))
    with pytest.raises(ImmutableOriginalError):
        add_artefact(
            conn, "M1", ArtefactClass.DERIVATIVE, "edit", _write(tmp_path, "o2"),
            parent_id=a.id, overwrite_target=a.id,
        )
