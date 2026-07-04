import pytest
from evidence_agent.core.artefact import ArtefactClass, add_artefact
from evidence_agent.core.anchor import EvidenceAnchor, add_anchor, list_anchors


def _artefact(conn, tmp_path):
    p = tmp_path / "o"; p.write_bytes(b"x")
    return add_artefact(conn, "M1", ArtefactClass.ORIGINAL, "s", p)


def test_add_doc_anchor(conn, tmp_path):
    a = _artefact(conn, tmp_path)
    anc = add_anchor(conn, "M1", a.id, "doc", "p12/l4-9", "the search was warrantless")
    assert anc.id.startswith("ANC-")
    assert anc.kind == "doc" and anc.locator == "p12/l4-9"
    assert list_anchors(conn, a.id) == [anc]


def test_anchor_rejects_bad_kind(conn, tmp_path):
    a = _artefact(conn, tmp_path)
    with pytest.raises(ValueError):
        add_anchor(conn, "M1", a.id, "sound", "00:03", "")
